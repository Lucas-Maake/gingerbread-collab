import { useMemo, MouseEvent } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import { IcingState } from '../../types'

const ICING_COLOR = '#FFFFFF'
const ICING_EMISSIVE = '#FFFFFF'
const TUBE_SEGMENTS = 32
const RADIAL_SEGMENTS = 8

interface IcingStrokeProps {
    icing: IcingState
    isOwner: boolean
    onDelete?: (id: string) => void
}

/**
 * Single icing stroke component
 * Renders as a TubeGeometry following the path
 */
function IcingStroke({ icing, isOwner, onDelete }: IcingStrokeProps) {
    const geometry = useMemo(() => {
        if (!icing.points || icing.points.length < 2) return null

        // Create curve from points
        const curvePoints = icing.points.map(
            p => new THREE.Vector3(p[0], p[1], p[2])
        )

        // Use CatmullRomCurve3 for smooth interpolation
        const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.5)

        // Calculate tube segments based on path length
        const pathLength = curve.getLength()
        const segments = Math.max(8, Math.floor(pathLength * TUBE_SEGMENTS))

        // Create tube geometry
        return new THREE.TubeGeometry(
            curve,
            segments,
            icing.radius || 0.05,
            RADIAL_SEGMENTS,
            false // not closed
        )
    }, [icing.points, icing.radius])

    if (!geometry) return null

    const handleContextMenu = (e: MouseEvent) => {
        if (isOwner && onDelete) {
            e.stopPropagation()
            onDelete(icing.icingId)
        }
    }

    // @ts-ignore
    const handleContextThree = (e) => {
        // Need to bridge the gap between React events and React Three Fiber events if necessary,
        // but R3F `onContextMenu` provides a THREE.Event which is similar.
        // However the R3F event type is tricky, so we use any or specific R3F types if available.
        // Here we assume standard bubbling.
        if (isOwner && onDelete) {
            e.stopPropagation()
            onDelete(icing.icingId)
        }
    }

    return (
        <mesh
            geometry={geometry}
            castShadow
            userData={{ icingId: icing.icingId }}
            onContextMenu={handleContextThree}
        >
            <meshStandardMaterial
                color={ICING_COLOR}
                emissive={ICING_EMISSIVE}
                emissiveIntensity={0.05}
                roughness={0.3}
                metalness={0.0}
            />
        </mesh>
    )
}

/**
 * Icing stroke preview while drawing
 */
export function IcingPreview({ points, radius = 0.05 }: { points: [number, number, number][], radius?: number }) {
    const geometry = useMemo(() => {
        if (!points || points.length < 2) return null

        const curvePoints = points.map(
            p => new THREE.Vector3(p[0], p[1], p[2])
        )

        const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.5)
        const pathLength = curve.getLength()
        const segments = Math.max(8, Math.floor(pathLength * TUBE_SEGMENTS))

        return new THREE.TubeGeometry(curve, segments, radius, RADIAL_SEGMENTS, false)
    }, [points, radius])

    if (!geometry) return null

    return (
        <mesh geometry={geometry}>
            <meshStandardMaterial
                color={ICING_COLOR}
                transparent
                opacity={0.7}
                depthWrite={false}
            />
        </mesh>
    )
}

/**
 * Renders all icing strokes from game state
 */
export default function IcingStrokes() {
    const icing = useGameStore((state) => state.icing)
    const userId = useGameStore((state) => state.userId)
    const deleteIcing = useGameStore((state) => state.deleteIcing)
    const icingDrawingPoints = useGameStore((state) => state.icingDrawingPoints)
    const isDrawingIcing = useGameStore((state) => state.isDrawingIcing)

    const icingArray = useMemo(() => {
        return Array.from(icing.values())
    }, [icing])

    return (
        <group name="icing-strokes">
            {/* Rendered strokes */}
            {icingArray.map((stroke) => (
                <IcingStroke
                    key={stroke.icingId}
                    icing={stroke}
                    isOwner={stroke.createdBy === userId}
                    onDelete={deleteIcing}
                />
            ))}

            {/* Preview while drawing */}
            {isDrawingIcing && icingDrawingPoints.length >= 2 && (
                <IcingPreview points={icingDrawingPoints} />
            )}
        </group>
    )
}
