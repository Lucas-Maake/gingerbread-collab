import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'

/**
 * SnapIndicator - Visual feedback showing where a piece will snap
 * Displays a glowing ring/disc on the target surface
 */
export default function SnapIndicator() {
    const snapInfo = useGameStore((state) => state.snapInfo)
    const heldPieceId = useGameStore((state) => state.heldPieceId)
    const meshRef = useRef<THREE.Mesh>(null)
    const pulseRef = useRef(0)

    // Animate the indicator with a pulsing glow
    useFrame((_, delta) => {
        if (meshRef.current) {
            pulseRef.current += delta * 3
            const pulse = Math.sin(pulseRef.current) * 0.3 + 0.7
            if (meshRef.current.material instanceof THREE.Material) {
                meshRef.current.material.opacity = pulse * 0.6
            }
            meshRef.current.scale.setScalar(1 + Math.sin(pulseRef.current * 0.5) * 0.1)
        }
    })

    // Calculate indicator position and rotation based on surface
    const { position, rotation, color } = useMemo(() => {
        if (!snapInfo || !snapInfo.position) {
            return { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], color: '#00ff00' }
        }

        const pos = snapInfo.position
        const normal = snapInfo.normal || [0, 1, 0]

        // Calculate rotation to align indicator with surface
        const normalVec = new THREE.Vector3(normal[0], normal[1], normal[2]).normalize()
        const upVec = new THREE.Vector3(0, 1, 0)
        const quaternion = new THREE.Quaternion()
        quaternion.setFromUnitVectors(upVec, normalVec)
        const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ')

        // Color based on surface type
        // snapInfo.surfaceType can be 'wall', 'roof', 'ground', or null
        const indicatorColor = snapInfo.surfaceType === 'roof' ? '#00ffaa' : '#00ff88'

        return {
            position: pos,
            rotation: [euler.x, euler.y, euler.z] as [number, number, number],
            color: indicatorColor
        }
    }, [snapInfo])

    // Only show when holding a piece and snap is active
    if (!heldPieceId || !snapInfo) {
        return null
    }

    return (
        <group position={position} rotation={rotation}>
            {/* Main glow ring */}
            <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.15, 0.25, 32]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.6}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>

            {/* Center dot */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.08, 16]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.4}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>

            {/* Outer pulse ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.28, 0.32, 32]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.3}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>
        </group>
    )
}
