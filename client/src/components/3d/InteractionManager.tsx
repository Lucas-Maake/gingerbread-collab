import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import { calculateSnapPosition, calculateSnapFromSurfaceHit, isSnappable, isDecorativeSnappable, isSnapTarget } from '../../utils/snapping'
import { playGlobalSound, SoundType } from '../../hooks/useSoundEffects'
import { BUILD_SURFACE, INTERACTION, SNAP } from '../../constants/buildConfig'
import type { SnapResult, SurfaceType } from '../../types'

// Use centralized constants
const BUILD_SURFACE_SIZE = BUILD_SURFACE.SIZE
const ROTATION_SPEED = INTERACTION.ROTATION_SPEED
const DRAG_PLANE_Y = INTERACTION.DRAG_PLANE_Y
const SNAP_HEIGHT_STEP = SNAP.HEIGHT_STEP
const SNAP_MIN_HEIGHT = SNAP.MIN_HEIGHT
const SNAP_MAX_HEIGHT = SNAP.MAX_HEIGHT

/**
 * InteractionManager - Handles all piece interactions
 * - Raycasting for piece selection
 * - Drag and drop on XZ plane
 * - Rotation with Q/E keys
 * - Cursor position tracking
 */
export default function InteractionManager() {
    const { camera, gl, scene } = useThree()
    const pieceCount = useGameStore((state) => state.pieceCount)
    const wallCount = useGameStore((state) => state.walls.size)

    // Refs for interaction state
    const raycaster = useRef(new THREE.Raycaster())
    const mouse = useRef(new THREE.Vector2())
    const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y))
    const intersectPoint = useRef(new THREE.Vector3())
    const isDragging = useRef(false)
    const currentRotation = useRef(0)
    const lastCursorUpdate = useRef(0)
    const isSnapped = useRef(false) // Track if piece is currently snapped
    const snappedToWallId = useRef<string | null>(null) // Track which wall the piece is snapped to
    const targetSnapHeight = useRef(0.75) // Target Y height for snapped pieces (adjustable with scroll)
    const pieceMeshesRef = useRef<THREE.Object3D[]>([])
    const wallMeshesRef = useRef<THREE.Object3D[]>([])
    const roofMeshesRef = useRef<THREE.Object3D[]>([])
    const buildSurfaceMeshesRef = useRef<THREE.Object3D[]>([])

    // Cache interactable meshes to avoid scene traversal on each pointer event.
    useEffect(() => {
        const pieceMeshes: THREE.Object3D[] = []
        const wallMeshes: THREE.Object3D[] = []
        const roofMeshes: THREE.Object3D[] = []
        const buildSurfaceMeshes: THREE.Object3D[] = []

        scene.traverse((child) => {
            if (!(child as THREE.Mesh).isMesh) return

            if (child.userData?.pieceId) {
                pieceMeshes.push(child)
                return
            }

            if (child.userData?.wallId) {
                wallMeshes.push(child)
                return
            }

            if (child.parent?.name === 'auto-roofs') {
                roofMeshes.push(child)
                return
            }

            if (child.name === 'build-surface' || child.userData?.isBuildSurface) {
                buildSurfaceMeshes.push(child)
            }
        })

        pieceMeshesRef.current = pieceMeshes
        wallMeshesRef.current = wallMeshes
        roofMeshesRef.current = roofMeshes
        buildSurfaceMeshesRef.current = buildSurfaceMeshes
    }, [scene, pieceCount, wallCount])

    // Set up event listeners - use getState() to avoid stale closures
    useEffect(() => {
        const canvas = gl.domElement

        // Helper: Update mouse position
        const updateMousePosition = (event: MouseEvent) => {
            const rect = canvas.getBoundingClientRect()
            mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
            mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
        }

        // Helper: Raycast to find pieces
        const raycastPieces = () => {
            raycaster.current.setFromCamera(mouse.current, camera)

            if (pieceMeshesRef.current.length === 0) {
                return null
            }

            const intersects = raycaster.current.intersectObjects(pieceMeshesRef.current, false)
            return intersects.length > 0 ? intersects[0] : null
        }

        // Helper: Raycast to build surface plane
        const raycastToPlane = () => {
            raycaster.current.setFromCamera(mouse.current, camera)
            raycaster.current.ray.intersectPlane(dragPlane.current, intersectPoint.current)
            return intersectPoint.current.clone()
        }

        const raycastToSurface = (state: ReturnType<typeof useGameStore.getState>) => {
            raycaster.current.setFromCamera(mouse.current, camera)

            const heldPieceId = state.heldPieceId

            const snapTargetMeshes = pieceMeshesRef.current.filter((child) => {
                const pieceId = child.userData?.pieceId
                if (!pieceId || pieceId === heldPieceId) {
                    return false
                }

                const piece = state.pieces.get(pieceId)
                return Boolean(piece && isSnapTarget(piece.type))
            })

            const surfaces: THREE.Object3D[] = [
                ...wallMeshesRef.current,
                ...roofMeshesRef.current,
                ...buildSurfaceMeshesRef.current,
                ...snapTargetMeshes
            ]

            if (surfaces.length === 0) return null

            const intersects = raycaster.current.intersectObjects(surfaces, false)
            if (intersects.length === 0) return null

            const hit = intersects[0]
            const point = hit.point.clone()
            const normal = hit.face?.normal?.clone() || new THREE.Vector3(0, 1, 0)
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object!.matrixWorld)
            normal.applyMatrix3(normalMatrix).normalize()

            let surfaceType: SurfaceType = null
            let targetId: string | null = null

            if (hit.object.userData?.wallId) {
                surfaceType = 'wall'
                targetId = hit.object.userData.wallId
            } else if (hit.object.parent?.name === 'auto-roofs') {
                surfaceType = 'roof'
                targetId = 'roof'
            } else if (hit.object.userData?.pieceId) {
                surfaceType = 'wall'
                targetId = hit.object.userData.pieceId
            } else if (hit.object.name === 'build-surface' || hit.object.userData?.isBuildSurface) {
                if (normal.y < 0.9) return null
                surfaceType = 'ground'
                targetId = null
            }

            if (!surfaceType) return null

            if (surfaceType === 'roof' && normal.y < 0) {
                normal.negate()
            }

            return {
                point,
                normal,
                surfaceType,
                targetId
            }
        }

        // Helper: Clamp position to build surface bounds
        const clampToBounds = (position: THREE.Vector3) => {
            const halfSize = BUILD_SURFACE_SIZE / 2
            return new THREE.Vector3(
                THREE.MathUtils.clamp(position.x, -halfSize, halfSize),
                DRAG_PLANE_Y,
                THREE.MathUtils.clamp(position.z, -halfSize, halfSize)
            )
        }

        const getSnapOptions = (
            state: ReturnType<typeof useGameStore.getState>,
            heldPiece?: { attachedTo?: string | null }
        ) => {
            const snapSurface = state.snapInfo?.surfaceType
            const preferredSnapSurface = (snapSurface === 'wall' || snapSurface === 'roof') ? snapSurface : null
            const attachedSurface = heldPiece?.attachedTo === 'roof' ? 'roof' : heldPiece?.attachedTo ? 'wall' : null
            const preferSurface = preferredSnapSurface ?? attachedSurface
            const wallSnapDistance = preferSurface === 'wall' ? SNAP.DISTANCE * 1.5 : SNAP.DISTANCE
            return { preferSurface, wallSnapDistance }
        }

        // Handle mouse down - release piece when clicking on empty space
        const handleMouseDown = async (event: MouseEvent) => {
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
                const surfaceHit = raycastToSurface(state)
                const point = raycastToPlane()
                const clampedPos = clampToBounds(point)
                let finalPos: [number, number, number] = [clampedPos.x, clampedPos.y, clampedPos.z]
                let finalYaw = currentRotation.current

                // Apply snapping for release position
                let attachedTo: string | null = null
                let snapNormal: [number, number, number] | null = null
                if (heldPiece && isSnappable(heldPiece.type)) {
                    // For windows and decoratives, use the adjustable target height
                    const isWindow = heldPiece.type === 'WINDOW_SMALL' || heldPiece.type === 'WINDOW_LARGE'
                    const isDecorative = isDecorativeSnappable(heldPiece.type)
                    const yForSnap = (isWindow || isDecorative) ? targetSnapHeight.current : clampedPos.y
                    const snapOptions = getSnapOptions(state, heldPiece)

                    let snapResult: SnapResult | null = null
                    if (surfaceHit && (surfaceHit.surfaceType === 'wall' || surfaceHit.surfaceType === 'roof')) {
                        snapResult = calculateSnapFromSurfaceHit(
                            heldPiece.type,
                            [surfaceHit.point.x, surfaceHit.point.y, surfaceHit.point.z],
                            [surfaceHit.normal.x, surfaceHit.normal.y, surfaceHit.normal.z],
                            surfaceHit.surfaceType,
                            surfaceHit.targetId,
                            state.pieces,
                            state.walls,
                            snapOptions
                        )
                    }

                    if (!snapResult || !snapResult.snapped) {
                        if (!surfaceHit || surfaceHit.surfaceType === 'ground') {
                            snapResult = calculateSnapPosition(
                                heldPiece.type,
                                [clampedPos.x, yForSnap, clampedPos.z],
                                finalYaw,
                                state.pieces,
                                heldPieceId,
                                state.walls,
                                isDecorative ? scene : null, // Pass scene for decorative roof snapping
                                snapOptions
                            )
                        }
                    }

                    if (snapResult.snapped) {
                        finalPos = snapResult.position
                        finalYaw = snapResult.yaw
                        attachedTo = snapResult.targetId || null // Track which wall/roof it's attached to
                        snapNormal = snapResult.normal || null // Capture the surface normal for orientation
                    }
                }

                console.log('Releasing piece at:', finalPos, 'attached to:', attachedTo, 'normal:', snapNormal)
                await releasePiece(finalPos, finalYaw, attachedTo, snapNormal)
                isDragging.current = false
                isSnapped.current = false
                snappedToWallId.current = null
            }
        }

        // Handle mouse move - drag piece and update cursor
        const handleMouseMove = (event: MouseEvent) => {
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

                const surfaceHit = raycastToSurface(state)
                const clampedPos = clampToBounds(point)
                let finalPos: [number, number, number] = [clampedPos.x, clampedPos.y, clampedPos.z]
                let finalYaw = currentRotation.current

                // Check for snapping if this piece type can snap
                if (isSnappable(heldPiece.type)) {
                    // For windows and decoratives, use the adjustable target height
                    const isWindow = heldPiece.type === 'WINDOW_SMALL' || heldPiece.type === 'WINDOW_LARGE'
                    const isDecorative = isDecorativeSnappable(heldPiece.type)
                    const yForSnap = (isWindow || isDecorative) ? targetSnapHeight.current : clampedPos.y
                    const snapOptions = getSnapOptions(state, heldPiece)

                    let snapResult: SnapResult | null = null
                    if (surfaceHit && (surfaceHit.surfaceType === 'wall' || surfaceHit.surfaceType === 'roof')) {
                        snapResult = calculateSnapFromSurfaceHit(
                            heldPiece.type,
                            [surfaceHit.point.x, surfaceHit.point.y, surfaceHit.point.z],
                            [surfaceHit.normal.x, surfaceHit.normal.y, surfaceHit.normal.z],
                            surfaceHit.surfaceType,
                            surfaceHit.targetId,
                            state.pieces,
                            state.walls,
                            snapOptions
                        )
                    }

                    if (!snapResult || !snapResult.snapped) {
                        if (!surfaceHit || surfaceHit.surfaceType === 'ground') {
                            snapResult = calculateSnapPosition(
                                heldPiece.type,
                                [clampedPos.x, yForSnap, clampedPos.z],
                                currentRotation.current,
                                state.pieces,
                                state.heldPieceId,
                                state.walls,
                                isDecorative ? scene : null, // Pass scene for decorative roof snapping
                                snapOptions
                            )
                        }
                    }

                    if (snapResult.snapped) {
                        finalPos = snapResult.position
                        finalYaw = snapResult.yaw
                        currentRotation.current = finalYaw // Update rotation to match snap
                        isSnapped.current = true
                        snappedToWallId.current = snapResult.targetId || null
                        // Store snap info for decorative piece orientation and visual indicator
                        state.setSnapInfo({
                            surfaceType: snapResult.surfaceType || null,
                            normal: snapResult.normal || null,
                            targetId: snapResult.targetId || undefined,
                            position: snapResult.position // For snap indicator display
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
        const handleContextMenu = async (event: MouseEvent) => {
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
        const handleKeyDown = (event: KeyboardEvent) => {
            const state = useGameStore.getState()
            const key = event.key.toLowerCase()

            // Mode switching shortcuts (only when not in an input field)
            if (event.target instanceof HTMLElement && !event.target.matches('input, textarea')) {
                switch (key) {
                    case 'v':
                        state.setBuildMode('select')
                        return
                    case 'w':
                        state.setBuildMode('wall')
                        return
                    case 'f':
                        state.setBuildMode('fence')
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
                if (!clampedPos) return // Should not happen if heldPiece exists

                const snapResult = calculateSnapPosition(
                    heldPiece.type,
                    [clampedPos[0], targetSnapHeight.current, clampedPos[2]],
                    currentRotation.current,
                    state.pieces,
                    state.heldPieceId,
                    state.walls,
                    isDecorative ? scene : null,
                    getSnapOptions(state, heldPiece)
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
                    if (heldPiece && heldPiece.pos) {
                        const currentSnapInfo = state.snapInfo
                        const attachedTo = isSnapped.current
                            ? (snappedToWallId.current || currentSnapInfo?.targetId || heldPiece.attachedTo || null)
                            : null
                        const snapNormal = isSnapped.current
                            ? (currentSnapInfo?.normal || heldPiece.snapNormal || null)
                            : null
                        state.releasePiece(heldPiece.pos, currentRotation.current, attachedTo, snapNormal)
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
            if (heldPiece && heldPiece.pos) {
                state.updatePieceTransform(
                    state.heldPieceId,
                    heldPiece.pos,
                    currentRotation.current
                )
                playGlobalSound(SoundType.ROTATE)
            }
        }

        // Handle mouse wheel while holding - rotate or adjust window height (only in select mode)
        const handleWheel = (event: WheelEvent) => {
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
                if (!clampedPos) return

                const snapResult = calculateSnapPosition(
                    heldPiece.type,
                    [clampedPos[0], targetSnapHeight.current, clampedPos[2]],
                    currentRotation.current,
                    state.pieces,
                    state.heldPieceId,
                    state.walls,
                    isDecorative ? scene : null,
                    getSnapOptions(state, heldPiece)
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

            if (heldPiece && heldPiece.pos) {
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
                    snappedToWallId.current = piece.attachedTo || null
                    isSnapped.current = piece.attachedTo !== null

                    const isWindow = piece.type === 'WINDOW_SMALL' || piece.type === 'WINDOW_LARGE'
                    const isDecorative = isDecorativeSnappable(piece.type)
                    if ((isWindow || isDecorative) && piece.pos) {
                        targetSnapHeight.current = Math.max(
                            SNAP_MIN_HEIGHT,
                            Math.min(SNAP_MAX_HEIGHT, piece.pos[1])
                        )
                    }
                }
            } else if (!state.heldPieceId && prevState.heldPieceId) {
                isDragging.current = false
                isSnapped.current = false
                snappedToWallId.current = null
            }
        })

        return unsubscribe
    }, [])

    return null
}
