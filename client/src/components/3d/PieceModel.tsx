import { Suspense, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
    createGingerbreadTexture,
    createPeppermintTexture,
    createFrostingTexture,
    createStarCookieTexture,
    getCachedTexture
} from '../../utils/proceduralTextures'
import { Normal, PieceConfig, SurfaceType } from '../../types'

interface PieceModelProps {
    config: PieceConfig
    color?: string
    opacity?: number
    emissive?: string
    emissiveIntensity?: number
    castShadow?: boolean
    receiveShadow?: boolean
    snapSurface?: SurfaceType
    snapNormal?: Normal | null
}

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
    receiveShadow = true,
    snapSurface,
    snapNormal
}: PieceModelProps) {
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
                snapSurface={snapSurface}
                snapNormal={snapNormal}
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
                    snapSurface={snapSurface}
                    snapNormal={snapNormal}
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
    opacity = 1,
    emissive = '#000000',
    emissiveIntensity = 0,
    castShadow = true,
    receiveShadow = true
}: PieceModelProps) {
    const { scene } = useGLTF(config.model!)

    // Clone scene and apply material overrides
    const clonedScene = useMemo(() => {
        const clone = scene.clone(true)

        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh
                // Clone material to prevent shared state
                if (mesh.material instanceof THREE.Material) {
                    mesh.material = mesh.material.clone()
                }

                // Apply color override if allowed
                if (config.allowColorOverride && color) {
                    if (mesh.material instanceof THREE.MeshStandardMaterial || mesh.material instanceof THREE.MeshBasicMaterial || mesh.material instanceof THREE.MeshPhysicalMaterial) {
                        mesh.material.color = new THREE.Color(color)
                    }
                }

                // Apply opacity
                if (opacity < 1) {
                    if (mesh.material instanceof THREE.Material) {
                        mesh.material.transparent = true
                        mesh.material.opacity = opacity
                    }
                }

                // Apply emissive for hover effect
                if (emissive !== '#000000') {
                    if (mesh.material instanceof THREE.MeshStandardMaterial || mesh.material instanceof THREE.MeshPhysicalMaterial) {
                        mesh.material.emissive = new THREE.Color(emissive)
                        mesh.material.emissiveIntensity = emissiveIntensity || 0
                    }
                }

                // Enable shadows
                mesh.castShadow = castShadow
                mesh.receiveShadow = receiveShadow
            }
        })

        return clone
    }, [scene, color, opacity, emissive, emissiveIntensity, config.allowColorOverride, castShadow, receiveShadow])

    const scale = config.modelScale || 1

    return <primitive object={clonedScene} scale={scale} />
}

// Custom geometry types that need special rendering
const CUSTOM_GEOMETRIES = ['tree', 'gingerbreadMan', 'star', 'heart', 'snowflake', 'present', 'chimney', 'fencePost', 'licorice', 'frostingDollop', 'candyButton', 'door', 'windowSmall', 'windowLarge']

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
    receiveShadow,
    snapSurface,
    snapNormal
}: PieceModelProps) {
    const props = { config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }
    const chimneyProps = { config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow, snapSurface, snapNormal }

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
            return <ChimneyGeometry {...chimneyProps} />
        case 'fencePost':
            return <FencePostGeometry {...props} />
        case 'licorice':
            return <LicoriceGeometry {...props} />
        case 'frostingDollop':
            return <FrostingDollopGeometry {...props} />
        case 'candyButton':
            return <CandyButtonGeometry {...props} />
        case 'door':
            return <DoorGeometry {...props} />
        case 'windowSmall':
            return <WindowSmallGeometry {...props} />
        case 'windowLarge':
            return <WindowLargeGeometry {...props} />
        default:
            // Determine material properties based on piece type
            const isCandyPiece = ['cone', 'cylinder'].includes(config.geometry) // gumdrops, peppermints
            const candyRoughness = isCandyPiece ? 0.15 : 0.6
            const candyMetalness = isCandyPiece ? 0.4 : 0.1
            return (
                <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
                    <PrimitiveGeometry type={config.geometry} size={config.size} />
                    <meshStandardMaterial
                        color={color || config.color}
                        roughness={candyRoughness}
                        metalness={candyMetalness}
                        opacity={opacity}
                        transparent={opacity !== undefined && opacity < 1}
                        emissive={emissive}
                        emissiveIntensity={emissiveIntensity}
                        envMapIntensity={isCandyPiece ? 1.5 : 1}
                    />
                </mesh>
            )
    }
}

/**
 * Renders appropriate geometry based on type
 */
function PrimitiveGeometry({ type, size }: { type: string, size: [number, number, number] }) {
    // Ensure size is valid for R3F args
    const safeSize: [number, number, number] = size || [1, 1, 1]

    switch (type) {
        case 'box':
            return <boxGeometry args={safeSize} />
        case 'cylinder':
            // Cylinder needs radiusTop, radiusBottom, height
            // Map size [width, height, depth] roughly to cylinder params
            return <cylinderGeometry args={[safeSize[0] / 2, safeSize[2] / 2, safeSize[1], 32]} />
        case 'cone':
            return <coneGeometry args={[safeSize[0] / 2, safeSize[1], 32]} />
        case 'sphere':
            return <sphereGeometry args={[safeSize[0] / 2, 32, 32]} />
        default:
            return <boxGeometry args={safeSize} />
    }
}

/**
 * Custom tree geometry - tiered Christmas tree with trunk
 */
function TreeGeometry({ config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }: PieceModelProps) {
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
                    transparent={opacity !== undefined && opacity < 1}
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
                    transparent={opacity !== undefined && opacity < 1}
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
                    transparent={opacity !== undefined && opacity < 1}
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
                    transparent={opacity !== undefined && opacity < 1}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                />
            </mesh>
        </group>
    )
}

/**
 * Gingerbread Man - person shape with head, body, arms, legs and baked cookie texture
 */
function GingerbreadManGeometry({ config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }: PieceModelProps) {
    const bodyColor = color || config.color
    const frostingColor = '#FFFAF0'
    const buttonColor = '#DC143C'

    // Get cached gingerbread texture
    const gingerbreadTexture = useMemo(() => {
        return getCachedTexture('gingerbread', createGingerbreadTexture, 256, 256, bodyColor || '#CD853F')
    }, [bodyColor])

    const gingerbreadMaterial = {
        map: gingerbreadTexture,
        roughness: 0.85,
        metalness: 0,
        opacity: opacity,
        transparent: opacity !== undefined && opacity < 1,
        emissive: new THREE.Color(emissive),
        emissiveIntensity: emissiveIntensity
    }

    return (
        <group>
            {/* Head */}
            <mesh position={[0, 0.14, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <sphereGeometry args={[0.08, 12, 8]} />
                <meshStandardMaterial {...gingerbreadMaterial} />
            </mesh>
            {/* Body */}
            <mesh position={[0, 0, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <capsuleGeometry args={[0.06, 0.1, 4, 8]} />
                <meshStandardMaterial {...gingerbreadMaterial} />
            </mesh>
            {/* Left arm */}
            <mesh position={[-0.1, 0.02, 0]} rotation={[0, 0, Math.PI / 4]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <capsuleGeometry args={[0.025, 0.06, 4, 8]} />
                <meshStandardMaterial {...gingerbreadMaterial} />
            </mesh>
            {/* Right arm */}
            <mesh position={[0.1, 0.02, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <capsuleGeometry args={[0.025, 0.06, 4, 8]} />
                <meshStandardMaterial {...gingerbreadMaterial} />
            </mesh>
            {/* Left leg */}
            <mesh position={[-0.04, -0.14, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <capsuleGeometry args={[0.03, 0.06, 4, 8]} />
                <meshStandardMaterial {...gingerbreadMaterial} />
            </mesh>
            {/* Right leg */}
            <mesh position={[0.04, -0.14, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <capsuleGeometry args={[0.03, 0.06, 4, 8]} />
                <meshStandardMaterial {...gingerbreadMaterial} />
            </mesh>
            {/* Frosting buttons - shiny candy */}
            <mesh position={[0, 0.04, 0.06]} castShadow={castShadow}>
                <sphereGeometry args={[0.015, 8, 8]} />
                <meshPhysicalMaterial color={buttonColor} roughness={0.1} metalness={0.1} clearcoat={0.8} />
            </mesh>
            <mesh position={[0, 0, 0.06]} castShadow={castShadow}>
                <sphereGeometry args={[0.015, 8, 8]} />
                <meshPhysicalMaterial color={buttonColor} roughness={0.1} metalness={0.1} clearcoat={0.8} />
            </mesh>
            {/* Eyes - glossy */}
            <mesh position={[-0.025, 0.16, 0.07]} castShadow={castShadow}>
                <sphereGeometry args={[0.012, 8, 8]} />
                <meshPhysicalMaterial color="#1a1a1a" roughness={0.1} metalness={0} clearcoat={1} />
            </mesh>
            <mesh position={[0.025, 0.16, 0.07]} castShadow={castShadow}>
                <sphereGeometry args={[0.012, 8, 8]} />
                <meshPhysicalMaterial color="#1a1a1a" roughness={0.1} metalness={0} clearcoat={1} />
            </mesh>
        </group>
    )
}

/**
 * Star cookie - 5-pointed star shape with golden sparkle texture
 */
function StarGeometry({ config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }: PieceModelProps) {
    const starColor = color || config.color

    // Get cached star cookie texture
    const starTexture = useMemo(() => {
        return getCachedTexture('star', createStarCookieTexture, 256, 256, starColor || '#FFD700')
    }, [starColor])

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
                <meshStandardMaterial
                    map={starTexture}
                    roughness={0.7}
                    metalness={0.05}
                    opacity={opacity}
                    transparent={opacity !== undefined && opacity < 1}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                />
            </mesh>
        </group>
    )
}

/**
 * Heart cookie - heart shape with baked cookie texture
 */
function HeartGeometry({ config, color, opacity, emissive, emissiveIntensity, castShadow, receiveShadow }: PieceModelProps) {
    const heartColor = color || config.color

    // Get cached gingerbread texture with heart color
    const heartTexture = useMemo(() => {
        return getCachedTexture('heart', createGingerbreadTexture, 256, 256, heartColor || '#FF69B4')
    }, [heartColor])

    // Create heart shape - classic heart with two rounded lobes at top and point at bottom
    const heartShape = useMemo(() => {
        const shape = new THREE.Shape()
        const scale = 0.12

        // Start at bottom point
        shape.moveTo(0, -scale * 1.2)

        // Left side curve up to left lobe
        shape.bezierCurveTo(
            -scale * 0.1, -scale * 0.8,  // control point 1
            -scale * 1.2, -scale * 0.2,  // control point 2
            -scale * 1.2, scale * 0.3    // end at top of left lobe
        )

        // Left lobe top curve
        shape.bezierCurveTo(
            -scale * 1.2, scale * 0.9,   // control point 1
            -scale * 0.5, scale * 1.1,   // control point 2
            0, scale * 0.6               // end at center dip
        )

        // Right lobe top curve
        shape.bezierCurveTo(
            scale * 0.5, scale * 1.1,    // control point 1
            scale * 1.2, scale * 0.9,    // control point 2
            scale * 1.2, scale * 0.3     // end at top of right lobe
        )

        // Right side curve down to bottom point
        shape.bezierCurveTo(
            scale * 1.2, -scale * 0.2,   // control point 1
            scale * 0.1, -scale * 0.8,   // control point 2
            0, -scale * 1.2              // end at bottom point
        )

        return shape
    }, [])

    return (
        <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
                <extrudeGeometry args={[heartShape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 3 }]} />
                <meshStandardMaterial
                    map={heartTexture}
                    roughness={0.75}
                    metalness={0.05}
                    opacity={opacity}
                    transparent={opacity !== undefined && opacity < 1}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                />
            </mesh>
        </group>
    )
}

/**
 * Snowflake - 6-pointed crystalline ice shape with sparkle
 */
function SnowflakeGeometry({ config, color, opacity = 1, emissive, emissiveIntensity, castShadow, receiveShadow }: PieceModelProps) {
    const snowColor = color || config.color

    // Icy crystal material props
    const iceMaterial = {
        color: snowColor,
        roughness: 0.05,
        metalness: 0.1,
        transmission: 0.3,
        thickness: 0.5,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        opacity: opacity * 0.9,
        transparent: true,
        emissive: new THREE.Color(emissive),
        emissiveIntensity: emissiveIntensity
    }

    return (
        <group rotation={[-Math.PI / 2, 0, 0]}>
            {/* 6 main arms */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <group key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
                    {/* Main arm */}
                    <mesh position={[0, 0.08, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                        <boxGeometry args={[0.015, 0.16, 0.015]} />
                        <meshPhysicalMaterial {...iceMaterial} />
                    </mesh>
                    {/* Branch left */}
                    <mesh position={[-0.025, 0.1, 0]} rotation={[0, 0, Math.PI / 4]} castShadow={castShadow}>
                        <boxGeometry args={[0.01, 0.04, 0.01]} />
                        <meshPhysicalMaterial {...iceMaterial} />
                    </mesh>
                    {/* Branch right */}
                    <mesh position={[0.025, 0.1, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow={castShadow}>
                        <boxGeometry args={[0.01, 0.04, 0.01]} />
                        <meshPhysicalMaterial {...iceMaterial} />
                    </mesh>
                </group>
            ))}
            {/* Center hexagon */}
            <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
                <cylinderGeometry args={[0.03, 0.03, 0.02, 6]} />
                <meshPhysicalMaterial {...iceMaterial} />
            </mesh>
            {/* Center sparkle highlight */}
            <mesh position={[0, 0, 0.015]}>
                <sphereGeometry args={[0.01, 8, 8]} />
                <meshStandardMaterial color="#ffffff" roughness={0} metalness={1} transparent opacity={0.8} />
            </mesh>
        </group>
    )
}

/**
 * Present - gift box with shiny satin ribbon
 */
function PresentGeometry({ config, color, opacity = 1, emissive, emissiveIntensity, castShadow, receiveShadow }: PieceModelProps) {
    const boxColor = color || config.color
    const ribbonColor = '#FFD700'

    return (
        <group>
            {/* Main box - wrapped paper look */}
            <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
                <boxGeometry args={[0.2, 0.18, 0.2]} />
                <meshPhysicalMaterial
                    color={boxColor}
                    roughness={0.3}
                    metalness={0.05}
                    clearcoat={0.3}
                    clearcoatRoughness={0.4}
                    opacity={opacity}
                    transparent={opacity < 1}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                />
            </mesh>
            {/* Horizontal ribbon - satin shine */}
            <mesh position={[0, 0, 0]} castShadow={castShadow}>
                <boxGeometry args={[0.21, 0.03, 0.21]} />
                <meshPhysicalMaterial color={ribbonColor} roughness={0.15} metalness={0.5} clearcoat={0.8} clearcoatRoughness={0.2} />
            </mesh>
            {/* Vertical ribbon */}
            <mesh position={[0, 0, 0]} castShadow={castShadow}>
                <boxGeometry args={[0.03, 0.19, 0.21]} />
                <meshPhysicalMaterial color={ribbonColor} roughness={0.15} metalness={0.5} clearcoat={0.8} clearcoatRoughness={0.2} />
            </mesh>
            {/* Bow loop left */}
            <mesh position={[-0.04, 0.11, 0]} rotation={[0, 0, Math.PI / 6]} castShadow={castShadow}>
                <torusGeometry args={[0.03, 0.012, 8, 12, Math.PI]} />
                <meshPhysicalMaterial color={ribbonColor} roughness={0.15} metalness={0.5} clearcoat={0.8} clearcoatRoughness={0.2} />
            </mesh>
            {/* Bow loop right */}
            <mesh position={[0.04, 0.11, 0]} rotation={[0, 0, -Math.PI / 6]} castShadow={castShadow}>
                <torusGeometry args={[0.03, 0.012, 8, 12, Math.PI]} />
                <meshPhysicalMaterial color={ribbonColor} roughness={0.15} metalness={0.5} clearcoat={0.8} clearcoatRoughness={0.2} />
            </mesh>
        </group>
    )
}

/**
 * Chimney - brick chimney with top
 */
function ChimneyGeometry({
    config,
    color,
    opacity = 1,
    emissive,
    emissiveIntensity,
    castShadow,
    receiveShadow,
    snapSurface,
    snapNormal
}: PieceModelProps) {
    const brickColor = color || config.color
    const mortarColor = '#808080'
    const roofNormal = snapSurface === 'roof' && snapNormal ? snapNormal : null
    const capHeight = 0.04
    const bodyWidth = (config.size?.[0] || 0.28) * 0.9
    const bodyDepth = (config.size?.[2] || 0.28) * 0.9
    const bodyHeight = Math.max(0.3, (config.size?.[1] || 0.5) - capHeight)
    const bodyHalfHeight = bodyHeight / 2
    const capYOffset = bodyHalfHeight + capHeight / 2

    const skirtGeometry = useMemo(() => {
        if (!roofNormal) return null

        const normalVec = new THREE.Vector3(roofNormal[0], roofNormal[1], roofNormal[2]).normalize()
        const horizontal = new THREE.Vector3(normalVec.x, 0, normalVec.z)
        if (horizontal.lengthSq() < 1e-4) return null

        const slopeAngle = Math.acos(Math.max(-1, Math.min(1, normalVec.y)))
        const skirtLength = bodyDepth * 0.7
        const skirtHeight = Math.min(bodyHeight * 0.6, Math.tan(slopeAngle) * skirtLength + 0.04)
        if (skirtHeight < 0.01) return null

        const width = bodyWidth
        const halfW = width / 2
        const length = skirtLength
        const height = skirtHeight

        const positions = new Float32Array([
            // Left triangle
            -halfW, 0, 0,
            -halfW, 0, length,
            -halfW, -height, length,
            // Right triangle
            halfW, 0, 0,
            halfW, -height, length,
            halfW, 0, length,
            // Top face
            -halfW, 0, 0,
            halfW, 0, 0,
            halfW, 0, length,
            -halfW, 0, 0,
            halfW, 0, length,
            -halfW, 0, length,
            // Slanted face
            -halfW, 0, 0,
            -halfW, -height, length,
            halfW, -height, length,
            -halfW, 0, 0,
            halfW, -height, length,
            halfW, 0, 0,
            // Front face
            -halfW, 0, length,
            halfW, 0, length,
            halfW, -height, length,
            -halfW, 0, length,
            halfW, -height, length,
            -halfW, -height, length
        ])

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        geometry.computeVertexNormals()
        return geometry
    }, [roofNormal])

    const skirtYaw = useMemo(() => {
        if (!roofNormal) return 0
        const normalVec = new THREE.Vector3(roofNormal[0], roofNormal[1], roofNormal[2]).normalize()
        const horizontal = new THREE.Vector3(normalVec.x, 0, normalVec.z)
        if (horizontal.lengthSq() < 1e-4) return 0
        horizontal.normalize()
        return Math.atan2(horizontal.x, horizontal.z)
    }, [roofNormal])

    const skirtOffset = useMemo(() => {
        if (!roofNormal) return new THREE.Vector3(0, 0, 0)
        const normalVec = new THREE.Vector3(roofNormal[0], roofNormal[1], roofNormal[2]).normalize()
        const horizontal = new THREE.Vector3(normalVec.x, 0, normalVec.z)
        if (horizontal.lengthSq() < 1e-4) return new THREE.Vector3(0, 0, 0)
        horizontal.normalize()
        const skirtInset = 0.01
        return horizontal.multiplyScalar(-Math.max(0, bodyDepth / 2 - skirtInset))
    }, [roofNormal, bodyDepth])

    return (
        <group>
            {/* Main chimney body */}
            <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
                <boxGeometry args={[bodyWidth, bodyHeight, bodyDepth]} />
                <meshStandardMaterial color={brickColor} roughness={0.8} metalness={0} opacity={opacity} transparent={opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
            </mesh>
            {/* Chimney cap */}
            <mesh position={[0, capYOffset, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <boxGeometry args={[bodyWidth + 0.03, capHeight, bodyDepth + 0.03]} />
                <meshStandardMaterial color={mortarColor} roughness={0.7} metalness={0} opacity={opacity} transparent={opacity < 1} />
            </mesh>
            {/* Inner hole */}
            <mesh position={[0, capYOffset - capHeight / 2, 0]} castShadow={castShadow}>
                <boxGeometry args={[bodyWidth * 0.6, capHeight * 1.2, bodyDepth * 0.6]} />
                <meshStandardMaterial color="#1a1a1a" roughness={1} metalness={0} />
            </mesh>
            {/* Brick lines - horizontal */}
            {[-0.28, -0.04, 0.2].map((t, i) => (
                <mesh key={`h${i}`} position={[0, t * bodyHalfHeight, bodyDepth / 2 + 0.001]} castShadow={castShadow}>
                    <boxGeometry args={[bodyWidth + 0.01, 0.008, 0.002]} />
                    <meshStandardMaterial color={mortarColor} roughness={0.9} metalness={0} />
                </mesh>
            ))}
            {skirtGeometry && (
                <mesh
                    geometry={skirtGeometry}
                    position={[skirtOffset.x, -bodyHalfHeight, skirtOffset.z]}
                    rotation={[0, skirtYaw, 0]}
                    castShadow={castShadow}
                    receiveShadow={receiveShadow}
                >
                    <meshStandardMaterial
                        color={brickColor}
                        roughness={0.85}
                        metalness={0}
                        opacity={opacity}
                        transparent={opacity < 1}
                        emissive={emissive}
                        emissiveIntensity={emissiveIntensity}
                    />
                </mesh>
            )}
        </group>
    )
}

/**
 * Fence Post - decorative gingerbread fence post
 */
function FencePostGeometry({ config, color, opacity = 1, emissive, emissiveIntensity, castShadow, receiveShadow }: PieceModelProps) {
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
function LicoriceGeometry({ config, color, opacity = 1, emissive, emissiveIntensity, castShadow, receiveShadow }: PieceModelProps) {
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
 * Frosting Dollop - swirled whipped cream/frosting with creamy texture
 */
function FrostingDollopGeometry({ config, color, opacity = 1, emissive, emissiveIntensity, castShadow, receiveShadow }: PieceModelProps) {
    const frostingColor = color || config.color

    // Get cached frosting texture
    const frostingTexture = useMemo(() => {
        return getCachedTexture('frosting', createFrostingTexture, 128, 128, frostingColor || '#FFFFFF')
    }, [frostingColor])

    const frostingMaterial = {
        map: frostingTexture,
        roughness: 0.4,
        metalness: 0,
        opacity: opacity,
        transparent: opacity !== undefined && opacity < 1,
        emissive: new THREE.Color(emissive),
        emissiveIntensity: emissiveIntensity
    }

    return (
        <group>
            {/* Base layer */}
            <mesh position={[0, -0.04, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <sphereGeometry args={[0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial {...frostingMaterial} />
            </mesh>
            {/* Middle swirl */}
            <mesh position={[0, 0.01, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <sphereGeometry args={[0.065, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial {...frostingMaterial} />
            </mesh>
            {/* Top peak */}
            <mesh position={[0, 0.05, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <coneGeometry args={[0.04, 0.06, 8]} />
                <meshStandardMaterial {...frostingMaterial} />
            </mesh>
        </group>
    )
}

/**
 * Candy Button - shiny round candy button with glossy surface
 */
function CandyButtonGeometry({ config, color, opacity = 1, emissive, emissiveIntensity, castShadow, receiveShadow }: PieceModelProps) {
    const candyColor = color || config.color

    return (
        <group>
            {/* Main button body */}
            <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
                <cylinderGeometry args={[0.07, 0.08, 0.03, 16]} />
                <meshPhysicalMaterial
                    color={candyColor}
                    roughness={0.05}
                    metalness={0.1}
                    clearcoat={1}
                    clearcoatRoughness={0.1}
                    opacity={opacity}
                    transparent={opacity !== undefined && opacity < 1}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                />
            </mesh>
            {/* Domed top */}
            <mesh position={[0, 0.015, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <sphereGeometry args={[0.07, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshPhysicalMaterial
                    color={candyColor}
                    roughness={0.05}
                    metalness={0.1}
                    clearcoat={1}
                    clearcoatRoughness={0.1}
                    opacity={opacity}
                    transparent={opacity !== undefined && opacity < 1}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                />
            </mesh>
            {/* Shiny highlight */}
            <mesh position={[0.02, 0.05, 0.02]} castShadow={castShadow}>
                <sphereGeometry args={[0.018, 8, 8]} />
                <meshStandardMaterial color="#ffffff" roughness={0} metalness={0.8} transparent opacity={0.7} />
            </mesh>
        </group>
    )
}

/**
 * Door - gingerbread cookie door with frosting decorations
 */
function DoorGeometry({ config, color, opacity = 1, emissive, emissiveIntensity, castShadow, receiveShadow }: PieceModelProps) {
    const gingerbreadColor = '#CD853F'
    const frostingColor = '#FFFAF0'
    const candyRed = '#DC143C'
    const candyGreen = '#228B22'

    return (
        <group>
            {/* Main gingerbread door body */}
            <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
                <boxGeometry args={[0.5, 0.9, 0.08]} />
                <meshStandardMaterial
                    color={gingerbreadColor}
                    roughness={0.8}
                    metalness={0}
                    opacity={opacity}
                    transparent={opacity !== undefined && opacity < 1}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                />
            </mesh>

            {/* Frosting outline - top */}
            <mesh position={[0, 0.42, 0.045]} castShadow={castShadow}>
                <boxGeometry args={[0.48, 0.04, 0.02]} />
                <meshStandardMaterial color={frostingColor} roughness={0.3} metalness={0} />
            </mesh>

            {/* Frosting outline - bottom */}
            <mesh position={[0, -0.42, 0.045]} castShadow={castShadow}>
                <boxGeometry args={[0.48, 0.04, 0.02]} />
                <meshStandardMaterial color={frostingColor} roughness={0.3} metalness={0} />
            </mesh>

            {/* Frosting outline - left */}
            <mesh position={[-0.22, 0, 0.045]} castShadow={castShadow}>
                <boxGeometry args={[0.04, 0.84, 0.02]} />
                <meshStandardMaterial color={frostingColor} roughness={0.3} metalness={0} />
            </mesh>

            {/* Frosting outline - right */}
            <mesh position={[0.22, 0, 0.045]} castShadow={castShadow}>
                <boxGeometry args={[0.04, 0.84, 0.02]} />
                <meshStandardMaterial color={frostingColor} roughness={0.3} metalness={0} />
            </mesh>

            {/* Frosting arch decoration at top */}
            <mesh position={[0, 0.28, 0.045]} castShadow={castShadow}>
                <boxGeometry args={[0.3, 0.025, 0.02]} />
                <meshStandardMaterial color={frostingColor} roughness={0.3} metalness={0} />
            </mesh>

            {/* Frosting swirl decorations - top corners */}
            <mesh position={[-0.12, 0.32, 0.05]} castShadow={castShadow}>
                <sphereGeometry args={[0.025, 8, 8]} />
                <meshStandardMaterial color={frostingColor} roughness={0.3} metalness={0} />
            </mesh>
            <mesh position={[0.12, 0.32, 0.05]} castShadow={castShadow}>
                <sphereGeometry args={[0.025, 8, 8]} />
                <meshStandardMaterial color={frostingColor} roughness={0.3} metalness={0} />
            </mesh>

            {/* Heart decoration in center-top */}
            <mesh position={[0, 0.2, 0.05]} rotation={[-Math.PI / 2, 0, 0]} castShadow={castShadow}>
                <cylinderGeometry args={[0.04, 0.04, 0.02, 3]} />
                <meshStandardMaterial color={candyRed} roughness={0.4} metalness={0.1} />
            </mesh>

            {/* Gumdrop door handle */}
            <mesh position={[0.15, -0.05, 0.06]} castShadow={castShadow}>
                <coneGeometry args={[0.04, 0.06, 8]} />
                <meshStandardMaterial color={candyRed} roughness={0.3} metalness={0.1} />
            </mesh>

            {/* Candy button decorations - vertical line */}
            {[-0.15, 0, 0.15].map((y, i) => (
                <mesh key={`btn-${i}`} position={[-0.15, y, 0.05]} castShadow={castShadow}>
                    <sphereGeometry args={[0.025, 8, 8]} />
                    <meshStandardMaterial
                        color={i === 1 ? candyGreen : candyRed}
                        roughness={0.3}
                        metalness={0.1}
                    />
                </mesh>
            ))}

            {/* Frosting squiggle down the middle (dots) */}
            {[-0.25, -0.1, 0.05, 0.2].map((y, i) => (
                <mesh key={`dot-${i}`} position={[0, y, 0.05]} castShadow={castShadow}>
                    <sphereGeometry args={[0.015, 6, 6]} />
                    <meshStandardMaterial color={frostingColor} roughness={0.3} metalness={0} />
                </mesh>
            ))}

            {/* Bottom candy decorations */}
            <mesh position={[-0.1, -0.32, 0.05]} castShadow={castShadow}>
                <sphereGeometry args={[0.03, 8, 8]} />
                <meshStandardMaterial color={candyGreen} roughness={0.3} metalness={0.1} />
            </mesh>
            <mesh position={[0.1, -0.32, 0.05]} castShadow={castShadow}>
                <sphereGeometry args={[0.03, 8, 8]} />
                <meshStandardMaterial color={candyGreen} roughness={0.3} metalness={0.1} />
            </mesh>
        </group>
    )
}

/**
 * Small Window - frosted glass window with frame and panes
 */
function WindowSmallGeometry({ config, color, opacity = 1, emissive, emissiveIntensity, castShadow, receiveShadow }: PieceModelProps) {
    const frameColor = '#FFFAF0' // White frosting frame (matches door)
    const glassColor = '#A8D4E6' // Frosted pale blue glass
    const frameThickness = 0.035
    const frameDepth = 0.08

    return (
        <group>
            {/* Frame - top */}
            <mesh position={[0, 0.1575, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <boxGeometry args={[0.35, frameThickness, frameDepth]} />
                <meshStandardMaterial
                    color={frameColor}
                    roughness={0.7}
                    metalness={0}
                    opacity={opacity}
                    transparent={opacity !== undefined && opacity < 1}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                />
            </mesh>

            {/* Frame - bottom */}
            <mesh position={[0, -0.1575, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <boxGeometry args={[0.35, frameThickness, frameDepth]} />
                <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0} opacity={opacity} transparent={opacity !== undefined && opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
            </mesh>

            {/* Frame - left */}
            <mesh position={[-0.1575, 0, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <boxGeometry args={[frameThickness, 0.28, frameDepth]} />
                <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0} opacity={opacity} transparent={opacity !== undefined && opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
            </mesh>

            {/* Frame - right */}
            <mesh position={[0.1575, 0, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <boxGeometry args={[frameThickness, 0.28, frameDepth]} />
                <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0} opacity={opacity} transparent={opacity !== undefined && opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
            </mesh>

            {/* Cross frame - vertical */}
            <mesh position={[0, 0, 0]} castShadow={castShadow}>
                <boxGeometry args={[0.025, 0.28, frameDepth]} />
                <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0} />
            </mesh>

            {/* Cross frame - horizontal */}
            <mesh position={[0, 0, 0]} castShadow={castShadow}>
                <boxGeometry args={[0.28, 0.025, frameDepth]} />
                <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0} />
            </mesh>

            {/* Glass pane - top left */}
            <mesh position={[-0.07, 0.07, 0]} receiveShadow={receiveShadow}>
                <boxGeometry args={[0.1, 0.1, 0.02]} />
                <meshStandardMaterial
                    color={glassColor}
                    roughness={0.05}
                    metalness={0.2}
                    opacity={0.6}
                    transparent
                />
            </mesh>

            {/* Glass pane - top right */}
            <mesh position={[0.07, 0.07, 0]} receiveShadow={receiveShadow}>
                <boxGeometry args={[0.1, 0.1, 0.02]} />
                <meshStandardMaterial color={glassColor} roughness={0.05} metalness={0.2} opacity={0.6} transparent />
            </mesh>

            {/* Glass pane - bottom left */}
            <mesh position={[-0.07, -0.07, 0]} receiveShadow={receiveShadow}>
                <boxGeometry args={[0.1, 0.1, 0.02]} />
                <meshStandardMaterial color={glassColor} roughness={0.05} metalness={0.2} opacity={0.6} transparent />
            </mesh>

            {/* Glass pane - bottom right */}
            <mesh position={[0.07, -0.07, 0]} receiveShadow={receiveShadow}>
                <boxGeometry args={[0.1, 0.1, 0.02]} />
                <meshStandardMaterial color={glassColor} roughness={0.05} metalness={0.2} opacity={0.6} transparent />
            </mesh>

            {/* Decorative candy dots on corners */}
            {[[-0.14, 0.14], [0.14, 0.14], [-0.14, -0.14], [0.14, -0.14]].map(([x, y], i) => (
                <mesh key={i} position={[x, y, 0.05]} castShadow={castShadow}>
                    <sphereGeometry args={[0.02, 8, 8]} />
                    <meshStandardMaterial
                        color={i % 2 === 0 ? '#DC143C' : '#228B22'}
                        roughness={0.3}
                        metalness={0.1}
                    />
                </mesh>
            ))}
        </group>
    )
}

/**
 * Large Window - frosted glass window with frame and 6 panes
 */
function WindowLargeGeometry({ config, color, opacity = 1, emissive, emissiveIntensity, castShadow, receiveShadow }: PieceModelProps) {
    const frameColor = '#FFFAF0' // White frosting frame (matches door)
    const glassColor = '#A8D4E6' // Frosted pale blue glass
    const frameThickness = 0.04
    const frameDepth = 0.08

    return (
        <group>
            {/* Frame - top */}
            <mesh position={[0, 0.255, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <boxGeometry args={[0.55, frameThickness, frameDepth]} />
                <meshStandardMaterial
                    color={frameColor}
                    roughness={0.7}
                    metalness={0}
                    opacity={opacity}
                    transparent={opacity !== undefined && opacity < 1}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                />
            </mesh>

            {/* Frame - bottom */}
            <mesh position={[0, -0.255, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <boxGeometry args={[0.55, frameThickness, frameDepth]} />
                <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0} opacity={opacity} transparent={opacity !== undefined && opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
            </mesh>

            {/* Frame - left */}
            <mesh position={[-0.255, 0, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <boxGeometry args={[frameThickness, 0.47, frameDepth]} />
                <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0} opacity={opacity} transparent={opacity !== undefined && opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
            </mesh>

            {/* Frame - right */}
            <mesh position={[0.255, 0, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
                <boxGeometry args={[frameThickness, 0.47, frameDepth]} />
                <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0} opacity={opacity} transparent={opacity !== undefined && opacity < 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
            </mesh>

            {/* Vertical divider */}
            <mesh position={[0, 0, 0]} castShadow={castShadow}>
                <boxGeometry args={[0.025, 0.47, frameDepth]} />
                <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0} />
            </mesh>

            {/* Horizontal dividers */}
            <mesh position={[0, 0.08, 0]} castShadow={castShadow}>
                <boxGeometry args={[0.47, 0.025, frameDepth]} />
                <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0} />
            </mesh>
            <mesh position={[0, -0.08, 0]} castShadow={castShadow}>
                <boxGeometry args={[0.47, 0.025, frameDepth]} />
                <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0} />
            </mesh>

            {/* 6 glass panes (2 columns x 3 rows) */}
            {[
                [-0.12, 0.165], [0.12, 0.165],   // Top row
                [-0.12, 0], [0.12, 0],        // Middle row
                [-0.12, -0.165], [0.12, -0.165]   // Bottom row
            ].map(([x, y], i) => (
                <mesh key={i} position={[x, y, 0]} receiveShadow={receiveShadow}>
                    <boxGeometry args={[0.19, 0.12, 0.02]} />
                    <meshStandardMaterial
                        color={glassColor}
                        roughness={0.05}
                        metalness={0.2}
                        opacity={0.6}
                        transparent
                    />
                </mesh>
            ))}

            {/* Decorative candy dots on corners */}
            {[[-0.23, 0.23], [0.23, 0.23], [-0.23, -0.23], [0.23, -0.23]].map(([x, y], i) => (
                <mesh key={i} position={[x, y, 0.05]} castShadow={castShadow}>
                    <sphereGeometry args={[0.025, 8, 8]} />
                    <meshStandardMaterial
                        color={i % 2 === 0 ? '#DC143C' : '#228B22'}
                        roughness={0.3}
                        metalness={0.1}
                    />
                </mesh>
            ))}
        </group>
    )
}
