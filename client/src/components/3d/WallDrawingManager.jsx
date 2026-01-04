import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import { snapPointToGrid } from '../../utils/gridSnap'
import { playGlobalSound, SoundType } from '../../hooks/useSoundEffects'

const BUILD_SURFACE_SIZE = 5 // Half-size bounds

/**
 * Handles wall drawing interactions
 * - First click sets start point
 * - Second click creates wall and resets
 * - Escape cancels drawing
 */
export default function WallDrawingManager() {
  const { camera, gl } = useThree()

  const raycaster = useRef(new THREE.Raycaster())
  const mouse = useRef(new THREE.Vector2())
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const intersectPoint = useRef(new THREE.Vector3())

  useEffect(() => {
    const canvas = gl.domElement

    // Initialize mouse state for preview
    canvas.__wallPreviewMouse = { x: 0, y: 0 }

    const updateMousePosition = (event) => {
      const rect = canvas.getBoundingClientRect()
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      // Store for preview component
      canvas.__wallPreviewMouse.x = mouse.current.x
      canvas.__wallPreviewMouse.y = mouse.current.y
    }

    const raycastToPlane = () => {
      raycaster.current.setFromCamera(mouse.current, camera)
      raycaster.current.ray.intersectPlane(dragPlane.current, intersectPoint.current)
      return intersectPoint.current.clone()
    }

    const clampToBounds = (x, z) => {
      return [
        THREE.MathUtils.clamp(x, -BUILD_SURFACE_SIZE, BUILD_SURFACE_SIZE),
        THREE.MathUtils.clamp(z, -BUILD_SURFACE_SIZE, BUILD_SURFACE_SIZE)
      ]
    }

    const handleMouseDown = async (event) => {
      // Only handle left click
      if (event.button !== 0) return

      // Ignore if shift is held (camera pan)
      if (event.shiftKey) return

      const state = useGameStore.getState()

      // Only handle in wall mode
      if (state.buildMode !== 'wall') return

      updateMousePosition(event)
      const point = raycastToPlane()

      let x = point.x
      let z = point.z

      // Apply grid snap
      if (state.gridSnapEnabled) {
        const snapped = snapPointToGrid([x, z], state.gridSize)
        x = snapped[0]
        z = snapped[1]
      }

      // Clamp to bounds
      const [clampedX, clampedZ] = clampToBounds(x, z)

      if (!state.wallDrawingStartPoint) {
        // First click - set start point
        state.setWallDrawingStartPoint([clampedX, clampedZ])
        playGlobalSound(SoundType.GRAB)
      } else {
        // Second click - create wall
        const [startX, startZ] = state.wallDrawingStartPoint

        // Check if wall is long enough
        const dx = clampedX - startX
        const dz = clampedZ - startZ
        const length = Math.sqrt(dx * dx + dz * dz)

        if (length >= 0.3) {
          // Create the wall
          await state.createWall([startX, startZ], [clampedX, clampedZ])
        }

        // Reset for next wall
        state.clearWallDrawingStartPoint()
      }
    }

    const handleMouseMove = (event) => {
      updateMousePosition(event)
    }

    const handleKeyDown = (event) => {
      const state = useGameStore.getState()

      if (state.buildMode !== 'wall') return

      if (event.key === 'Escape' && state.wallDrawingStartPoint) {
        // Cancel wall drawing
        state.clearWallDrawingStartPoint()
      }
    }

    const handleContextMenu = (event) => {
      const state = useGameStore.getState()

      // In wall mode, right-click cancels drawing
      if (state.buildMode === 'wall' && state.wallDrawingStartPoint) {
        event.preventDefault()
        state.clearWallDrawingStartPoint()
      }
    }

    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('keydown', handleKeyDown)
      delete canvas.__wallPreviewMouse
    }
  }, [camera, gl])

  return null
}
