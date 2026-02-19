import { useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'

const BUILD_SURFACE_SIZE = 5 // Half-size, same as in InteractionManager
const GRID_Y = 0.02 // Slightly above surface to prevent z-fighting

export default function GridOverlay() {
    const gridSnapEnabled = useGameStore((state) => state.gridSnapEnabled)
    const gridSize = useGameStore((state) => state.gridSize)
    const buildMode = useGameStore((state) => state.buildMode)

    // Only show grid when snap is enabled and in a drawing mode
    const showGrid = gridSnapEnabled && (
        buildMode === 'wall' ||
        buildMode === 'fence' ||
        buildMode === 'icing'
    )

    const gridGeometry = useMemo(() => {
        if (!showGrid) return null

        const points: THREE.Vector3[] = []
        const size = BUILD_SURFACE_SIZE

        // Generate horizontal lines (along X axis, at different Z positions)
        for (let z = -size; z <= size; z += gridSize) {
            points.push(new THREE.Vector3(-size, GRID_Y, z))
            points.push(new THREE.Vector3(size, GRID_Y, z))
        }

        // Generate vertical lines (along Z axis, at different X positions)
        for (let x = -size; x <= size; x += gridSize) {
            points.push(new THREE.Vector3(x, GRID_Y, -size))
            points.push(new THREE.Vector3(x, GRID_Y, size))
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        return geometry
    }, [showGrid, gridSize])

    // Generate dots at intersections for better visibility
    const dotPositions = useMemo(() => {
        if (!showGrid) return null

        const positions: [number, number, number][] = []
        const size = BUILD_SURFACE_SIZE

        for (let x = -size; x <= size; x += gridSize) {
            for (let z = -size; z <= size; z += gridSize) {
                positions.push([x, GRID_Y + 0.01, z])
            }
        }

        return positions
    }, [showGrid, gridSize])

    if (!showGrid) return null

    return (
        <group>
            {/* Grid lines */}
            {gridGeometry && (
                <lineSegments geometry={gridGeometry}>
                    <lineBasicMaterial
                        color="#ffffff"
                        transparent
                        opacity={0.15}
                        depthWrite={false}
                    />
                </lineSegments>
            )}

            {/* Intersection dots */}
            {dotPositions && dotPositions.map((pos, i) => (
                <mesh key={i} position={pos}>
                    <circleGeometry args={[0.03, 8]} />
                    <meshBasicMaterial
                        color="#ffffff"
                        transparent
                        opacity={0.3}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                </mesh>
            ))}
        </group>
    )
}
