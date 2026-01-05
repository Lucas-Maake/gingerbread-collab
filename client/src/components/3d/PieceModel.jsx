import { Suspense, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Renders a piece using GLTF model if available, otherwise falls back to primitives.
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
  // If no model path, use fallback
  if (!config.model) {
    return (
      <FallbackGeometry
        config={config}
        color={color}
        opacity={opacity}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
      />
    )
  }

  // Try to load GLTF model with Suspense fallback
  return (
    <Suspense
      fallback={
        <FallbackGeometry
          config={config}
          color={color}
          opacity={opacity}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
        />
      }
    >
      <GLTFModel
        config={config}
        color={color}
        opacity={opacity}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
      />
    </Suspense>
  )
}

/**
 * Loads and renders a GLTF model
 */
function GLTFModel({
  config,
  color,
  opacity,
  emissive,
  emissiveIntensity,
  castShadow,
  receiveShadow
}) {
  const { scene } = useGLTF(config.model)

  // Clone scene and apply material overrides
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)

    clone.traverse((child) => {
      if (child.isMesh) {
        // Clone material to prevent shared state
        child.material = child.material.clone()

        // Apply color override if allowed
        if (config.allowColorOverride && color) {
          child.material.color = new THREE.Color(color)
        }

        // Apply opacity
        if (opacity < 1) {
          child.material.transparent = true
          child.material.opacity = opacity
        }

        // Apply emissive for hover effect
        if (emissive !== '#000000') {
          child.material.emissive = new THREE.Color(emissive)
          child.material.emissiveIntensity = emissiveIntensity
        }

        // Enable shadows
        child.castShadow = castShadow
        child.receiveShadow = receiveShadow
      }
    })

    return clone
  }, [scene, color, opacity, emissive, emissiveIntensity, config.allowColorOverride, castShadow, receiveShadow])

  const scale = config.modelScale || 1

  return <primitive object={clonedScene} scale={scale} />
}

/**
 * Fallback primitive geometry when model isn't available
 */
function FallbackGeometry({
  config,
  color,
  opacity,
  emissive,
  emissiveIntensity,
  castShadow,
  receiveShadow
}) {
  // Use custom tree geometry for trees
  if (config.geometry === 'tree') {
    return (
      <TreeGeometry
        config={config}
        color={color}
        opacity={opacity}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
      />
    )
  }

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

/**
 * Custom tree geometry - tiered Christmas tree with trunk
 */
function TreeGeometry({ config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }) {
  const treeColor = color || config.color
  const trunkColor = '#8B4513'

  return (
    <group>
      {/* Trunk */}
      <mesh position={[0, -0.18, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <cylinderGeometry args={[0.04, 0.05, 0.1, 8]} />
        <meshStandardMaterial
          color={trunkColor}
          roughness={0.8}
          metalness={0}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
      {/* Bottom tier - largest */}
      <mesh position={[0, -0.08, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <coneGeometry args={[0.18, 0.18, 8]} />
        <meshStandardMaterial
          color={treeColor}
          roughness={0.6}
          metalness={0.1}
          opacity={opacity}
          transparent={opacity < 1}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
      {/* Middle tier */}
      <mesh position={[0, 0.06, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <coneGeometry args={[0.14, 0.16, 8]} />
        <meshStandardMaterial
          color={treeColor}
          roughness={0.6}
          metalness={0.1}
          opacity={opacity}
          transparent={opacity < 1}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
      {/* Top tier - smallest */}
      <mesh position={[0, 0.18, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <coneGeometry args={[0.1, 0.14, 8]} />
        <meshStandardMaterial
          color={treeColor}
          roughness={0.6}
          metalness={0.1}
          opacity={opacity}
          transparent={opacity < 1}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
    </group>
  )
}
