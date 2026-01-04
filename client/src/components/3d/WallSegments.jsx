import { useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'

// Gingerbread wall color
const WALL_COLOR = '#8B4513'
const WALL_EMISSIVE = '#2a1507'

/**
 * Single wall segment component
 */
function WallSegment({ wall, isOwner, onDelete }) {
  const geometry = useMemo(() => {
    const [startX, startZ] = wall.start
    const [endX, endZ] = wall.end

    // Calculate wall dimensions
    const dx = endX - startX
    const dz = endZ - startZ
    const length = Math.sqrt(dx * dx + dz * dz)

    // Prevent zero-length walls
    if (length < 0.1) return null

    return {
      position: [(startX + endX) / 2, wall.height / 2, (startZ + endZ) / 2],
      rotation: [0, -Math.atan2(dz, dx), 0],
      args: [length, wall.height, wall.thickness]
    }
  }, [wall])

  if (!geometry) return null

  const handleContextMenu = (e) => {
    if (isOwner && onDelete) {
      e.stopPropagation()
      onDelete(wall.wallId)
    }
  }

  return (
    <mesh
      position={geometry.position}
      rotation={geometry.rotation}
      castShadow
      receiveShadow
      userData={{ wallId: wall.wallId }}
      onContextMenu={handleContextMenu}
    >
      <boxGeometry args={geometry.args} />
      <meshStandardMaterial
        color={WALL_COLOR}
        emissive={WALL_EMISSIVE}
        emissiveIntensity={0.1}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  )
}

/**
 * Renders all wall segments from game state
 */
export default function WallSegments() {
  const walls = useGameStore((state) => state.walls)
  const userId = useGameStore((state) => state.userId)
  const deleteWall = useGameStore((state) => state.deleteWall)

  const wallArray = useMemo(() => {
    return Array.from(walls.values())
  }, [walls])

  return (
    <group name="wall-segments">
      {wallArray.map((wall) => (
        <WallSegment
          key={wall.wallId}
          wall={wall}
          isOwner={wall.createdBy === userId}
          onDelete={deleteWall}
        />
      ))}
    </group>
  )
}
