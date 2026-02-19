/**
 * Piece snapping utilities
 * Allows windows, doors, and decorative pieces to snap to wall and roof surfaces
 */

import * as THREE from 'three'
import { SNAP } from '../constants/buildConfig'
import {
    getPieceSize,
    WINDOW_DOOR_PIECES,
    WALL_DECORATIVE_PIECES,
    ROOF_ONLY_PIECES,
    DECORATIVE_SNAPPABLE_PIECES,
    SNAPPABLE_PIECES,
    SNAP_TARGET_PIECES
} from '../constants/pieceConfigs'
import type {
    PieceType,
    PieceState,
    WallState,
    SnapResult,
    // SurfaceType, // Removed as per instruction
    PieceSize,
    Position,
    Normal
} from '../types'

// Re-export for backward compatibility
export { SNAPPABLE_PIECES, DECORATIVE_SNAPPABLE_PIECES }

/**
 * Check if a piece type can snap to walls/roofs
 */
export function isSnappable(pieceType: PieceType): boolean {
    return SNAPPABLE_PIECES.includes(pieceType)
}

/**
 * Check if a piece is a decorative snappable (not window/door)
 */
export function isDecorativeSnappable(pieceType: PieceType): boolean {
    return DECORATIVE_SNAPPABLE_PIECES.includes(pieceType)
}

/**
 * Check if a piece only snaps to roofs (not walls)
 */
export function isRoofOnlyPiece(pieceType: PieceType): boolean {
    return ROOF_ONLY_PIECES.includes(pieceType)
}

/**
 * Check if a piece can snap to walls
 */
export function canSnapToWalls(pieceType: PieceType): boolean {
    return WINDOW_DOOR_PIECES.includes(pieceType) || WALL_DECORATIVE_PIECES.includes(pieceType)
}

/**
 * Check if a piece is a window or door
 */
export function isWindowOrDoor(pieceType: PieceType): boolean {
    return WINDOW_DOOR_PIECES.includes(pieceType)
}

/**
 * Check if a piece type can be snapped to
 */
export function isSnapTarget(pieceType: PieceType): boolean {
    return SNAP_TARGET_PIECES.includes(pieceType)
}

interface SnapOptions {
    preferSurface?: 'wall' | 'roof' | null
    wallSnapDistance?: number
}

/**
 * Calculate snap position from a direct surface hit (raycast).
 * This keeps placement aligned to the cursor's hit point on walls/roofs.
 */
export function calculateSnapFromSurfaceHit(
    pieceType: PieceType,
    hitPoint: Position,
    hitNormal: Normal,
    surfaceType: 'wall' | 'roof',
    surfaceId: string | null,
    allPieces: Map<string, PieceState>,
    allWalls: Map<string, WallState>,
    options: SnapOptions = {}
): SnapResult {
    if (!isSnappable(pieceType)) {
        return { snapped: false, position: hitPoint, yaw: 0, pitch: 0, normal: null, targetId: null, surfaceType: null }
    }

    const pieceSize = getPieceSize(pieceType)
    if (!pieceSize) {
        return { snapped: false, position: hitPoint, yaw: 0, pitch: 0, normal: null, targetId: null, surfaceType: null }
    }

    const wallSnapDistance = options.wallSnapDistance ?? SNAP.DISTANCE

    if (surfaceType === 'roof') {
        if (!isDecorativeSnappable(pieceType)) {
            return { snapped: false, position: hitPoint, yaw: 0, pitch: 0, normal: null, targetId: null, surfaceType: null }
        }

        const normalVec = new THREE.Vector3(hitNormal[0], hitNormal[1], hitNormal[2]).normalize()
        if (normalVec.y < 0) {
            normalVec.negate()
        }

        const isRoofOnly = isRoofOnlyPiece(pieceType)
        const surfaceOffset = pieceSize.height / 2 + 0.02
        const offsetVec = isRoofOnly ? new THREE.Vector3(0, 1, 0) : normalVec
        const snapPos: Position = [
            hitPoint[0] + offsetVec.x * surfaceOffset,
            hitPoint[1] + offsetVec.y * surfaceOffset,
            hitPoint[2] + offsetVec.z * surfaceOffset
        ]

        return {
            snapped: true,
            position: snapPos,
            yaw: 0,
            pitch: 0,
            normal: [normalVec.x, normalVec.y, normalVec.z],
            targetId: 'roof',
            surfaceType: 'roof'
        }
    }

    if (surfaceType === 'wall') {
        if (!canSnapToWalls(pieceType)) {
            return { snapped: false, position: hitPoint, yaw: 0, pitch: 0, normal: null, targetId: null, surfaceType: null }
        }

        if (surfaceId && allWalls.has(surfaceId)) {
            const wall = allWalls.get(surfaceId)
            if (!wall) {
                return { snapped: false, position: hitPoint, yaw: 0, pitch: 0, normal: null, targetId: null, surfaceType: null }
            }

            const snapResult = calculateDrawnWallSnap(pieceType, hitPoint, wall, pieceSize, wallSnapDistance)
            if (!snapResult) {
                return { snapped: false, position: hitPoint, yaw: 0, pitch: 0, normal: null, targetId: null, surfaceType: null }
            }

            return {
                snapped: true,
                position: snapResult.position,
                yaw: snapResult.yaw,
                pitch: 0,
                normal: snapResult.normal || null,
                targetId: surfaceId,
                surfaceType: 'wall'
            }
        }

        if (surfaceId) {
            const wallPiece = allPieces.get(surfaceId)
            if (wallPiece && isSnapTarget(wallPiece.type)) {
                const wallSize = getPieceSize(wallPiece.type)
                if (wallSize) {
                    const snapResult = calculateWallPieceSnap(
                        pieceType,
                        hitPoint,
                        wallPiece.type,
                        wallPiece.pos,
                        wallPiece.yaw || 0,
                        wallSize,
                        pieceSize,
                        wallSnapDistance
                    )
                    if (snapResult) {
                        return {
                            snapped: true,
                            position: snapResult.position,
                            yaw: snapResult.yaw,
                            pitch: 0,
                            normal: snapResult.normal || null,
                            targetId: surfaceId,
                            surfaceType: 'wall'
                        }
                    }
                }
            }
        }
    }

    return { snapped: false, position: hitPoint, yaw: 0, pitch: 0, normal: null, targetId: null, surfaceType: null }
}

/**
 * Calculate snap position for a piece relative to walls and roofs
 */
export function calculateSnapPosition(
    pieceType: PieceType,
    piecePos: Position,
    pieceYaw: number,
    allPieces: Map<string, PieceState>,
    excludePieceId: string,
    allWalls: Map<string, WallState> = new Map(),
    scene: THREE.Scene | null = null,
    options: SnapOptions = {}
): SnapResult {
    if (!isSnappable(pieceType)) {
        return { snapped: false, position: piecePos, yaw: pieceYaw, pitch: 0, normal: null, targetId: null, surfaceType: null }
    }

    const pieceSize = getPieceSize(pieceType)
    if (!pieceSize) {
        return { snapped: false, position: piecePos, yaw: pieceYaw, pitch: 0, normal: null, targetId: null, surfaceType: null }
    }

    const preferSurface = options.preferSurface ?? null
    const wallSnapDistance = options.wallSnapDistance ?? SNAP.DISTANCE
    let closestSnap: SnapResult | null = null
    let closestDistance = Number.POSITIVE_INFINITY
    const isDecorative = isDecorativeSnappable(pieceType)
    const isRoofOnly = isRoofOnlyPiece(pieceType)
    const canSnapWall = canSnapToWalls(pieceType)

    // Skip wall checks for roof-only pieces (like chimney)
    if (!isRoofOnly && canSnapWall) {
        // Check each pre-built wall piece
        for (const [id, piece] of allPieces.entries()) {
            if (id === excludePieceId) continue
            if (!isSnapTarget(piece.type)) continue
            if (piece.heldBy !== null) continue // Don't snap to held pieces

            const wallSize = getPieceSize(piece.type)
            if (!wallSize) continue

            const wallPos = piece.pos
            const wallYaw = piece.yaw || 0

            // Calculate distance to wall center (XZ plane)
            const dx = piecePos[0] - wallPos[0]
            const dz = piecePos[2] - wallPos[2]
            const horizontalDist = Math.sqrt(dx * dx + dz * dz)

            // Skip if too far away
            if (horizontalDist > wallSnapDistance + Math.max(wallSize.width, wallSize.depth)) {
                continue
            }

            // Determine wall orientation and calculate snap position
            const snapResult = calculateWallPieceSnap(
                pieceType,
                piecePos,
                piece.type,
                wallPos,
                wallYaw,
                wallSize,
                pieceSize,
                wallSnapDistance
            )

            if (snapResult && snapResult.distance < closestDistance) {
                closestDistance = snapResult.distance
                closestSnap = {
                    snapped: true,
                    position: snapResult.position,
                    yaw: snapResult.yaw,
                    pitch: 0,
                    normal: snapResult.normal || null,
                    targetId: id,
                    surfaceType: 'wall'
                }
            }
        }

        // Check each drawn wall segment
        for (const [wallId, wall] of allWalls.entries()) {
            const snapResult = calculateDrawnWallSnap(
                pieceType,
                piecePos,
                wall,
                pieceSize,
                wallSnapDistance
            )

            if (snapResult && snapResult.distance < closestDistance) {
                closestDistance = snapResult.distance as number
                closestSnap = {
                    snapped: true,
                    position: snapResult.position,
                    yaw: snapResult.yaw,
                    pitch: 0,
                    normal: snapResult.normal || null,
                    targetId: wallId,
                    surfaceType: 'wall'
                }
            }
        }
    } // End of wall checks (skipped for roof-only pieces)

    // Check roof surfaces for decorative pieces (if scene provided)
    let roofSnap: SnapResult | null = null
    if (isDecorative && scene) {
        const roofSnapResult = calculateRoofSnap(pieceType, piecePos, pieceSize, scene)
        if (roofSnapResult) {
            roofSnap = {
                snapped: true,
                position: roofSnapResult.position,
                yaw: roofSnapResult.yaw,
                pitch: 0,
                normal: roofSnapResult.normal || [0, 1, 0],
                targetId: 'roof',
                surfaceType: 'roof'
            }
        }
    }

    if (preferSurface === 'roof' && roofSnap) {
        return roofSnap
    }

    if (preferSurface === 'wall' && closestSnap) {
        return closestSnap
    }

    if (roofSnap && closestSnap) {
        // Prefer roof when available, but allow wall if the piece is very close to it.
        const wallPriorityDistance = wallSnapDistance * 0.4
        if (closestDistance <= wallPriorityDistance) {
            return closestSnap
        }
        return roofSnap
    }

    if (closestSnap) {
        return closestSnap
    }

    if (roofSnap) {
        return roofSnap
    }

    return { snapped: false, position: piecePos, yaw: pieceYaw, pitch: 0, normal: null, targetId: null, surfaceType: null }
}

interface SnapMatch {
    position: Position
    yaw: number
    normal: Normal
    distance: number
}

/**
 * Calculate snap position for a piece on a pre-built wall piece
 */
function calculateWallPieceSnap(
    pieceType: PieceType,
    piecePos: Position,
    wallType: PieceType,
    wallPos: Position,
    _wallYaw: number,
    wallSize: PieceSize,
    pieceSize: PieceSize,
    snapDistance: number
): SnapMatch | null {
    // Wall thickness
    const wallThickness = wallSize.axis === 'z' ? wallSize.depth : wallSize.width

    // For decorative pieces that lay flat, use height (the thin dimension) for offset
    // For doors/windows that stand upright, use depth
    const isDecorative = isDecorativeSnappable(pieceType)
    const pieceOffsetDim = isDecorative ? pieceSize.height : pieceSize.depth

    // Piece offset from wall surface - position piece flush against wall
    const surfaceOffset = (wallThickness / 2) + (pieceOffsetDim / 2) + 0.005

    // Calculate based on wall type
    if (wallType === 'WALL_FRONT' || wallType === 'WALL_BACK') {
        // Wall extends along X axis, thin in Z
        const dx = piecePos[0] - wallPos[0]
        const dz = piecePos[2] - wallPos[2]

        // Check if within wall width bounds (with some margin)
        if (Math.abs(dx) > wallSize.width / 2 + snapDistance) {
            return null
        }

        // Distance to the wall plane (not surface)
        const distToWallCenter = Math.abs(dz)

        // Check if close enough to snap
        if (distToWallCenter < wallThickness / 2 + snapDistance) {
            // Determine which side to snap to based on approach direction
            const side = dz >= 0 ? 1 : -1

            // Snap to wall surface
            const snapZ = wallPos[2] + (side * surfaceOffset)

            // Clamp X to wall bounds
            const halfWidth = wallSize.width / 2 - pieceSize.width / 2 - 0.02
            const snapX = Math.max(wallPos[0] - halfWidth, Math.min(wallPos[0] + halfWidth, piecePos[0]))

            // Determine Y position (doors at bottom, windows can be anywhere on wall)
            let snapY
            if (pieceType === 'DOOR') {
                snapY = pieceSize.height / 2 // Door sits on ground
            } else {
                // Windows - keep current Y but clamp to wall bounds
                const minY = pieceSize.height / 2 + 0.05
                const maxY = wallSize.height - pieceSize.height / 2 - 0.05
                snapY = Math.max(minY, Math.min(maxY, piecePos[1] || wallSize.height / 2))
            }

            // Rotation: piece faces outward from the wall (perpendicular)
            const snapYaw = side > 0 ? 0 : Math.PI
            // Normal direction for decorative piece orientation
            const normal: Normal = [0, 0, side]

            return {
                position: [snapX, snapY, snapZ],
                yaw: snapYaw,
                normal: normal,
                distance: distToWallCenter
            }
        }
    } else if (wallType === 'WALL_LEFT' || wallType === 'WALL_RIGHT') {
        // Wall extends along Z axis, thin in X
        const dx = piecePos[0] - wallPos[0]
        const dz = piecePos[2] - wallPos[2]

        // Check if within wall depth bounds (with some margin)
        if (Math.abs(dz) > wallSize.depth / 2 + snapDistance) {
            return null
        }

        // Distance to the wall plane
        const distToWallCenter = Math.abs(dx)

        // Check if close enough to snap
        if (distToWallCenter < wallThickness / 2 + snapDistance) {
            // Determine which side to snap to
            const side = dx >= 0 ? 1 : -1

            // Snap to wall surface
            const snapX = wallPos[0] + (side * surfaceOffset)

            // Clamp Z to wall bounds
            const halfDepth = wallSize.depth / 2 - pieceSize.width / 2 - 0.02
            const snapZ = Math.max(wallPos[2] - halfDepth, Math.min(wallPos[2] + halfDepth, piecePos[2]))

            // Determine Y position
            let snapY
            if (pieceType === 'DOOR') {
                snapY = pieceSize.height / 2
            } else {
                const minY = pieceSize.height / 2 + 0.05
                const maxY = wallSize.height - pieceSize.height / 2 - 0.05
                snapY = Math.max(minY, Math.min(maxY, piecePos[1] || wallSize.height / 2))
            }

            // Rotation: piece faces outward from the wall (perpendicular)
            const snapYaw = side > 0 ? Math.PI / 2 : -Math.PI / 2
            // Normal direction for decorative piece orientation
            const normal: Normal = [side, 0, 0]

            return {
                position: [snapX, snapY, snapZ],
                yaw: snapYaw,
                normal: normal,
                distance: distToWallCenter
            }
        }
    }

    return null
}

/**
 * Calculate snap position for a piece on a drawn wall segment
 */
function calculateDrawnWallSnap(
    pieceType: PieceType,
    piecePos: Position,
    wall: WallState,
    pieceSize: PieceSize,
    snapDistance: number
): SnapMatch | null {
    const [startX, startZ] = wall.start
    const [endX, endZ] = wall.end
    const wallHeight = wall.height || 1.5
    const wallThickness = wall.thickness || 0.15

    // Calculate wall vector and length
    const wallDx = endX - startX
    const wallDz = endZ - startZ
    const wallLength = Math.sqrt(wallDx * wallDx + wallDz * wallDz)

    // Skip very short walls
    if (wallLength < 0.2) return null

    // Normalize wall direction
    const wallDirX = wallDx / wallLength
    const wallDirZ = wallDz / wallLength

    // Wall center
    const wallCenterX = (startX + endX) / 2
    const wallCenterZ = (startZ + endZ) / 2

    // Vector from wall center to piece
    // const toPieceX = piecePos[0] - wallCenterX
    // const toPieceZ = piecePos[2] - wallCenterZ

    // Project piece position onto wall line (parametric t)
    // t = 0 at start, t = 1 at end
    const toStartX = piecePos[0] - startX
    const toStartZ = piecePos[2] - startZ
    let t = (toStartX * wallDirX + toStartZ * wallDirZ) / wallLength

    // Clamp t to wall bounds with margin for piece width
    const pieceHalfWidth = pieceSize.width / 2
    const marginT = pieceHalfWidth / wallLength
    t = Math.max(marginT, Math.min(1 - marginT, t))

    // Closest point on wall line
    const closestX = startX + t * wallDx
    const closestZ = startZ + t * wallDz

    // Perpendicular distance from piece to wall line
    // Cross product gives signed distance
    const perpDist = (piecePos[0] - closestX) * (-wallDirZ) + (piecePos[2] - closestZ) * wallDirX

    // Absolute distance to wall center line
    const distToLine = Math.abs(perpDist)

    // Check if close enough
    if (distToLine > snapDistance + wallThickness / 2) {
        return null
    }

    // Determine which side to snap to
    const side = perpDist >= 0 ? 1 : -1

    // For decorative pieces that lay flat, use height (the thin dimension) for offset
    // For doors/windows that stand upright, use depth
    const isDecorative = isDecorativeSnappable(pieceType)
    const pieceOffsetDim = isDecorative ? pieceSize.height : pieceSize.depth

    // Offset from wall surface
    const surfaceOffset = (wallThickness / 2) + (pieceOffsetDim / 2) + 0.005

    // Normal vector (perpendicular to wall)
    const normalX = -wallDirZ * side
    const normalZ = wallDirX * side

    // Snap position on wall surface
    const snapX = closestX + normalX * surfaceOffset
    const snapZ = closestZ + normalZ * surfaceOffset

    // Determine Y position
    let snapY
    if (pieceType === 'DOOR') {
        snapY = pieceSize.height / 2 // Door sits on ground
    } else {
        // Windows - keep current Y but clamp to wall bounds
        const minY = pieceSize.height / 2 + 0.05
        const maxY = wallHeight - pieceSize.height / 2 - 0.05
        snapY = Math.max(minY, Math.min(maxY, piecePos[1] || wallHeight / 2))
    }

    // Calculate yaw to face outward (perpendicular to wall)
    // atan2 gives angle of normal vector
    const snapYaw = Math.atan2(normalX, normalZ)

    return {
        position: [snapX, snapY, snapZ],
        yaw: snapYaw,
        normal: [normalX, 0, normalZ],
        distance: distToLine
    }
}

/**
 * Calculate snap position for a piece on roof surfaces
 */
function calculateRoofSnap(
    pieceType: PieceType,
    piecePos: Position,
    pieceSize: PieceSize,
    scene: THREE.Scene
): SnapMatch | null {
    // Get roof meshes from scene
    const roofMeshes: THREE.Object3D[] = []
    scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && child.parent?.name === 'auto-roofs') {
            roofMeshes.push(child)
        }
    })

    if (roofMeshes.length === 0) return null

    const isRoofOnly = isRoofOnlyPiece(pieceType)
    let bestHit: THREE.Intersection | null = null
    let bestDistance = Infinity

    // For roof-only pieces (like chimney), cast rays in a grid pattern to find nearby roofs
    // This allows snapping even when not directly under the roof
    if (isRoofOnly) {
        const searchRadius = 3.0 // Search within 3 units
        const gridStep = 0.5 // Check every 0.5 units
        const raycaster = new THREE.Raycaster()

        for (let dx = -searchRadius; dx <= searchRadius; dx += gridStep) {
            for (let dz = -searchRadius; dz <= searchRadius; dz += gridStep) {
                const testX = piecePos[0] + dx
                const testZ = piecePos[2] + dz
                const rayOrigin = new THREE.Vector3(testX, 10, testZ)
                const rayDirection = new THREE.Vector3(0, -1, 0)
                raycaster.set(rayOrigin, rayDirection)

                const intersects = raycaster.intersectObjects(roofMeshes, false)
                if (intersects.length > 0) {
                    const hit = intersects[0]
                    // Calculate distance from piece position to this hit point
                    const dist = Math.sqrt(
                        Math.pow(piecePos[0] - hit.point.x, 2) +
                        Math.pow(piecePos[2] - hit.point.z, 2)
                    )
                    if (dist < bestDistance) {
                        bestDistance = dist
                        bestHit = hit
                    }
                }
            }
        }
    } else {
        // For other decorative pieces, just cast straight down
        const raycaster = new THREE.Raycaster()
        const rayOrigin = new THREE.Vector3(piecePos[0], 10, piecePos[2])
        const rayDirection = new THREE.Vector3(0, -1, 0)
        raycaster.set(rayOrigin, rayDirection)

        const intersects = raycaster.intersectObjects(roofMeshes, false)
        if (intersects.length > 0) {
            bestHit = intersects[0]
            const dx = piecePos[0] - bestHit.point.x
            const dz = piecePos[2] - bestHit.point.z
            bestDistance = Math.sqrt(dx * dx + dz * dz)
        }
    }

    if (!bestHit) return null

    const hit = bestHit as THREE.Intersection
    const point = hit.point

    // Get surface normal in world space
    let normal = hit.face?.normal?.clone() || new THREE.Vector3(0, 1, 0)
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object!.matrixWorld)
    normal.applyMatrix3(normalMatrix).normalize()

    // Flip normal if pointing downward (face winding issue)
    if (normal.y < 0) {
        normal.negate()
    }

    // Only snap if the surface is somewhat horizontal (roof surfaces, not vertical walls)
    if (normal.y < 0.3) {
        return null
    }

    // For roof-only pieces, use a more generous snap distance
    const maxSnapDist = isRoofOnly ? SNAP.ROOF_SEARCH_RADIUS : SNAP.ROOF_DISTANCE
    if (bestDistance > maxSnapDist) return null

    // For pieces that lay flat on the roof, the "height" is the thin dimension
    // that sticks out from the surface. We offset along the roof normal direction.
    // For angled roofs, we need to offset perpendicular to the surface.
    const surfaceOffset = pieceSize.height / 2 + 0.02

    const offsetVector = isRoofOnly ? new THREE.Vector3(0, 1, 0) : normal

    // The snap position needs to be offset along the surface normal for flat-on-roof pieces.
    // Roof-only pieces (chimney) stay upright and offset vertically.
    const snapPos: Position = [
        point.x + offsetVector.x * surfaceOffset,
        point.y + offsetVector.y * surfaceOffset,
        point.z + offsetVector.z * surfaceOffset
    ]

    // Keep piece upright on roof
    const snapYaw = 0

    return {
        position: snapPos,
        yaw: snapYaw,
        normal: [normal.x, normal.y, normal.z],
        distance: bestDistance
    }
}
