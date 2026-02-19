import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import PieceModel from './PieceModel'
import { PIECE_CONFIGS } from '../../constants/pieceConfigs'
import { CANDY_COLORS, ROOF } from '../../constants/buildConfig'
import { PieceState } from '../../types'

// Re-export PIECE_CONFIGS for backward compatibility
export { PIECE_CONFIGS }

/**
 * Container for all pieces in the room
 */
export default function Pieces() {
    const pieces = useGameStore((state) => state.pieces)
    const userId = useGameStore((state) => state.userId)
    const heldPieceId = useGameStore((state) => state.heldPieceId)

    // Convert Map to array for rendering
    const pieceArray = useMemo(() => {
        return Array.from(pieces.values())
    }, [pieces])

    return (
        <group>
            {pieceArray.map((piece) => (
                <Piece
                    key={piece.pieceId}
                    piece={piece}
                    isLocallyHeld={piece.pieceId === heldPieceId}
                    isHeldByOther={piece.heldBy !== null && piece.heldBy !== userId}
                    localUserId={userId}
                />
            ))}
        </group>
    )
}

interface PieceProps {
    piece: PieceState
    isLocallyHeld: boolean
    isHeldByOther: boolean
    localUserId: string | null
}

/**
 * Individual piece component with geometry and interactions
 */
function Piece({ piece, isLocallyHeld, isHeldByOther, localUserId }: PieceProps) {
    const meshRef = useRef<THREE.Mesh>(null)
    const outlineRef = useRef<THREE.Mesh>(null)
    const [isHovered, setIsHovered] = useState(false)

    const config = PIECE_CONFIGS[piece.type] || PIECE_CONFIGS.GUMDROP
    const users = useGameStore((state) => state.users)
    const snapInfo = useGameStore((state) => state.snapInfo)
    const walls = useGameStore((state) => state.walls)
    const allPieces = useGameStore((state) => state.pieces)

    // Handle click on piece
    const handleClick = async (event: any) => {
        // Stop propagation to prevent other handlers
        event.stopPropagation()

        // Can't interact if held by someone else
        if (isHeldByOther) {
            console.log('Piece held by another user')
            return
        }

        const state = useGameStore.getState()
        const { heldPieceId, grabPiece, releasePiece } = state

        // If we're already holding this piece, release it
        if (heldPieceId === piece.pieceId) {
            console.log('Releasing piece:', piece.pieceId)
            // Prefer live snap info (if any), otherwise fall back to stored attachment.
            const currentSnapInfo = state.snapInfo
            const attachedTo = currentSnapInfo?.targetId ?? piece.attachedTo ?? null
            const snapNormal = currentSnapInfo?.normal ?? piece.snapNormal ?? null
            await releasePiece(
                piece.pos,
                piece.yaw,
                attachedTo,
                snapNormal
            )
            return
        }

        // If we're holding a different piece, don't grab this one
        if (heldPieceId) {
            console.log('Already holding another piece')
            return
        }

        // Try to grab this piece
        console.log('Attempting to grab piece:', piece.pieceId)
        const result = await grabPiece(piece.pieceId)
        if (result) {
            console.log('Successfully grabbed piece:', piece.pieceId)
        } else {
            console.log('Failed to grab piece')
        }
    }

    // Get holder color for outline
    const holderColor = useMemo(() => {
        if (piece.heldBy) {
            const holder = users.get(piece.heldBy)
            return holder?.color || '#ffffff'
        }
        return null
    }, [piece.heldBy, users])

    // Get holder name
    const holderName = useMemo(() => {
        if (piece.heldBy && piece.heldBy !== localUserId) {
            const holder = users.get(piece.heldBy)
            return holder?.name || 'Unknown'
        }
        return null
    }, [piece.heldBy, users, localUserId])

    // Candy color variation based on pieceId
    const pieceColor = useMemo(() => {
        if (['CANDY_CANE', 'GUMDROP', 'PEPPERMINT'].includes(piece.type)) {
            // Use pieceId hash for consistent random color
            const hash = piece.pieceId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
            return CANDY_COLORS[hash % CANDY_COLORS.length]
        }
        return config.color
    }, [piece.type, piece.pieceId, config.color])

    // Animate held pieces (float effect)
    useFrame((state) => {
        if (meshRef.current && isLocallyHeld) {
            const floatOffset = Math.sin(state.clock.elapsedTime * 4) * 0.03
            // Use 0 as base since group already has Y position
            meshRef.current.position.y = 0.15 + floatOffset
        }
    })

    // Position from piece state
    // For snappable pieces (doors, windows, decoratives), use actual Y position from state when snapped
    // For other pieces, use config.yOffset (ground-based)
    const basePosition = piece.pos || [0, 0, 0]
    const isWindowOrDoor = ['DOOR', 'WINDOW_SMALL', 'WINDOW_LARGE'].includes(piece.type)
    const isDecorativeSnappable = [
        'GUMDROP', 'PEPPERMINT', 'COOKIE_STAR', 'COOKIE_HEART', 'SNOWFLAKE',
        'CANDY_BUTTON', 'FROSTING_DOLLOP', 'PRESENT', 'CHIMNEY'
    ].includes(piece.type)
    const isSnappedPiece = piece.attachedTo !== null && piece.attachedTo !== undefined

    // Check if piece is currently being snapped (during drag) via snapInfo
    // Need to verify snapInfo structure for null check
    const isCurrentlySnapping = isLocallyHeld && snapInfo !== null

    // Use snapped Y position if piece is snapped (either released+attached or currently snapping)
    // For currently snapping pieces, basePosition already contains the snapped Y from updatePieceTransform
    const useSnappedY = (isWindowOrDoor || isDecorativeSnappable) && (isSnappedPiece || isCurrentlySnapping)
    const yPos = useSnappedY && basePosition[1] > 0.05
        ? basePosition[1]  // Use snapped Y position
        : (config.yOffset || 0)   // Use default ground-based offset
    const position: [number, number, number] = [
        basePosition[0],
        yPos + (isLocallyHeld ? 0.15 : 0),
        basePosition[2]
    ]

    // Calculate wall normal from attachedTo ID
    const getWallNormal = (attachedToId: string): [number, number, number] | null => {
        if (!attachedToId || attachedToId === 'roof') return null

        // Check if it's a drawn wall
        const drawnWall = walls.get(attachedToId)
        if (drawnWall) {
            // Calculate normal from wall start/end points
            const [startX, startZ] = drawnWall.start
            const [endX, endZ] = drawnWall.end
            const wallDx = endX - startX
            const wallDz = endZ - startZ
            const wallLength = Math.sqrt(wallDx * wallDx + wallDz * wallDz)
            if (wallLength < 0.1) return null
            // Perpendicular to wall direction
            const nx = -wallDz / wallLength
            const nz = wallDx / wallLength
            // Determine side based on piece position relative to wall
            const piecePos = piece.pos || [0, 0, 0]
            const wallCenterX = (startX + endX) / 2
            const wallCenterZ = (startZ + endZ) / 2
            const toPieceX = piecePos[0] - wallCenterX
            const toPieceZ = piecePos[2] - wallCenterZ
            const side = (toPieceX * nx + toPieceZ * nz) >= 0 ? 1 : -1
            return [nx * side, 0, nz * side]
        }

        // Check if it's a pre-built wall piece
        const wallPiece = allPieces.get(attachedToId)
        if (wallPiece) {
            const wallType = wallPiece.type
            const piecePos = piece.pos || [0, 0, 0]
            const wallPos = (wallPiece.pos as [number, number, number]) || [0, 0, 0]
            if (wallType === 'WALL_FRONT' || wallType === 'WALL_BACK') {
                const side = piecePos[2] >= wallPos[2] ? 1 : -1
                return [0, 0, side]
            } else if (wallType === 'WALL_LEFT' || wallType === 'WALL_RIGHT') {
                const side = piecePos[0] >= wallPos[0] ? 1 : -1
                return [side, 0, 0]
            }
        }

        return null
    }

    const resolveSurfaceInfo = () => {
        let surfaceType = null
        let normal = null

        if (isLocallyHeld && snapInfo) {
            surfaceType = snapInfo.surfaceType
            normal = snapInfo.normal
        } else if (isSnappedPiece) {
            surfaceType = piece.attachedTo === 'roof' ? 'roof' : 'wall'
            normal = piece.snapNormal || null
            if (!normal && surfaceType === 'wall' && piece.attachedTo) {
                normal = getWallNormal(piece.attachedTo)
            }
        }

        return { surfaceType, normal }
    }

    const { surfaceType, normal } = resolveSurfaceInfo()

    // Calculate rotation for decorative pieces on walls and roofs
    // - On walls: pieces lay flat against the wall surface
    // - On roofs: pieces tilt to lay flat on the sloped surface
    const calculateWallRotation = (): [number, number, number] => {
        if (!isDecorativeSnappable) {
            return [config.rotationX || 0, piece.yaw || 0, 0]
        }

        const orientDecorativeToNormal = (surfaceNormal: [number, number, number]): [number, number, number] => {
            const normalVec = new THREE.Vector3(surfaceNormal[0], surfaceNormal[1], surfaceNormal[2]).normalize()
            const worldUp = new THREE.Vector3(0, 1, 0)

            // Use world up projected onto the surface to keep decorative pieces upright
            let upInPlane = worldUp.clone().projectOnPlane(normalVec)
            if (upInPlane.lengthSq() < 1e-6) {
                upInPlane = new THREE.Vector3(0, 0, -1).projectOnPlane(normalVec)
            }
            upInPlane.normalize()

            const yAxis = normalVec
            let zAxis = upInPlane.clone().negate() // Local -Z points "up" for flat decorative shapes
            let xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize()
            zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize()

            const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
            const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix)
            const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ')

            return [euler.x, euler.y, euler.z]
        }

        // For roof surfaces: orient piece to lay flat on the sloped roof
        if (surfaceType === 'roof') {
            if (piece.type === 'CHIMNEY') {
                return [config.rotationX || 0, piece.yaw || 0, 0]
            }
            // Use stored or live normal to orient piece on roof
            if (normal && Array.isArray(normal) && normal.length >= 3) {
                return orientDecorativeToNormal([normal[0], normal[1], normal[2]])
            }

            // Fallback for legacy pieces without stored snapNormal:
            // Default to a reasonable roof angle based on piece position
            const piecePos = piece.pos || [0, 0, 0]
            const roofAngle = ROOF.ANGLE_RADIANS // Use centralized constant
            const isLeftRoof = piecePos[0] < 0
            const signedAngle = isLeftRoof ? roofAngle : -roofAngle
            const normalY = Math.cos(signedAngle)
            const normalZ = Math.sin(signedAngle)
            const roofNormal = new THREE.Vector3(0, normalY, normalZ).normalize()
            return orientDecorativeToNormal([roofNormal.x, roofNormal.y, roofNormal.z])
        }

        // No snap or unrecognized surface - piece sits normally
        if (surfaceType !== 'wall') {
            return [config.rotationX || 0, piece.yaw || 0, 0]
        }

        // For walls: use quaternion to align piece's Y-axis with the wall normal
        // This makes the piece lay flat against the wall surface
        if (normal && Array.isArray(normal) && normal.length >= 3) {
            return orientDecorativeToNormal([normal[0], normal[1], normal[2]])
        }

        // Fallback: use the yaw with a -90° pitch
        const yaw = piece.yaw || 0
        return [-Math.PI / 2, yaw, 0]
    }

    // Rotation - apply piece yaw plus any config rotation
    const rotation: [number, number, number] = calculateWallRotation()

    // Determine if piece can be interacted with
    const canInteract = !isHeldByOther

    // Get bounding size for hit detection and outlines
    const boundingSize: [number, number, number] = config.boundingSize || config.size

    return (
        <group position={position} rotation={rotation}>
            {/* Invisible hit box for raycasting */}
            <mesh
                ref={meshRef}
                userData={{ pieceId: piece.pieceId, type: piece.type }}
                onClick={handleClick}
                onPointerOver={() => canInteract && setIsHovered(true)}
                onPointerOut={() => setIsHovered(false)}
            >
                <boxGeometry args={boundingSize} />
                <meshBasicMaterial visible={false} />
            </mesh>

            {/* Visible piece model (or fallback geometry) */}
            <PieceModel
                config={config}
                color={pieceColor}
                opacity={isHeldByOther ? 0.7 : 1}
                emissive={isHovered && canInteract ? pieceColor : '#000000'}
                emissiveIntensity={isHovered && canInteract ? 0.2 : 0}
                snapSurface={surfaceType}
                snapNormal={normal}
            />

            {/* Outline when held */}
            {piece.heldBy && (
                <mesh ref={outlineRef} scale={[1.08, 1.08, 1.08]}>
                    <boxGeometry args={boundingSize} />
                    <meshBasicMaterial
                        color={holderColor || '#ffffff'}
                        transparent
                        opacity={0.4}
                        side={THREE.BackSide}
                    />
                </mesh>
            )}

            {/* Glow ring when locally held */}
            {isLocallyHeld && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -config.yOffset + 0.02, 0]}>
                    <ringGeometry args={[0.3, 0.5, 32]} />
                    <meshBasicMaterial
                        color={holderColor || '#00ff00'}
                        transparent
                        opacity={0.5}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}

            {/* Hover outline */}
            {isHovered && canInteract && !piece.heldBy && (
                <mesh scale={[1.05, 1.05, 1.05]}>
                    <boxGeometry args={boundingSize} />
                    <meshBasicMaterial
                        color="#ffffff"
                        transparent
                        opacity={0.3}
                        side={THREE.BackSide}
                    />
                </mesh>
            )}

            {/* "Held by" label for pieces held by others */}
            {holderName && (
                <Billboard position={[0, boundingSize[1] / 2 + 0.4, 0]}>
                    <Text
                        fontSize={0.12}
                        color={holderColor || '#ffffff'}
                        anchorX="center"
                        anchorY="bottom"
                        outlineWidth={0.015}
                        outlineColor="#000000"
                    >
                        {`Held by ${holderName}`}
                    </Text>
                </Billboard>
            )}

            {/* Lock indicator for held pieces */}
            {isHeldByOther && (
                <mesh position={[0, boundingSize[1] / 2 + 0.2, 0]}>
                    <sphereGeometry args={[0.06, 8, 8]} />
                    <meshBasicMaterial color={holderColor || '#ffffff'} />
                </mesh>
            )}
        </group>
    )
}
