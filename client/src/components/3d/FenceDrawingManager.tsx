import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import { snapPointToGrid } from '../../utils/gridSnap'
import { playGlobalSound, SoundType } from '../../hooks/useSoundEffects'

const BUILD_SURFACE_SIZE = 5 // Half-size bounds

/**
 * Handles fence drawing interactions
 * - First click sets start point
 * - Second click creates a fence line and resets
 * - Escape cancels drawing
 */
export default function FenceDrawingManager() {
    const { camera, gl } = useThree()

    const raycaster = useRef(new THREE.Raycaster())
    const mouse = useRef(new THREE.Vector2())
    const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
    const intersectPoint = useRef(new THREE.Vector3())

    useEffect(() => {
        const canvas = gl.domElement as HTMLCanvasElement & { __fencePreviewMouse?: { x: number, y: number } }

        canvas.__fencePreviewMouse = { x: 0, y: 0 }

        const updateMousePosition = (event: MouseEvent | PointerEvent) => {
            const rect = canvas.getBoundingClientRect()
            mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
            mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

            if (canvas.__fencePreviewMouse) {
                canvas.__fencePreviewMouse.x = mouse.current.x
                canvas.__fencePreviewMouse.y = mouse.current.y
            }
        }

        const raycastToPlane = () => {
            raycaster.current.setFromCamera(mouse.current, camera)
            const hit = raycaster.current.ray.intersectPlane(dragPlane.current, intersectPoint.current)
            return hit ? hit.clone() : null
        }

        const clampToBounds = (x: number, z: number): [number, number] => {
            return [
                THREE.MathUtils.clamp(x, -BUILD_SURFACE_SIZE, BUILD_SURFACE_SIZE),
                THREE.MathUtils.clamp(z, -BUILD_SURFACE_SIZE, BUILD_SURFACE_SIZE)
            ]
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (!event.isPrimary) return
            if (event.button !== 0) return
            if (event.shiftKey) return

            const state = useGameStore.getState()
            if (state.buildMode !== 'fence') return

            event.preventDefault()
            updateMousePosition(event)
            const point = raycastToPlane()
            if (!point) return

            let x = point.x
            let z = point.z

            if (state.gridSnapEnabled) {
                const snapped = snapPointToGrid([x, z], state.gridSize)
                x = snapped[0]
                z = snapped[1]
            }

            const [clampedX, clampedZ] = clampToBounds(x, z)

            if (!state.fenceDrawingStartPoint) {
                state.setFenceDrawingStartPoint([clampedX, clampedZ])
                playGlobalSound(SoundType.GRAB)
                return
            }

            const [startX, startZ] = state.fenceDrawingStartPoint
            state.clearFenceDrawingStartPoint()

            state.createFenceLine([startX, startZ], [clampedX, clampedZ], state.gridSize)
                .catch((error) => {
                    console.error('Failed to create fence line:', error)
                })
        }

        const handlePointerMove = (event: PointerEvent) => {
            updateMousePosition(event)
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            const state = useGameStore.getState()

            if (state.buildMode !== 'fence') return

            if (event.key === 'Escape' && state.fenceDrawingStartPoint) {
                state.clearFenceDrawingStartPoint()
            }
        }

        const handleContextMenu = (event: MouseEvent) => {
            const state = useGameStore.getState()

            if (state.buildMode === 'fence' && state.fenceDrawingStartPoint) {
                event.preventDefault()
                state.clearFenceDrawingStartPoint()
            }
        }

        canvas.addEventListener('pointerdown', handlePointerDown)
        canvas.addEventListener('pointermove', handlePointerMove)
        canvas.addEventListener('contextmenu', handleContextMenu)
        window.addEventListener('keydown', handleKeyDown)

        return () => {
            canvas.removeEventListener('pointerdown', handlePointerDown)
            canvas.removeEventListener('pointermove', handlePointerMove)
            canvas.removeEventListener('contextmenu', handleContextMenu)
            window.removeEventListener('keydown', handleKeyDown)
            delete (canvas as any).__fencePreviewMouse
        }
    }, [camera, gl])

    return null
}
