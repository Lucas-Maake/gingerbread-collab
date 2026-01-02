import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'

// Camera constraints from PRD
const MIN_ZOOM = 30    // Close view (higher zoom = closer)
const MAX_ZOOM = 100   // Far overview
const DEFAULT_ZOOM = 50
const PAN_BOUNDS = 7   // Max distance from center (world units)

// Isometric camera setup
const CAMERA_DISTANCE = 15
const CAMERA_ANGLE = Math.PI / 4 // 45 degrees

/**
 * Camera controller for isometric view
 * - Pan: Middle mouse OR Shift + Left drag
 * - Zoom: Mouse scroll wheel
 * - No rotation (locked isometric angle)
 */
export default function CameraController() {
  const { camera, gl } = useThree()
  const heldPieceId = useGameStore((state) => state.heldPieceId)

  // State refs
  const isPanning = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const targetCenter = useRef(new THREE.Vector3(0, 0, 0))
  const currentZoom = useRef(DEFAULT_ZOOM)

  useEffect(() => {
    const canvas = gl.domElement

    // Set initial camera position (isometric 45 degrees)
    const updateCameraPosition = () => {
      const offset = new THREE.Vector3(
        CAMERA_DISTANCE,
        CAMERA_DISTANCE,
        CAMERA_DISTANCE
      )
      camera.position.copy(targetCenter.current).add(offset)
      camera.lookAt(targetCenter.current)
      camera.zoom = currentZoom.current
      camera.updateProjectionMatrix()
    }

    updateCameraPosition()

    // Mouse down handler
    const handleMouseDown = (e) => {
      // Middle mouse OR Shift + Left click for panning
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        isPanning.current = true
        lastMouse.current = { x: e.clientX, y: e.clientY }
        canvas.style.cursor = 'grabbing'
        e.preventDefault()
      }
    }

    // Mouse move handler
    const handleMouseMove = (e) => {
      if (!isPanning.current) return

      const deltaX = e.clientX - lastMouse.current.x
      const deltaY = e.clientY - lastMouse.current.y

      // Calculate pan in world space (isometric axes)
      // Screen X maps to world diagonal (X-Z)
      // Screen Y maps to world depth (X+Z)
      const panSpeed = 0.015 / (currentZoom.current / DEFAULT_ZOOM)

      // Isometric pan vectors
      const panX = (-deltaX + deltaY) * panSpeed * 0.7
      const panZ = (-deltaX - deltaY) * panSpeed * 0.7

      targetCenter.current.x += panX
      targetCenter.current.z += panZ

      // Clamp to bounds
      targetCenter.current.x = THREE.MathUtils.clamp(
        targetCenter.current.x,
        -PAN_BOUNDS,
        PAN_BOUNDS
      )
      targetCenter.current.z = THREE.MathUtils.clamp(
        targetCenter.current.z,
        -PAN_BOUNDS,
        PAN_BOUNDS
      )

      lastMouse.current = { x: e.clientX, y: e.clientY }
    }

    // Mouse up handler
    const handleMouseUp = (e) => {
      if (e.button === 1 || e.button === 0) {
        isPanning.current = false
        canvas.style.cursor = 'auto'
      }
    }

    // Mouse leave handler
    const handleMouseLeave = () => {
      isPanning.current = false
      canvas.style.cursor = 'auto'
    }

    // Mouse wheel handler (zoom)
    const handleWheel = (e) => {
      // Don't zoom if holding a piece (wheel is used for rotation)
      if (heldPieceId) return

      // Prevent default scroll
      e.preventDefault()

      // Zoom speed
      const zoomSpeed = 0.08
      const zoomDelta = -e.deltaY * zoomSpeed

      // Calculate new zoom
      currentZoom.current += zoomDelta * (currentZoom.current / DEFAULT_ZOOM)

      // Clamp zoom
      currentZoom.current = THREE.MathUtils.clamp(
        currentZoom.current,
        MIN_ZOOM,
        MAX_ZOOM
      )
    }

    // Context menu (prevent on middle click)
    const handleContextMenu = (e) => {
      // Don't prevent if we're handling piece deletion
      // e.preventDefault()
    }

    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [camera, gl, heldPieceId])

  // Smooth camera updates
  useFrame(() => {
    // Calculate target camera position
    const targetPos = new THREE.Vector3(
      targetCenter.current.x + CAMERA_DISTANCE,
      CAMERA_DISTANCE,
      targetCenter.current.z + CAMERA_DISTANCE
    )

    // Smooth interpolation for position
    camera.position.lerp(targetPos, 0.12)

    // Update look target
    const lookTarget = targetCenter.current.clone()
    camera.lookAt(lookTarget)

    // Smooth zoom
    camera.zoom += (currentZoom.current - camera.zoom) * 0.15
    camera.updateProjectionMatrix()
  })

  return null
}
