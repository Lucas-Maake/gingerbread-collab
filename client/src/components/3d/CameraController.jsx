import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'

// Camera constraints from PRD
const MIN_ZOOM = 30    // Close view (higher zoom = closer)
const MAX_ZOOM = 100   // Far overview
const DEFAULT_ZOOM = 50
const PAN_BOUNDS = 7   // Max distance from center (world units)

// Camera setup
const CAMERA_DISTANCE = 15
const MIN_POLAR_ANGLE = 0.1  // Prevent looking straight down
const MAX_POLAR_ANGLE = Math.PI / 2 - 0.1  // Prevent going below ground

/**
 * Camera controller with full rotation
 * - Pan: Middle mouse OR Shift + Left drag
 * - Zoom: Mouse scroll wheel
 * - Rotate: Right mouse drag
 */
export default function CameraController() {
  const { camera, gl } = useThree()
  const heldPieceId = useGameStore((state) => state.heldPieceId)

  // State refs
  const isPanning = useRef(false)
  const isRotating = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const targetCenter = useRef(new THREE.Vector3(0, 0, 0))
  const currentZoom = useRef(DEFAULT_ZOOM)

  // Spherical coordinates for rotation (azimuth = horizontal, polar = vertical)
  const azimuth = useRef(Math.PI / 4)  // 45 degrees - initial isometric angle
  const polar = useRef(Math.PI / 4)    // 45 degrees from top

  // Listen for reset camera event
  useEffect(() => {
    const handleReset = () => {
      // Reset to default isometric view
      azimuth.current = Math.PI / 4
      polar.current = Math.PI / 4
      targetCenter.current.set(0, 0, 0)
      currentZoom.current = DEFAULT_ZOOM
    }

    window.addEventListener('resetCamera', handleReset)
    return () => window.removeEventListener('resetCamera', handleReset)
  }, [])

  // Listen for camera preset events
  useEffect(() => {
    const handlePreset = (e) => {
      const { azimuth: newAzimuth, polar: newPolar, zoom: newZoom } = e.detail
      if (newAzimuth !== undefined) azimuth.current = newAzimuth
      if (newPolar !== undefined) polar.current = newPolar
      if (newZoom !== undefined) currentZoom.current = newZoom
      // Reset center to origin for preset views
      targetCenter.current.set(0, 0, 0)
    }

    window.addEventListener('setCameraPreset', handlePreset)
    return () => window.removeEventListener('setCameraPreset', handlePreset)
  }, [])

  useEffect(() => {
    const canvas = gl.domElement

    // Calculate camera position from spherical coordinates
    const updateCameraPosition = () => {
      const x = CAMERA_DISTANCE * Math.sin(polar.current) * Math.cos(azimuth.current)
      const y = CAMERA_DISTANCE * Math.cos(polar.current)
      const z = CAMERA_DISTANCE * Math.sin(polar.current) * Math.sin(azimuth.current)

      camera.position.set(
        targetCenter.current.x + x,
        targetCenter.current.y + y,
        targetCenter.current.z + z
      )
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
      // Right mouse for rotation
      else if (e.button === 2) {
        isRotating.current = true
        lastMouse.current = { x: e.clientX, y: e.clientY }
        canvas.style.cursor = 'move'
        e.preventDefault()
      }
    }

    // Mouse move handler
    const handleMouseMove = (e) => {
      const deltaX = e.clientX - lastMouse.current.x
      const deltaY = e.clientY - lastMouse.current.y

      if (isPanning.current) {
        // Calculate pan in world space based on current camera angle
        const panSpeed = 0.015 / (currentZoom.current / DEFAULT_ZOOM)

        // Get camera right and forward vectors for panning
        const right = new THREE.Vector3()
        const forward = new THREE.Vector3()
        camera.getWorldDirection(forward)
        right.crossVectors(camera.up, forward).normalize()
        forward.crossVectors(right, camera.up).normalize()

        // Apply pan
        targetCenter.current.x += (-deltaX * right.x + deltaY * forward.x) * panSpeed
        targetCenter.current.z += (-deltaX * right.z + deltaY * forward.z) * panSpeed

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
      }

      if (isRotating.current) {
        const rotateSpeed = 0.005

        // Update azimuth (horizontal rotation)
        azimuth.current -= deltaX * rotateSpeed

        // Update polar (vertical rotation) with clamping
        polar.current += deltaY * rotateSpeed
        polar.current = THREE.MathUtils.clamp(
          polar.current,
          MIN_POLAR_ANGLE,
          MAX_POLAR_ANGLE
        )
      }

      lastMouse.current = { x: e.clientX, y: e.clientY }
    }

    // Mouse up handler
    const handleMouseUp = (e) => {
      if (e.button === 1 || e.button === 0) {
        isPanning.current = false
        canvas.style.cursor = 'auto'
      }
      if (e.button === 2) {
        isRotating.current = false
        canvas.style.cursor = 'auto'
      }
    }

    // Mouse leave handler
    const handleMouseLeave = () => {
      isPanning.current = false
      isRotating.current = false
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

    // Context menu (prevent on right click for rotation)
    const handleContextMenu = (e) => {
      e.preventDefault()
    }

    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('contextmenu', handleContextMenu)

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [camera, gl, heldPieceId])

  // Smooth camera updates
  useFrame(() => {
    // Calculate target camera position from spherical coordinates
    const x = CAMERA_DISTANCE * Math.sin(polar.current) * Math.cos(azimuth.current)
    const y = CAMERA_DISTANCE * Math.cos(polar.current)
    const z = CAMERA_DISTANCE * Math.sin(polar.current) * Math.sin(azimuth.current)

    const targetPos = new THREE.Vector3(
      targetCenter.current.x + x,
      targetCenter.current.y + y,
      targetCenter.current.z + z
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
