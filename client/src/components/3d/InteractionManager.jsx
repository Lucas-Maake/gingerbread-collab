import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import { calculateSnapPosition, isSnappable } from '../../utils/snapping'
import { playGlobalSound, SoundType } from '../../hooks/useSoundEffects'

// Constants from PRD
const BUILD_SURFACE_SIZE = 10
const ROTATION_SPEED = Math.PI / 8 // 22.5 degrees per press
const DRAG_PLANE_Y = 0.1 // Slightly above surface

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
      const { heldPieceId, releasePiece } = state

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
        if (heldPiece && isSnappable(heldPiece.type)) {
          const snapResult = calculateSnapPosition(
            heldPiece.type,
            finalPos,
            finalYaw,
            state.pieces,
            heldPieceId
          )
          if (snapResult.snapped) {
            finalPos = snapResult.position
            finalYaw = snapResult.yaw
          }
        }

        console.log('Releasing piece at:', finalPos)
        await releasePiece(finalPos, finalYaw)
        isDragging.current = false
        isSnapped.current = false
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

      // If dragging, update piece position
      const state = useGameStore.getState()
      if (isDragging.current && state.heldPieceId) {
        const heldPiece = state.pieces.get(state.heldPieceId)
        if (!heldPiece) return

        const clampedPos = clampToBounds(point)
        let finalPos = [clampedPos.x, clampedPos.y, clampedPos.z]
        let finalYaw = currentRotation.current

        // Check for snapping if this piece type can snap
        if (isSnappable(heldPiece.type)) {
          const snapResult = calculateSnapPosition(
            heldPiece.type,
            [clampedPos.x, clampedPos.y, clampedPos.z],
            currentRotation.current,
            state.pieces,
            state.heldPieceId
          )

          if (snapResult.snapped) {
            finalPos = snapResult.position
            finalYaw = snapResult.yaw
            currentRotation.current = finalYaw // Update rotation to match snap
            isSnapped.current = true
          } else {
            isSnapped.current = false
          }
        } else {
          isSnapped.current = false
        }

        state.updatePieceTransform(state.heldPieceId, finalPos, finalYaw)
      }
    }

    // Handle right click - delete piece
    const handleContextMenu = async (event) => {
      event.preventDefault()

      updateMousePosition(event)
      const intersection = raycastPieces()

      if (intersection) {
        const pieceId = intersection.object.userData.pieceId
        const state = useGameStore.getState()
        const piece = state.pieces.get(pieceId)

        // Only spawner can delete
        if (piece && piece.spawnedBy === state.userId) {
          await state.deletePiece(pieceId)
        }
      }
    }

    // Handle keyboard - rotation
    const handleKeyDown = (event) => {
      const state = useGameStore.getState()
      if (!state.heldPieceId) return

      let rotationDelta = 0

      switch (event.key.toLowerCase()) {
        case 'q':
          rotationDelta = ROTATION_SPEED
          break
        case 'e':
          rotationDelta = -ROTATION_SPEED
          break
        case 'escape':
          // Cancel - release piece at current position
          const piece = state.pieces.get(state.heldPieceId)
          if (piece) {
            state.releasePiece(piece.pos, currentRotation.current)
            isDragging.current = false
            isSnapped.current = false
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
      const piece = state.pieces.get(state.heldPieceId)
      if (piece) {
        state.updatePieceTransform(
          state.heldPieceId,
          piece.pos,
          currentRotation.current
        )
        playGlobalSound(SoundType.ROTATE)
      }
    }

    // Handle mouse wheel while holding - also rotate
    const handleWheel = (event) => {
      const state = useGameStore.getState()
      if (!state.heldPieceId) return

      // Only handle if on canvas
      if (event.target !== canvas) return

      // Don't allow rotation when piece is snapped to a wall
      if (isSnapped.current) {
        return
      }

      const rotationDelta = event.deltaY > 0 ? -ROTATION_SPEED : ROTATION_SPEED
      currentRotation.current += rotationDelta

      const piece = state.pieces.get(state.heldPieceId)
      if (piece) {
        state.updatePieceTransform(
          state.heldPieceId,
          piece.pos,
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
