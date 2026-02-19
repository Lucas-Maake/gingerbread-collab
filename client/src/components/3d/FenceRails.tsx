import { useMemo } from 'react'
import { useGameStore } from '../../context/gameStore'

const RAIL_COLOR = '#B87A3D'
const RAIL_EMISSIVE = '#2a1810'
const RAIL_HEIGHTS = [0.15, 0.26]
const RAIL_THICKNESS = 0.028
const RAIL_DEPTH = 0.028
const POST_CLEARANCE = 0.08
const NEIGHBOR_OFFSETS: [number, number][] = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
]

interface FenceSegment {
    key: string
    midX: number
    midZ: number
    rotationY: number
    length: number
}

function sanitizeSpacing(spacing: number) {
    if (!Number.isFinite(spacing) || spacing <= 0) return 0.5
    return spacing
}

/**
 * Renders horizontal rails between adjacent placed fence posts.
 */
export default function FenceRails() {
    const pieces = useGameStore((state) => state.pieces)
    const gridSize = useGameStore((state) => state.gridSize)

    const segments = useMemo(() => {
        const spacing = sanitizeSpacing(gridSize)
        const maxNeighborDistance = spacing * Math.SQRT2 + 0.02

        const postMap = new Map<string, [number, number]>()
        for (const piece of pieces.values()) {
            if (piece.type !== 'FENCE_POST' || piece.heldBy !== null) continue
            const gridX = Math.round(piece.pos[0] / spacing)
            const gridZ = Math.round(piece.pos[2] / spacing)
            postMap.set(`${gridX}:${gridZ}`, [piece.pos[0], piece.pos[2]])
        }

        const computedSegments: FenceSegment[] = []

        for (const [key, fromPos] of postMap.entries()) {
            const [gridXStr, gridZStr] = key.split(':')
            const gridX = Number(gridXStr)
            const gridZ = Number(gridZStr)

            for (const [offsetX, offsetZ] of NEIGHBOR_OFFSETS) {
                const neighborKey = `${gridX + offsetX}:${gridZ + offsetZ}`
                const toPos = postMap.get(neighborKey)
                if (!toPos) continue

                const dx = toPos[0] - fromPos[0]
                const dz = toPos[1] - fromPos[1]
                const distance = Math.sqrt(dx * dx + dz * dz)
                if (distance > maxNeighborDistance) continue

                const railLength = distance - POST_CLEARANCE
                if (railLength <= 0.04) continue

                computedSegments.push({
                    key: `${key}|${neighborKey}`,
                    midX: (fromPos[0] + toPos[0]) / 2,
                    midZ: (fromPos[1] + toPos[1]) / 2,
                    rotationY: -Math.atan2(dz, dx),
                    length: railLength
                })
            }
        }

        return computedSegments
    }, [pieces, gridSize])

    if (segments.length === 0) return null

    return (
        <group name="fence-rails">
            {segments.map((segment) => (
                <group
                    key={segment.key}
                    position={[segment.midX, 0, segment.midZ]}
                    rotation={[0, segment.rotationY, 0]}
                >
                    {RAIL_HEIGHTS.map((railHeight, index) => (
                        <mesh
                            key={`${segment.key}:${index}`}
                            position={[0, railHeight, 0]}
                            castShadow
                            receiveShadow
                        >
                            <boxGeometry args={[segment.length, RAIL_THICKNESS, RAIL_DEPTH]} />
                            <meshStandardMaterial
                                color={RAIL_COLOR}
                                emissive={RAIL_EMISSIVE}
                                emissiveIntensity={0.08}
                                roughness={0.8}
                                metalness={0.02}
                            />
                        </mesh>
                    ))}
                </group>
            ))}
        </group>
    )
}
