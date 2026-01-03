import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * Renders a piece using primitive geometry.
 * When GLTF models are added to public/models/, this can be extended to load them.
 */
export default function PieceModel({
  config,
  color,
  opacity = 1,
  emissive = '#000000',
  emissiveIntensity = 0,
  castShadow = true,
  receiveShadow = true
}) {
  // For now, always use fallback geometry
  // TODO: Add GLTF model loading when models are available
  return (
    <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
      <PrimitiveGeometry type={config.geometry} size={config.size} />
      <meshStandardMaterial
        color={color || config.color}
        roughness={0.6}
        metalness={0.1}
        opacity={opacity}
        transparent={opacity < 1}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  )
}

/**
 * Renders appropriate geometry based on type
 */
function PrimitiveGeometry({ type, size }) {
  switch (type) {
    case 'box':
      return <boxGeometry args={size} />
    case 'cylinder':
      return <cylinderGeometry args={size} />
    case 'cone':
      return <coneGeometry args={size} />
    case 'sphere':
      return <sphereGeometry args={size} />
    default:
      return <boxGeometry args={size} />
  }
}
