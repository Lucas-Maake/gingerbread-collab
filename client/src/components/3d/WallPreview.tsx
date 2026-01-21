import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import { snapPointToGrid } from '../../utils/gridSnap'

const PREVIEW_COLOR = '#8B4513'
const WALL_HEIGHT = 1.5
const WALL_THICKNESS = 0.15

/**
 * Ghost preview of wall being drawn
 * Shows a line from start point to cursor position
 */
export default function WallPreview() {
    const { camera, gl } = useThree()
    const meshRef = useRef<THREE.Mesh>(null)
    const mouseRef = useRef(new THREE.Vector2())
    const raycaster = useRef(new THREE.Raycaster())
    const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
    const intersectPoint = useRef(new THREE.Vector3())

    const buildMode = useGameStore((state) => state.buildMode)
    const wallDrawingStartPoint = useGameStore((state) => state.wallDrawingStartPoint)
    const gridSnapEnabled = useGameStore((state) => state.gridSnapEnabled)
    const gridSize = useGameStore((state) => state.gridSize)

    // Track mouse position and update preview
    useFrame(() => {
        if (buildMode !== 'wall' || !wallDrawingStartPoint || !meshRef.current) {
            if (meshRef.current) {
                meshRef.current.visible = false
            }
            return
        }

        // Get mouse position from DOM events (stored by WallDrawingManager)
        const canvas = gl.domElement as HTMLCanvasElement & { __wallPreviewMouse?: { x: number, y: number } }
        const mouseState = canvas.__wallPreviewMouse
        if (!mouseState) {
            meshRef.current.visible = false
            return
        }

        mouseRef.current.x = mouseState.x
        mouseRef.current.y = mouseState.y

        // Raycast to ground plane
        raycaster.current.setFromCamera(mouseRef.current, camera)
        raycaster.current.ray.intersectPlane(dragPlane.current, intersectPoint.current)

        let endX = intersectPoint.current.x
        let endZ = intersectPoint.current.z

        // Apply grid snap
        if (gridSnapEnabled) {
            const snapped = snapPointToGrid([endX, endZ], gridSize)
            endX = snapped[0]
            endZ = snapped[1]
        }

        const [startX, startZ] = wallDrawingStartPoint

        // Calculate wall dimensions
        const dx = endX - startX
        const dz = endZ - startZ
        const length = Math.sqrt(dx * dx + dz * dz)

        // Hide if too short
        if (length < 0.1) {
            meshRef.current.visible = false
            return
        }

        // Position and rotate the preview
        meshRef.current.position.set(
            (startX + endX) / 2,
            WALL_HEIGHT / 2,
            (startZ + endZ) / 2
        )
        meshRef.current.rotation.set(0, -Math.atan2(dz, dx), 0)
        meshRef.current.scale.set(length, WALL_HEIGHT, WALL_THICKNESS)
        meshRef.current.visible = true
    })

    // Always render the mesh but control visibility in useFrame
    return (
        <mesh ref={meshRef} visible={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
                color={PREVIEW_COLOR}
                transparent
                opacity={0.5}
                depthWrite={false}
            />
        </mesh>
    )
}
