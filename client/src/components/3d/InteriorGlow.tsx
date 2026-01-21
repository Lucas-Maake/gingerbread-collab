import { useMemo, memo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import { GameState } from '../../types'

// Glow settings
const GLOW_COLOR = '#ffaa55' // Warm orange/amber
const GLOW_INTENSITY = 0.8
const GLOW_DISTANCE = 2.5
const WINDOW_GLOW_SCALE = 0.8
const DOOR_GLOW_SCALE = 1.2

// Shared geometries (created once, reused)
const innerSphereGeo = new THREE.SphereGeometry(1, 8, 8)
const outerSphereGeo = new THREE.SphereGeometry(1, 8, 8)

interface GlowLightProps {
    position: [number, number, number]
    normal: [number, number, number]
    scale: number
    color: string
}

/**
 * Single glow light for a window or door - memoized to prevent unnecessary re-renders
 */
const GlowLight = memo(function GlowLight({ position, normal, scale, color }: GlowLightProps) {
    // Offset the light slightly "inside" the house (opposite to the wall normal)
    const lightPosition = useMemo(() => {
        return [
            position[0] - normal[0] * 0.2,
            position[1],
            position[2] - normal[2] * 0.2
        ] as [number, number, number]
    }, [position, normal])

    const innerScale = 0.08 * scale
    const outerScale = 0.15 * scale

    return (
        <group position={lightPosition}>
            {/* Point light for illumination */}
            <pointLight
                color={color}
                intensity={GLOW_INTENSITY * scale}
                distance={GLOW_DISTANCE}
                decay={2}
            />

            {/* Visible glow sphere - using shared geometry */}
            <mesh geometry={innerSphereGeo} scale={innerScale}>
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.6}
                />
            </mesh>

            {/* Outer glow halo - using shared geometry */}
            <mesh geometry={outerSphereGeo} scale={outerScale}>
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.2}
                    side={THREE.BackSide}
                />
            </mesh>
        </group>
    )
})

interface GlowPosition {
    id: string
    position: [number, number, number]
    normal: [number, number, number]
    scale: number
}

// Selector that computes glow positions directly - only re-renders when actual data changes
const selectGlowPositions = (state: GameState): GlowPosition[] => {
    const positions: GlowPosition[] = []
    const { pieces, walls } = state

    for (const [id, piece] of pieces.entries()) {
        const isWindow = piece.type === 'WINDOW_SMALL' || piece.type === 'WINDOW_LARGE'
        const isDoor = piece.type === 'DOOR'

        if ((isWindow || isDoor) && piece.attachedTo && piece.pos) {
            const pos = piece.pos
            const attachedTo = piece.attachedTo

            // Determine the wall normal based on what it's attached to
            let normal: [number, number, number] = [0, 0, 1] // Default facing +Z

            // Check if attached to a pre-built wall piece
            const attachedPiece = pieces.get(attachedTo)
            if (attachedPiece) {
                const wallType = attachedPiece.type
                const wallPos = attachedPiece.pos || [0, 0, 0]

                if (wallType === 'WALL_FRONT' || wallType === 'WALL_BACK') {
                    const side = pos[2] >= wallPos[2] ? 1 : -1
                    normal = [0, 0, side]
                } else if (wallType === 'WALL_LEFT' || wallType === 'WALL_RIGHT') {
                    const side = pos[0] >= wallPos[0] ? 1 : -1
                    normal = [side, 0, 0]
                }
            }

            // Check if attached to a drawn wall
            const attachedWall = walls.get(attachedTo)
            if (attachedWall) {
                const [startX, startZ] = attachedWall.start
                const [endX, endZ] = attachedWall.end
                const wallDx = endX - startX
                const wallDz = endZ - startZ
                const wallLength = Math.sqrt(wallDx * wallDx + wallDz * wallDz)

                if (wallLength > 0.1) {
                    const wallDirX = wallDx / wallLength
                    const wallDirZ = wallDz / wallLength
                    const nx = -wallDirZ
                    const nz = wallDirX

                    const wallCenterX = (startX + endX) / 2
                    const wallCenterZ = (startZ + endZ) / 2
                    const toPieceX = pos[0] - wallCenterX
                    const toPieceZ = pos[2] - wallCenterZ
                    const side = (toPieceX * nx + toPieceZ * nz) >= 0 ? 1 : -1

                    normal = [nx * side, 0, nz * side]
                }
            }

            positions.push({
                id,
                position: pos,
                normal,
                scale: isDoor ? DOOR_GLOW_SCALE : WINDOW_GLOW_SCALE
            })
        }
    }

    return positions
}

// Custom equality - only re-render if glow positions actually changed
const glowPositionsEqual = (a: GlowPosition[], b: GlowPosition[]) => {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        if (a[i].id !== b[i].id) return false
        const pa = a[i].position, pb = b[i].position
        if (pa[0] !== pb[0] || pa[1] !== pb[1] || pa[2] !== pb[2]) return false
        const na = a[i].normal, nb = b[i].normal
        if (na[0] !== nb[0] || na[1] !== nb[1] || na[2] !== nb[2]) return false
    }
    return true
}

/**
 * InteriorGlow - Adds warm light emanating from windows and doors
 * Creates a cozy effect as if there's warm lighting inside the house
 */
export default function InteriorGlow() {
    // Use selector with custom equality to only re-render when glow data changes
    const glowPositions = useGameStore(selectGlowPositions, glowPositionsEqual)

    if (glowPositions.length === 0) return null

    return (
        <group name="interior-glow">
            {glowPositions.map(({ id, position, normal, scale }) => (
                <GlowLight
                    key={id}
                    position={position}
                    normal={normal}
                    scale={scale}
                    color={GLOW_COLOR}
                />
            ))}
        </group>
    )
}
