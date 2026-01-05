import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import { raycastToSurface, filterPoints } from '../../utils/icingSnapping'

const MIN_POINT_DISTANCE = 0.05 // Minimum distance between points
const POINT_THROTTLE_MS = 50 // Minimum time between point additions

/**
 * Handles icing drawing interactions
 * - Mouse down starts stroke
 * - Mouse move adds points (throttled)
 * - Mouse up ends stroke and sends to server
 */
export default function IcingDrawingManager() {
  const { camera, gl, scene } = useThree()

  const mouse = useRef(new THREE.Vector2())
  const isDrawing = useRef(false)
  const isSendingStroke = useRef(false) // Prevent race conditions during send
  const lastPointTime = useRef(0)
  const currentSurfaceType = useRef('ground')
  const currentSurfaceId = useRef(null)

  useEffect(() => {
    const canvas = gl.domElement

    const updateMousePosition = (event) => {
      const rect = canvas.getBoundingClientRect()
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    }

    const handleMouseDown = (event) => {
      // Only handle left click
      if (event.button !== 0) return

      // Ignore if shift is held (camera pan)
      if (event.shiftKey) return

      const state = useGameStore.getState()

      // Only handle in icing mode
      if (state.buildMode !== 'icing') return

      updateMousePosition(event)

      // Raycast to find surface
      const hit = raycastToSurface(mouse.current, camera, scene)
      if (!hit) return

      // Start drawing
      isDrawing.current = true
      currentSurfaceType.current = hit.surfaceType
      currentSurfaceId.current = hit.surfaceId

      state.startIcingStroke()
      state.addIcingPoint(hit.point)
      lastPointTime.current = Date.now()
    }

    const handleMouseMove = (event) => {
      const state = useGameStore.getState()

      // Only handle in icing mode while drawing
      if (state.buildMode !== 'icing' || !isDrawing.current) return

      updateMousePosition(event)

      // Throttle point additions
      const now = Date.now()
      if (now - lastPointTime.current < POINT_THROTTLE_MS) return

      // Raycast to find surface
      const hit = raycastToSurface(mouse.current, camera, scene)
      if (!hit) return

      // Check distance from last point
      const points = state.icingDrawingPoints
      if (points.length > 0) {
        const lastPoint = points[points.length - 1]
        const dx = hit.point[0] - lastPoint[0]
        const dy = hit.point[1] - lastPoint[1]
        const dz = hit.point[2] - lastPoint[2]
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

        if (dist < MIN_POINT_DISTANCE) return
      }

      state.addIcingPoint(hit.point)
      lastPointTime.current = now
    }

    const handleMouseUp = (event) => {
      const state = useGameStore.getState()

      // Only handle in icing mode while drawing
      if (state.buildMode !== 'icing' || !isDrawing.current) return

      // Prevent double-sends from rapid mouse up events
      if (isSendingStroke.current) return

      isDrawing.current = false

      // Get final points
      const points = state.icingDrawingPoints

      // Filter points that are too close together
      const filteredPoints = filterPoints(points, MIN_POINT_DISTANCE)

      // End the drawing state immediately for UI responsiveness
      state.endIcingStroke()

      // Send to server if we have enough points
      if (filteredPoints.length >= 2) {
        isSendingStroke.current = true

        // Handle promise without async/await to avoid event handler issues
        state.createIcing(
          filteredPoints,
          0.05, // radius
          currentSurfaceType.current,
          currentSurfaceId.current
        ).finally(() => {
          isSendingStroke.current = false
          // Clear stroke after send completes (success or fail)
          useGameStore.getState().clearIcingStroke()
        })
      } else {
        // Clear the stroke immediately if not enough points
        state.clearIcingStroke()
      }
    }

    const handleKeyDown = (event) => {
      const state = useGameStore.getState()

      if (state.buildMode !== 'icing') return

      if (event.key === 'Escape' && isDrawing.current) {
        // Cancel icing drawing
        isDrawing.current = false
        state.clearIcingStroke()
      }
    }

    const handleContextMenu = (event) => {
      const state = useGameStore.getState()

      // In icing mode, right-click cancels drawing
      if (state.buildMode === 'icing' && isDrawing.current) {
        event.preventDefault()
        isDrawing.current = false
        state.clearIcingStroke()
      }
    }

    // Handle mouse leaving canvas
    const handleMouseLeave = () => {
      if (isDrawing.current) {
        // Finish stroke when mouse leaves canvas
        handleMouseUp({ button: 0 })
      }
    }

    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    canvas.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      canvas.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [camera, gl, scene])

  return null
}
