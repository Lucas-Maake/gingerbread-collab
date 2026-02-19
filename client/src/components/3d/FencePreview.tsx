import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import { snapPointToGrid } from '../../utils/gridSnap'

const PREVIEW_COLOR = '#C4884A'
const RAIL_HEIGHT = 0.24
const RAIL_THICKNESS = 0.035
const RAIL_DEPTH = 0.035

/**
 * Ghost preview of fence line being drawn
 */
export default function FencePreview() {
    const { camera, gl } = useThree()
    const meshRef = useRef<THREE.Mesh>(null)
    const mouseRef = useRef(new THREE.Vector2())
    const raycaster = useRef(new THREE.Raycaster())
    const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
    const intersectPoint = useRef(new THREE.Vector3())

    const buildMode = useGameStore((state) => state.buildMode)
    const fenceDrawingStartPoint = useGameStore((state) => state.fenceDrawingStartPoint)
    const gridSnapEnabled = useGameStore((state) => state.gridSnapEnabled)
    const gridSize = useGameStore((state) => state.gridSize)

    useFrame(() => {
        if (buildMode !== 'fence' || !fenceDrawingStartPoint || !meshRef.current) {
            if (meshRef.current) {
                meshRef.current.visible = false
            }
            return
        }

        const canvas = gl.domElement as HTMLCanvasElement & { __fencePreviewMouse?: { x: number, y: number } }
        const mouseState = canvas.__fencePreviewMouse
        if (!mouseState) {
            meshRef.current.visible = false
            return
        }

        mouseRef.current.x = mouseState.x
        mouseRef.current.y = mouseState.y

        raycaster.current.setFromCamera(mouseRef.current, camera)
        const hit = raycaster.current.ray.intersectPlane(dragPlane.current, intersectPoint.current)
        if (!hit) {
            meshRef.current.visible = false
            return
        }

        let endX = intersectPoint.current.x
        let endZ = intersectPoint.current.z

        if (gridSnapEnabled) {
            const snapped = snapPointToGrid([endX, endZ], gridSize)
            endX = snapped[0]
            endZ = snapped[1]
        }

        const [startX, startZ] = fenceDrawingStartPoint
        const dx = endX - startX
        const dz = endZ - startZ
        const length = Math.sqrt(dx * dx + dz * dz)

        if (length < 0.02) {
            meshRef.current.visible = false
            return
        }

        meshRef.current.position.set(
            (startX + endX) / 2,
            RAIL_HEIGHT,
            (startZ + endZ) / 2
        )
        meshRef.current.rotation.set(0, -Math.atan2(dz, dx), 0)
        meshRef.current.scale.set(length, RAIL_THICKNESS, RAIL_DEPTH)
        meshRef.current.visible = true
    })

    return (
        <mesh ref={meshRef} visible={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
                color={PREVIEW_COLOR}
                transparent
                opacity={0.45}
                depthWrite={false}
            />
        </mesh>
    )
}
