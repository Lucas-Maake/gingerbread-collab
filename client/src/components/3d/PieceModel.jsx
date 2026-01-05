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

// Custom geometry types that need special rendering
const CUSTOM_GEOMETRIES = ['tree', 'gingerbreadMan', 'star', 'heart', 'snowflake', 'present', 'chimney', 'fencePost', 'licorice', 'frostingDollop', 'candyButton']

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
  const props = { config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }

  // Use custom geometries for special pieces
  switch (config.geometry) {
    case 'tree':
      return <TreeGeometry {...props} />
    case 'gingerbreadMan':
      return <GingerbreadManGeometry {...props} />
    case 'star':
      return <StarGeometry {...props} />
    case 'heart':
      return <HeartGeometry {...props} />
    case 'snowflake':
      return <SnowflakeGeometry {...props} />
    case 'present':
      return <PresentGeometry {...props} />
    case 'chimney':
      return <ChimneyGeometry {...props} />
    case 'fencePost':
      return <FencePostGeometry {...props} />
    case 'licorice':
      return <LicoriceGeometry {...props} />
    case 'frostingDollop':
      return <FrostingDollopGeometry {...props} />
    case 'candyButton':
      return <CandyButtonGeometry {...props} />
    default:
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

/**
 * Gingerbread Man - person shape with head, body, arms, legs
 */
function GingerbreadManGeometry({ config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }) {
  const bodyColor = color || config.color
  const frostingColor = '#FFFAF0'
  const buttonColor = '#DC143C'

  return (
    <group>
      {/* Head */}
      <mesh position={[0, 0.14, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <sphereGeometry args={[0.08, 12, 8]} />
        <meshStandardMaterial color={bodyColor} roughness={0.7} metalness={0} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <capsuleGeometry args={[0.06, 0.1, 4, 8]} />
        <meshStandardMaterial color={bodyColor} roughness={0.7} metalness={0} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {/* Left arm */}
      <mesh position={[-0.1, 0.02, 0]} rotation={[0, 0, Math.PI / 4]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <capsuleGeometry args={[0.025, 0.06, 4, 8]} />
        <meshStandardMaterial color={bodyColor} roughness={0.7} metalness={0} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {/* Right arm */}
      <mesh position={[0.1, 0.02, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <capsuleGeometry args={[0.025, 0.06, 4, 8]} />
        <meshStandardMaterial color={bodyColor} roughness={0.7} metalness={0} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {/* Left leg */}
      <mesh position={[-0.04, -0.14, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <capsuleGeometry args={[0.03, 0.06, 4, 8]} />
        <meshStandardMaterial color={bodyColor} roughness={0.7} metalness={0} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {/* Right leg */}
      <mesh position={[0.04, -0.14, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <capsuleGeometry args={[0.03, 0.06, 4, 8]} />
        <meshStandardMaterial color={bodyColor} roughness={0.7} metalness={0} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {/* Frosting buttons */}
      <mesh position={[0, 0.04, 0.06]} castShadow={castShadow}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color={buttonColor} roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0, 0.06]} castShadow={castShadow}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color={buttonColor} roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.025, 0.16, 0.07]} castShadow={castShadow}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0} />
      </mesh>
      <mesh position={[0.025, 0.16, 0.07]} castShadow={castShadow}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0} />
      </mesh>
    </group>
  )
}

/**
 * Star cookie - 5-pointed star shape
 */
function StarGeometry({ config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }) {
  const starColor = color || config.color

  // Create star shape with 5 points
  const starShape = useMemo(() => {
    const shape = new THREE.Shape()
    const outerRadius = 0.15
    const innerRadius = 0.06
    const points = 5

    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius
      const angle = (i * Math.PI) / points - Math.PI / 2
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }
    shape.closePath()
    return shape
  }, [])

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
        <extrudeGeometry args={[starShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 }]} />
        <meshStandardMaterial color={starColor} roughness={0.6} metalness={0.1} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
    </group>
  )
}

/**
 * Heart cookie - heart shape
 */
function HeartGeometry({ config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }) {
  const heartColor = color || config.color

  // Create heart shape
  const heartShape = useMemo(() => {
    const shape = new THREE.Shape()
    const x = 0, y = 0
    shape.moveTo(x, y - 0.1)
    shape.bezierCurveTo(x, y - 0.06, x - 0.04, y, x - 0.1, y)
    shape.bezierCurveTo(x - 0.16, y, x - 0.16, y + 0.08, x - 0.16, y + 0.08)
    shape.bezierCurveTo(x - 0.16, y + 0.13, x - 0.1, y + 0.18, x, y + 0.22)
    shape.bezierCurveTo(x + 0.1, y + 0.18, x + 0.16, y + 0.13, x + 0.16, y + 0.08)
    shape.bezierCurveTo(x + 0.16, y + 0.08, x + 0.16, y, x + 0.1, y)
    shape.bezierCurveTo(x + 0.04, y, x, y - 0.06, x, y - 0.1)
    return shape
  }, [])

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.05]}>
      <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
        <extrudeGeometry args={[heartShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 }]} />
        <meshStandardMaterial color={heartColor} roughness={0.5} metalness={0.1} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
    </group>
  )
}

/**
 * Snowflake - 6-pointed crystalline shape
 */
function SnowflakeGeometry({ config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }) {
  const snowColor = color || config.color

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* 6 main arms */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <group key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
          {/* Main arm */}
          <mesh position={[0, 0.08, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
            <boxGeometry args={[0.015, 0.16, 0.015]} />
            <meshStandardMaterial color={snowColor} roughness={0.2} metalness={0.3} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
          </mesh>
          {/* Branch left */}
          <mesh position={[-0.025, 0.1, 0]} rotation={[0, 0, Math.PI / 4]} castShadow={castShadow}>
            <boxGeometry args={[0.01, 0.04, 0.01]} />
            <meshStandardMaterial color={snowColor} roughness={0.2} metalness={0.3} opacity={opacity} transparent={opacity < 1} />
          </mesh>
          {/* Branch right */}
          <mesh position={[0.025, 0.1, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow={castShadow}>
            <boxGeometry args={[0.01, 0.04, 0.01]} />
            <meshStandardMaterial color={snowColor} roughness={0.2} metalness={0.3} opacity={opacity} transparent={opacity < 1} />
          </mesh>
        </group>
      ))}
      {/* Center hexagon */}
      <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
        <cylinderGeometry args={[0.03, 0.03, 0.02, 6]} />
        <meshStandardMaterial color={snowColor} roughness={0.2} metalness={0.3} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
    </group>
  )
}

/**
 * Present - gift box with ribbon
 */
function PresentGeometry({ config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }) {
  const boxColor = color || config.color
  const ribbonColor = '#FFD700'

  return (
    <group>
      {/* Main box */}
      <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[0.2, 0.18, 0.2]} />
        <meshStandardMaterial color={boxColor} roughness={0.4} metalness={0.1} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {/* Horizontal ribbon */}
      <mesh position={[0, 0, 0]} castShadow={castShadow}>
        <boxGeometry args={[0.21, 0.03, 0.21]} />
        <meshStandardMaterial color={ribbonColor} roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Vertical ribbon */}
      <mesh position={[0, 0, 0]} castShadow={castShadow}>
        <boxGeometry args={[0.03, 0.19, 0.21]} />
        <meshStandardMaterial color={ribbonColor} roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Bow loop left */}
      <mesh position={[-0.04, 0.11, 0]} rotation={[0, 0, Math.PI / 6]} castShadow={castShadow}>
        <torusGeometry args={[0.03, 0.012, 8, 12, Math.PI]} />
        <meshStandardMaterial color={ribbonColor} roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Bow loop right */}
      <mesh position={[0.04, 0.11, 0]} rotation={[0, 0, -Math.PI / 6]} castShadow={castShadow}>
        <torusGeometry args={[0.03, 0.012, 8, 12, Math.PI]} />
        <meshStandardMaterial color={ribbonColor} roughness={0.3} metalness={0.2} />
      </mesh>
    </group>
  )
}

/**
 * Chimney - brick chimney with top
 */
function ChimneyGeometry({ config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }) {
  const brickColor = color || config.color
  const mortarColor = '#808080'

  return (
    <group>
      {/* Main chimney body */}
      <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[0.25, 0.4, 0.25]} />
        <meshStandardMaterial color={brickColor} roughness={0.8} metalness={0} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {/* Chimney cap */}
      <mesh position={[0, 0.22, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[0.28, 0.04, 0.28]} />
        <meshStandardMaterial color={mortarColor} roughness={0.7} metalness={0} opacity={opacity} transparent={opacity < 1} />
      </mesh>
      {/* Inner hole */}
      <mesh position={[0, 0.2, 0]} castShadow={castShadow}>
        <boxGeometry args={[0.15, 0.05, 0.15]} />
        <meshStandardMaterial color="#1a1a1a" roughness={1} metalness={0} />
      </mesh>
      {/* Brick lines - horizontal */}
      {[-0.12, 0, 0.12].map((y, i) => (
        <mesh key={`h${i}`} position={[0, y, 0.126]} castShadow={castShadow}>
          <boxGeometry args={[0.26, 0.008, 0.002]} />
          <meshStandardMaterial color={mortarColor} roughness={0.9} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Fence Post - decorative gingerbread fence post
 */
function FencePostGeometry({ config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }) {
  const postColor = color || config.color
  const frostingColor = '#FFFAF0'

  return (
    <group>
      {/* Main post */}
      <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[0.06, 0.35, 0.06]} />
        <meshStandardMaterial color={postColor} roughness={0.7} metalness={0} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {/* Pointed top */}
      <mesh position={[0, 0.21, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <coneGeometry args={[0.045, 0.08, 4]} />
        <meshStandardMaterial color={postColor} roughness={0.7} metalness={0} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {/* Frosting drip on top */}
      <mesh position={[0, 0.22, 0]} castShadow={castShadow}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color={frostingColor} roughness={0.4} metalness={0} />
      </mesh>
      {/* Frosting band */}
      <mesh position={[0, 0.05, 0]} castShadow={castShadow}>
        <cylinderGeometry args={[0.035, 0.035, 0.02, 8]} />
        <meshStandardMaterial color={frostingColor} roughness={0.4} metalness={0} />
      </mesh>
    </group>
  )
}

/**
 * Licorice - twisted candy stick
 */
function LicoriceGeometry({ config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }) {
  const licoriceColor = color || config.color

  return (
    <group>
      {/* Main twisted body - using multiple cylinders rotated */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, -0.15 + i * 0.08, 0]} rotation={[0, (i * Math.PI) / 8, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
          <cylinderGeometry args={[0.03, 0.03, 0.09, 8]} />
          <meshStandardMaterial color={licoriceColor} roughness={0.4} metalness={0.1} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Frosting Dollop - swirled whipped cream/frosting
 */
function FrostingDollopGeometry({ config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }) {
  const frostingColor = color || config.color

  return (
    <group>
      {/* Base layer */}
      <mesh position={[0, -0.04, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <sphereGeometry args={[0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={frostingColor} roughness={0.3} metalness={0} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {/* Middle swirl */}
      <mesh position={[0, 0.01, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <sphereGeometry args={[0.065, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={frostingColor} roughness={0.3} metalness={0} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {/* Top peak */}
      <mesh position={[0, 0.05, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <coneGeometry args={[0.04, 0.06, 8]} />
        <meshStandardMaterial color={frostingColor} roughness={0.3} metalness={0} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
    </group>
  )
}

/**
 * Candy Button - shiny round candy button
 */
function CandyButtonGeometry({ config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }) {
  const candyColor = color || config.color

  return (
    <group>
      {/* Main button body */}
      <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
        <cylinderGeometry args={[0.07, 0.08, 0.03, 16]} />
        <meshStandardMaterial color={candyColor} roughness={0.2} metalness={0.3} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {/* Domed top */}
      <mesh position={[0, 0.015, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <sphereGeometry args={[0.07, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={candyColor} roughness={0.2} metalness={0.3} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {/* Shiny highlight */}
      <mesh position={[0.02, 0.05, 0.02]} castShadow={castShadow}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0} metalness={0.5} transparent opacity={0.6} />
      </mesh>
    </group>
  )
}
