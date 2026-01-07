import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import { calculateSnapPosition, isSnappable, isDecorativeSnappable } from '../../utils/snapping'
import { playGlobalSound, SoundType } from '../../hooks/useSoundEffects'

// Constants from PRD
const BUILD_SURFACE_SIZE = 10
const ROTATION_SPEED = Math.PI / 8 // 22.5 degrees per press
const DRAG_PLANE_Y = 0.1 // Slightly above surface
const SNAP_HEIGHT_STEP = 0.1 // How much scroll wheel adjusts snap height
const SNAP_MIN_HEIGHT = 0.1 // Minimum center height for snapped pieces
const SNAP_MAX_HEIGHT = 1.3 // Maximum center height (below wall top)

/**
 * InteractionManager - Handles all piece interactions
 * - Raycasting for piece selection
 * - Drag and drop on XZ plane
 * - Rotation with Q/E keys
 * - Cursor position tracking
 */
export default function InteractionManager() {
  const { camera, gl, scene } = useThree()

  // Refs for interaction state
  const raycaster = useRef(new THREE.Raycaster())
  const mouse = useRef(new THREE.Vector2())
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y))
  const intersectPoint = useRef(new THREE.Vector3())
  const isDragging = useRef(false)
  const currentRotation = useRef(0)
  const lastCursorUpdate = useRef(0)
  const isSnapped = useRef(false) // Track if piece is currently snapped
  const snappedToWallId = useRef(null) // Track which wall the piece is snapped to
  const targetSnapHeight = useRef(0.75) // Target Y height for snapped pieces (adjustable with scroll)

  // Set up event listeners - use getState() to avoid stale closures
  useEffect(() => {
    const canvas = gl.domElement

    // Helper: Update mouse position
    const updateMousePosition = (event) => {
      const rect = canvas.getBoundingClientRect()
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    }

    // Helper: Raycast to find pieces
    const raycastPieces = () => {
      raycaster.current.setFromCamera(mouse.current, camera)

      // Find all meshes with pieceId userData
      const pieceMeshes = []
      scene.traverse((child) => {
        if (child.isMesh && child.userData.pieceId) {
          pieceMeshes.push(child)
        }
      })

      const intersects = raycaster.current.intersectObjects(pieceMeshes, false)
      return intersects.length > 0 ? intersects[0] : null
    }

    // Helper: Raycast to build surface plane
    const raycastToPlane = () => {
      raycaster.current.setFromCamera(mouse.current, camera)
      raycaster.current.ray.intersectPlane(dragPlane.current, intersectPoint.current)
      return intersectPoint.current.clone()
    }

    // Helper: Clamp position to build surface bounds
    const clampToBounds = (position) => {
      const halfSize = BUILD_SURFACE_SIZE / 2
      return new THREE.Vector3(
        THREE.MathUtils.clamp(position.x, -halfSize, halfSize),
        DRAG_PLANE_Y,
        THREE.MathUtils.clamp(position.z, -halfSize, halfSize)
      )
    }

    // Handle mouse down - release piece when clicking on empty space
    const handleMouseDown = async (event) => {
      // Only handle left click
      if (event.button !== 0) return

      // Ignore if shift is held (camera pan)
      if (event.shiftKey) return

      updateMousePosition(event)

      // Get current state from store
      const state = useGameStore.getState()
      const { heldPieceId, releasePiece, buildMode } = state

      // Only handle piece interactions in 'select' mode
      if (buildMode !== 'select') return

      // If holding a piece and clicking on empty space, release it
      if (heldPieceId) {
        // Check if we clicked on a piece - if so, let the piece handle it
        const intersection = raycastPieces()
        if (intersection) {
          // Clicked on a piece - let the Piece component's onClick handle it
          return
        }

        // Get the held piece to check for snapping
        const state = useGameStore.getState()
        const heldPiece = state.pieces.get(heldPieceId)

        // Clicked on empty space - release the piece here
        const point = raycastToPlane()
        const clampedPos = clampToBounds(point)
        let finalPos = [clampedPos.x, clampedPos.y, clampedPos.z]
        let finalYaw = currentRotation.current

        // Apply snapping for release position
        let attachedTo = null
        if (heldPiece && isSnappable(heldPiece.type)) {
          // For windows and decoratives, use the adjustable target height
          const isWindow = heldPiece.type === 'WINDOW_SMALL' || heldPiece.type === 'WINDOW_LARGE'
          const isDecorative = isDecorativeSnappable(heldPiece.type)
          const yForSnap = (isWindow || isDecorative) ? targetSnapHeight.current : clampedPos.y

          const snapResult = calculateSnapPosition(
            heldPiece.type,
            [clampedPos.x, yForSnap, clampedPos.z],
            finalYaw,
            state.pieces,
            heldPieceId,
            state.walls,
            isDecorative ? scene : null // Pass scene for decorative roof snapping
          )
          if (snapResult.snapped) {
            finalPos = snapResult.position
            finalYaw = snapResult.yaw
            attachedTo = snapResult.targetId // Track which wall/roof it's attached to
          }
        }

        console.log('Releasing piece at:', finalPos, 'attached to:', attachedTo)
        await releasePiece(finalPos, finalYaw, attachedTo)
        isDragging.current = false
        isSnapped.current = false
        snappedToWallId.current = null
      }
    }

    // Handle mouse move - drag piece and update cursor
    const handleMouseMove = (event) => {
      updateMousePosition(event)

      // Get cursor position on build surface
      const point = raycastToPlane()

      // Throttle cursor updates (15Hz as per PRD)
      const now = Date.now()
      if (now - lastCursorUpdate.current > 66) {
        useGameStore.getState().updateCursor(point.x, point.y, point.z)
        lastCursorUpdate.current = now
      }

      // Only handle piece dragging in 'select' mode
      const state = useGameStore.getState()
      if (state.buildMode !== 'select') return

      // If dragging, update piece position
      if (isDragging.current && state.heldPieceId) {
        const heldPiece = state.pieces.get(state.heldPieceId)
        if (!heldPiece) return

        const clampedPos = clampToBounds(point)
        let finalPos = [clampedPos.x, clampedPos.y, clampedPos.z]
        let finalYaw = currentRotation.current

        // Check for snapping if this piece type can snap
        if (isSnappable(heldPiece.type)) {
          // For windows and decoratives, use the adjustable target height
          const isWindow = heldPiece.type === 'WINDOW_SMALL' || heldPiece.type === 'WINDOW_LARGE'
          const isDecorative = isDecorativeSnappable(heldPiece.type)
          const yForSnap = (isWindow || isDecorative) ? targetSnapHeight.current : clampedPos.y

          const snapResult = calculateSnapPosition(
            heldPiece.type,
            [clampedPos.x, yForSnap, clampedPos.z],
            currentRotation.current,
            state.pieces,
            state.heldPieceId,
            state.walls,
            isDecorative ? scene : null // Pass scene for decorative roof snapping
          )

          if (snapResult.snapped) {
            finalPos = snapResult.position
            finalYaw = snapResult.yaw
            currentRotation.current = finalYaw // Update rotation to match snap
            isSnapped.current = true
            snappedToWallId.current = snapResult.targetId
            // Store snap info for decorative piece orientation
            state.setSnapInfo({
              surfaceType: snapResult.surfaceType,
              normal: snapResult.normal,
              targetId: snapResult.targetId
            })
          } else {
            isSnapped.current = false
            snappedToWallId.current = null
            state.setSnapInfo(null)
          }
        } else {
          isSnapped.current = false
          snappedToWallId.current = null
          state.setSnapInfo(null)
        }

        state.updatePieceTransform(state.heldPieceId, finalPos, finalYaw)
      }
    }

    // Handle right click - delete piece (only in select mode)
    const handleContextMenu = async (event) => {
      event.preventDefault()

      const state = useGameStore.getState()

      // Only handle piece deletion in 'select' mode
      if (state.buildMode !== 'select') return

      updateMousePosition(event)
      const intersection = raycastPieces()

      if (intersection) {
        const pieceId = intersection.object.userData.pieceId
        const piece = state.pieces.get(pieceId)

        // Only spawner can delete
        if (piece && piece.spawnedBy === state.userId) {
          await state.deletePiece(pieceId)
        }
      }
    }

    // Handle keyboard - rotation and mode switching
    const handleKeyDown = (event) => {
      const state = useGameStore.getState()
      const key = event.key.toLowerCase()

      // Mode switching shortcuts (only when not in an input field)
      if (!event.target.matches('input, textarea')) {
        switch (key) {
          case 'v':
            state.setBuildMode('select')
            return
          case 'w':
            state.setBuildMode('wall')
            return
          case 'i':
            state.setBuildMode('icing')
            return
          case 'g':
            state.toggleGridSnap()
            return
          case 'r':
            state.toggleRoofStyle()
            return
        }
      }

      // Piece rotation only works in select mode with held piece
      if (state.buildMode !== 'select' || !state.heldPieceId) return

      const heldPiece = state.pieces.get(state.heldPieceId)
      if (!heldPiece) return

      const isWindow = heldPiece.type === 'WINDOW_SMALL' || heldPiece.type === 'WINDOW_LARGE'
      const isDecorative = isDecorativeSnappable(heldPiece.type)

      // Handle height adjustment with arrow keys when snapped (windows and decoratives)
      if (isSnapped.current && (isWindow || isDecorative) && (key === 'arrowup' || key === 'arrowdown')) {
        const heightDelta = key === 'arrowup' ? SNAP_HEIGHT_STEP : -SNAP_HEIGHT_STEP
        targetSnapHeight.current = Math.max(
          SNAP_MIN_HEIGHT,
          Math.min(SNAP_MAX_HEIGHT, targetSnapHeight.current + heightDelta)
        )

        // Trigger a re-snap with new height
        const clampedPos = heldPiece.pos
        const snapResult = calculateSnapPosition(
          heldPiece.type,
          [clampedPos[0], targetSnapHeight.current, clampedPos[2]],
          currentRotation.current,
          state.pieces,
          state.heldPieceId,
          state.walls,
          isDecorative ? scene : null
        )

        if (snapResult.snapped) {
          state.updatePieceTransform(
            state.heldPieceId,
            snapResult.position,
            snapResult.yaw
          )
        }
        return
      }

      let rotationDelta = 0

      switch (key) {
        case 'q':
          rotationDelta = ROTATION_SPEED
          break
        case 'e':
          rotationDelta = -ROTATION_SPEED
          break
        case 'escape':
          // Cancel - release piece at current position
          if (heldPiece) {
            state.releasePiece(heldPiece.pos, currentRotation.current, snappedToWallId.current)
            isDragging.current = false
            isSnapped.current = false
            snappedToWallId.current = null
          }
          return
        default:
          return
      }

      // Don't allow rotation when piece is snapped to a wall
      if (isSnapped.current) {
        return
      }

      // Update rotation
      currentRotation.current += rotationDelta

      // Update piece transform
      if (heldPiece) {
        state.updatePieceTransform(
          state.heldPieceId,
          heldPiece.pos,
          currentRotation.current
        )
        playGlobalSound(SoundType.ROTATE)
      }
    }

    // Handle mouse wheel while holding - rotate or adjust window height (only in select mode)
    const handleWheel = (event) => {
      const state = useGameStore.getState()
      if (state.buildMode !== 'select' || !state.heldPieceId) return

      // Only handle if on canvas
      if (event.target !== canvas) return

      const heldPiece = state.pieces.get(state.heldPieceId)
      if (!heldPiece) return

      const isWindow = heldPiece.type === 'WINDOW_SMALL' || heldPiece.type === 'WINDOW_LARGE'
      const isDecorative = isDecorativeSnappable(heldPiece.type)

      // When snapped and holding a window or decorative, scroll adjusts height
      if (isSnapped.current && (isWindow || isDecorative)) {
        const heightDelta = event.deltaY > 0 ? -SNAP_HEIGHT_STEP : SNAP_HEIGHT_STEP
        targetSnapHeight.current = Math.max(
          SNAP_MIN_HEIGHT,
          Math.min(SNAP_MAX_HEIGHT, targetSnapHeight.current + heightDelta)
        )

        // Trigger a re-snap with new height by calling the snapping logic
        const clampedPos = heldPiece.pos
        const snapResult = calculateSnapPosition(
          heldPiece.type,
          [clampedPos[0], targetSnapHeight.current, clampedPos[2]],
          currentRotation.current,
          state.pieces,
          state.heldPieceId,
          state.walls,
          isDecorative ? scene : null
        )

        if (snapResult.snapped) {
          state.updatePieceTransform(
            state.heldPieceId,
            snapResult.position,
            snapResult.yaw
          )
        }
        return
      }

      // Don't allow rotation when piece is snapped to a wall
      if (isSnapped.current) {
        return
      }

      const rotationDelta = event.deltaY > 0 ? -ROTATION_SPEED : ROTATION_SPEED
      currentRotation.current += rotationDelta

      if (heldPiece) {
        state.updatePieceTransform(
          state.heldPieceId,
          heldPiece.pos,
          currentRotation.current
        )
        playGlobalSound(SoundType.ROTATE)
      }
    }

    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('keydown', handleKeyDown)
    canvas.addEventListener('wheel', handleWheel, { passive: true })

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('keydown', handleKeyDown)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [camera, gl, scene])

  // Sync rotation when piece is grabbed externally
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((state, prevState) => {
      if (state.heldPieceId && state.heldPieceId !== prevState.heldPieceId) {
        const piece = state.pieces.get(state.heldPieceId)
        if (piece) {
          currentRotation.current = piece.yaw || 0
          isDragging.current = true
        }
      } else if (!state.heldPieceId && prevState.heldPieceId) {
        isDragging.current = false
      }
    })

    return unsubscribe
  }, [])

  return null
}
