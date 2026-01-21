import { useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import { WallState } from '../../types'

// Gingerbread wall colors (medium-dark brown)
const WALL_EMISSIVE = '#2a1810'

/**
 * Create a procedural gingerbread texture using canvas
 */
function createGingerbreadTexture(width = 256, height = 256) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    if (!ctx) return new THREE.CanvasTexture(canvas)

    // Base gingerbread color (medium-dark brown)
    const baseR = 110, baseG = 72, baseB = 35 // #6E4823

    // Fill with base color
    ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`
    ctx.fillRect(0, 0, width, height)

    // Add subtle color variation (baked texture)
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4

            // Large-scale variation (lighter/darker patches)
            const patchNoise = Math.sin(x * 0.05) * Math.cos(y * 0.05) * 15

            // Medium noise for texture
            const medNoise = (Math.random() - 0.5) * 20

            // Small pores/bumps
            const poreChance = Math.random()
            let poreEffect = 0
            if (poreChance > 0.97) {
                poreEffect = -25 // Dark pore
            } else if (poreChance > 0.94) {
                poreEffect = 15 // Light spot
            }

            // Subtle horizontal banding (like layers in baked goods)
            const bandNoise = Math.sin(y * 0.3) * 5

            const totalNoise = patchNoise + medNoise + poreEffect + bandNoise

            data[i] = Math.max(0, Math.min(255, baseR + totalNoise))
            data[i + 1] = Math.max(0, Math.min(255, baseG + totalNoise * 0.6))
            data[i + 2] = Math.max(0, Math.min(255, baseB + totalNoise * 0.3))
        }
    }

    ctx.putImageData(imageData, 0, 0)

    // Add some darker edge spots (like slightly darker baked areas)
    const edgeSpots = 5 + Math.floor(Math.random() * 5)
    for (let i = 0; i < edgeSpots; i++) {
        const spotX = Math.random() * width
        const spotY = Math.random() * height
        const spotRadius = 3 + Math.random() * 8

        const gradient = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotRadius)
        gradient.addColorStop(0, 'rgba(140, 100, 60, 0.25)')
        gradient.addColorStop(1, 'rgba(140, 100, 60, 0)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(spotX, spotY, spotRadius, 0, Math.PI * 2)
        ctx.fill()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.needsUpdate = true // Force texture upload for Firefox compatibility

    return texture
}

// Create shared gingerbread texture (created once)
let sharedGingerbreadTexture: THREE.CanvasTexture | null = null
function getGingerbreadTexture() {
    if (!sharedGingerbreadTexture) {
        sharedGingerbreadTexture = createGingerbreadTexture(512, 512)
        sharedGingerbreadTexture.repeat.set(2, 2)
    }
    return sharedGingerbreadTexture
}

interface WallSegmentProps {
    wall: WallState
    isOwner: boolean
    onDelete: (id: string) => void
}

/**
 * Single wall segment component
 */
function WallSegment({ wall, isOwner, onDelete }: WallSegmentProps) {
    const texture = useMemo(() => getGingerbreadTexture(), [])

    const geometry = useMemo(() => {
        const [startX, startZ] = wall.start
        const [endX, endZ] = wall.end

        // Calculate wall dimensions
        const dx = endX - startX
        const dz = endZ - startZ
        const length = Math.sqrt(dx * dx + dz * dz)

        // Prevent zero-length walls
        if (length < 0.1) return null

        return {
            position: [(startX + endX) / 2, wall.height / 2, (startZ + endZ) / 2] as [number, number, number],
            rotation: [0, -Math.atan2(dz, dx), 0] as [number, number, number],
            args: [length, wall.height, wall.thickness] as [number, number, number]
        }
    }, [wall])

    if (!geometry) return null

    const handleContextMenu = (e: any) => {
        if (isOwner && onDelete) {
            e.stopPropagation()
            onDelete(wall.wallId)
        }
    }

    return (
        <mesh
            position={geometry.position}
            rotation={geometry.rotation}
            castShadow
            receiveShadow
            userData={{ wallId: wall.wallId }}
            onContextMenu={handleContextMenu}
        >
            <boxGeometry args={geometry.args} />
            <meshStandardMaterial
                map={texture}
                emissive={WALL_EMISSIVE}
                emissiveIntensity={0.1}
                roughness={0.85}
                metalness={0.05}
            />
        </mesh>
    )
}

/**
 * Renders all wall segments from game state
 */
export default function WallSegments() {
    const walls = useGameStore((state) => state.walls)
    const userId = useGameStore((state) => state.userId)
    const deleteWall = useGameStore((state) => state.deleteWall)

    const wallArray = useMemo(() => {
        return Array.from(walls.values())
    }, [walls])

    return (
        <group name="wall-segments">
            {wallArray.map((wall) => (
                <WallSegment
                    key={wall.wallId}
                    wall={wall}
                    isOwner={wall.createdBy === userId}
                    onDelete={deleteWall}
                />
            ))}
        </group>
    )
}
