import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import { UserState } from '../../types'

/**
 * Container for cursor visualizations
 * Shows other users' 3D cursors on the build surface
 */
export default function Cursors() {
    const users = useGameStore((state) => state.users)
    const localUserId = useGameStore((state) => state.userId)
    const heldPieceId = useGameStore((state) => state.heldPieceId)

    // Get other users (exclude local user)
    const otherUsers = useMemo(() => {
        return Array.from(users.values()).filter(
            (user) => user.userId !== localUserId && user.isActive
        )
    }, [users, localUserId])

    // Get local user for cursor color
    const localUser = useMemo(() => {
        return users.get(localUserId || '')
    }, [users, localUserId])

    return (
        <group>
            {/* Other users' cursors */}
            {otherUsers.map((user) => (
                <UserCursor key={user.userId} user={user} />
            ))}

            {/* Local cursor indicator (when holding a piece) */}
            {heldPieceId && localUser && (
                <LocalCursorIndicator color={localUser.color} />
            )}
        </group>
    )
}

/**
 * Individual user cursor - shows position and name
 */
function UserCursor({ user }: { user: UserState }) {
    const groupRef = useRef<THREE.Group>(null)
    const ringRef = useRef<THREE.Mesh>(null)
    const targetPosition = useRef(new THREE.Vector3(0, 0.1, 0))

    // Animate ring rotation
    useFrame((_state, delta) => {
        if (ringRef.current) {
            ringRef.current.rotation.z += delta * 2
        }
    })

    // Smoothly interpolate cursor position
    useFrame((_state, delta) => {
        if (!groupRef.current || !user.cursor) return

        // Update target position
        targetPosition.current.set(
            user.cursor.x,
            0.1, // Slightly above surface
            user.cursor.z
        )

        // Smooth interpolation
        const speed = 12
        groupRef.current.position.lerp(targetPosition.current, speed * delta)
    })

    // Initial position
    const initialPos: [number, number, number] = user.cursor
        ? [user.cursor.x, 0.1, user.cursor.z]
        : [0, 0.1, 0]

    return (
        <group ref={groupRef} position={initialPos}>
            {/* Cursor dot */}
            <mesh position={[0, 0.05, 0]}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshStandardMaterial
                    color={user.color || '#ffffff'}
                    emissive={user.color || '#ffffff'}
                    emissiveIntensity={0.5}
                />
            </mesh>

            {/* Animated ring */}
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <ringGeometry args={[0.15, 0.2, 6]} />
                <meshBasicMaterial
                    color={user.color || '#ffffff'}
                    transparent
                    opacity={0.6}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Outer glow ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                <ringGeometry args={[0.2, 0.25, 32]} />
                <meshBasicMaterial
                    color={user.color || '#ffffff'}
                    transparent
                    opacity={0.3}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Username label */}
            <Billboard
                follow={true}
                lockX={false}
                lockY={false}
                lockZ={false}
                position={[0, 0.4, 0]}
            >
                <Text
                    fontSize={0.15}
                    color={user.color || '#ffffff'}
                    anchorX="center"
                    anchorY="bottom"
                    outlineWidth={0.02}
                    outlineColor="#000000"
                >
                    {user.name}
                </Text>
            </Billboard>
        </group>
    )
}

/**
 * Local cursor indicator - shows where your cursor is projecting
 */
function LocalCursorIndicator({ color }: { color: string }) {
    const meshRef = useRef<THREE.Group>(null)
    const { camera, gl } = useThree()
    const raycaster = useRef(new THREE.Raycaster())
    const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
    const intersectPoint = useRef(new THREE.Vector3())
    const mouse = useRef(new THREE.Vector2())

    // Update position based on mouse
    useFrame(() => {
        if (!meshRef.current) return

        raycaster.current.setFromCamera(mouse.current, camera)
        raycaster.current.ray.intersectPlane(plane.current, intersectPoint.current)

        meshRef.current.position.x = intersectPoint.current.x
        meshRef.current.position.z = intersectPoint.current.z
    })

    // Track mouse position
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const rect = gl.domElement.getBoundingClientRect()
            mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
            mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
        }

        window.addEventListener('mousemove', handleMouseMove)
        return () => window.removeEventListener('mousemove', handleMouseMove)
    }, [gl])

    return (
        <group ref={meshRef} position={[0, 0.02, 0]}>
            {/* Target crosshair */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.1, 0.12, 4]} />
                <meshBasicMaterial
                    color={color || '#00ff00'}
                    transparent
                    opacity={0.8}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Center dot */}
            <mesh position={[0, 0.02, 0]}>
                <sphereGeometry args={[0.03, 8, 8]} />
                <meshBasicMaterial color={color || '#00ff00'} />
            </mesh>
        </group>
    )
}
