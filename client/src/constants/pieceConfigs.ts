/**
 * Centralized piece configurations
 * Single source of truth for all piece types, dimensions, and properties
 */

import { COLORS, ROOF } from './buildConfig'
import type { PieceType, PieceConfig, PieceSize } from '../types'

// ===========================================
// PIECE CONFIGURATIONS
// ===========================================

export const PIECE_CONFIGS: Record<PieceType, PieceConfig> = {
    BASE_PLATFORM: {
        geometry: 'box',
        size: [2, 0.15, 2],
        boundingSize: [2, 0.15, 2],
        color: COLORS.GINGERBREAD,
        yOffset: 0.075,
        allowColorOverride: false
    },
    WALL_FRONT: {
        geometry: 'box',
        size: [2, 1.5, 0.15],
        boundingSize: [2, 1.5, 0.15],
        color: COLORS.GINGERBREAD,
        yOffset: 0.75,
        allowColorOverride: false
    },
    WALL_BACK: {
        geometry: 'box',
        size: [2, 1.5, 0.15],
        boundingSize: [2, 1.5, 0.15],
        color: COLORS.GINGERBREAD,
        yOffset: 0.75,
        allowColorOverride: false
    },
    WALL_LEFT: {
        geometry: 'box',
        size: [0.15, 1.5, 2],
        boundingSize: [0.15, 1.5, 2],
        color: COLORS.GINGERBREAD,
        yOffset: 0.75,
        allowColorOverride: false
    },
    WALL_RIGHT: {
        geometry: 'box',
        size: [0.15, 1.5, 2],
        boundingSize: [0.15, 1.5, 2],
        color: COLORS.GINGERBREAD,
        yOffset: 0.75,
        allowColorOverride: false
    },
    ROOF_LEFT: {
        geometry: 'box',
        size: [1.5, 0.12, 2.2],
        boundingSize: [1.5, 0.12, 2.2],
        color: COLORS.GINGERBREAD_DARK,
        yOffset: 0.06,
        rotationX: ROOF.ANGLE_RADIANS,
        allowColorOverride: false
    },
    ROOF_RIGHT: {
        geometry: 'box',
        size: [1.5, 0.12, 2.2],
        boundingSize: [1.5, 0.12, 2.2],
        color: COLORS.GINGERBREAD_DARK,
        yOffset: 0.06,
        rotationX: -ROOF.ANGLE_RADIANS,
        allowColorOverride: false
    },
    DOOR: {
        geometry: 'door',
        size: [0.5, 0.9, 0.08],
        boundingSize: [0.5, 0.9, 0.1],
        color: '#654321',
        yOffset: 0.45,
        allowColorOverride: false
    },
    WINDOW_SMALL: {
        geometry: 'windowSmall',
        size: [0.35, 0.35, 0.08],
        boundingSize: [0.35, 0.35, 0.1],
        color: '#87CEEB',
        yOffset: 0.175,
        allowColorOverride: false
    },
    WINDOW_LARGE: {
        geometry: 'windowLarge',
        size: [0.55, 0.55, 0.08],
        boundingSize: [0.55, 0.55, 0.1],
        color: '#87CEEB',
        yOffset: 0.275,
        allowColorOverride: false
    },
    CANDY_CANE: {
        geometry: 'cylinder',
        size: [0.05, 0.05, 0.5, 8],
        boundingSize: [0.1, 0.5, 0.1],
        color: COLORS.CANDY_RED,
        yOffset: 0.25,
        model: '/models/candy/candy-cane.glb',
        modelScale: 0.01,
        allowColorOverride: false
    },
    GUMDROP: {
        geometry: 'cone',
        size: [0.12, 0.2, 8],
        boundingSize: [0.24, 0.2, 0.24],
        color: COLORS.CANDY_GREEN,
        yOffset: 0.1,
        allowColorOverride: true
    },
    PEPPERMINT: {
        geometry: 'cylinder',
        size: [0.15, 0.15, 0.05, 16],
        boundingSize: [0.3, 0.05, 0.3],
        color: COLORS.CANDY_WHITE,
        yOffset: 0.025,
        allowColorOverride: true
    },
    GINGERBREAD_MAN: {
        geometry: 'gingerbreadMan',
        size: [0.3, 0.45, 0.08],
        boundingSize: [0.25, 0.45, 0.15],
        color: COLORS.GINGERBREAD,
        yOffset: 0.225,
        allowColorOverride: false
    },
    COOKIE_STAR: {
        geometry: 'star',
        size: [0.3, 0.06, 0.3],
        boundingSize: [0.35, 0.06, 0.35],
        color: '#FFD54F',
        yOffset: 0.03,
        allowColorOverride: false
    },
    COOKIE_HEART: {
        geometry: 'heart',
        size: [0.32, 0.06, 0.28],
        boundingSize: [0.35, 0.06, 0.3],
        color: '#FFB6C1',
        yOffset: 0.03,
        allowColorOverride: false
    },
    MINI_TREE: {
        geometry: 'tree',
        size: [0.2, 0.5, 8],
        boundingSize: [0.4, 0.5, 0.4],
        color: COLORS.CANDY_GREEN,
        yOffset: 0.25,
        allowColorOverride: false
    },
    SNOWFLAKE: {
        geometry: 'snowflake',
        size: [0.36, 0.03, 0.36],
        boundingSize: [0.36, 0.04, 0.36],
        color: '#E0FFFF',
        yOffset: 0.02,
        allowColorOverride: false
    },
    CANDY_BUTTON: {
        geometry: 'candyButton',
        size: [0.16, 0.08, 0.16],
        boundingSize: [0.16, 0.08, 0.16],
        color: COLORS.CANDY_RED,
        yOffset: 0.04,
        allowColorOverride: true
    },
    LICORICE: {
        geometry: 'licorice',
        size: [0.08, 0.4, 0.08],
        boundingSize: [0.08, 0.4, 0.08],
        color: '#1a1a1a',
        yOffset: 0.2,
        allowColorOverride: false
    },
    FROSTING_DOLLOP: {
        geometry: 'frostingDollop',
        size: [0.2, 0.15, 0.2],
        boundingSize: [0.2, 0.15, 0.2],
        color: COLORS.FROSTING,
        yOffset: 0.075,
        allowColorOverride: false
    },
    CHIMNEY: {
        geometry: 'chimney',
        size: [0.28, 0.5, 0.28],
        boundingSize: [0.3, 0.5, 0.3],
        color: '#8B0000',
        yOffset: 0.25,
        allowColorOverride: false
    },
    FENCE_POST: {
        geometry: 'fencePost',
        size: [0.1, 0.45, 0.1],
        boundingSize: [0.1, 0.45, 0.1],
        color: COLORS.GINGERBREAD,
        yOffset: 0.225,
        allowColorOverride: false
    },
    PRESENT: {
        geometry: 'present',
        size: [0.22, 0.22, 0.22],
        boundingSize: [0.22, 0.22, 0.22],
        color: COLORS.CANDY_RED,
        yOffset: 0.11,
        allowColorOverride: true
    }
}

// ===========================================
// PIECE CATEGORIES FOR SNAPPING
// ===========================================

export const WINDOW_DOOR_PIECES: readonly PieceType[] = ['DOOR', 'WINDOW_SMALL', 'WINDOW_LARGE']

export const WALL_DECORATIVE_PIECES: readonly PieceType[] = [
    'GUMDROP',
    'PEPPERMINT',
    'COOKIE_STAR',
    'COOKIE_HEART',
    'SNOWFLAKE',
    'CANDY_BUTTON',
    'FROSTING_DOLLOP',
    'PRESENT'
]

export const ROOF_ONLY_PIECES: readonly PieceType[] = ['CHIMNEY']

export const DECORATIVE_SNAPPABLE_PIECES: readonly PieceType[] = [
    ...WALL_DECORATIVE_PIECES,
    ...ROOF_ONLY_PIECES
]

export const SNAPPABLE_PIECES: readonly PieceType[] = [
    ...WINDOW_DOOR_PIECES,
    ...DECORATIVE_SNAPPABLE_PIECES
]

export const SNAP_TARGET_PIECES: readonly PieceType[] = [
    'WALL_FRONT',
    'WALL_BACK',
    'WALL_LEFT',
    'WALL_RIGHT'
]

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Get piece size for snapping calculations
 */
export function getPieceSize(pieceType: PieceType): PieceSize | null {
    const config = PIECE_CONFIGS[pieceType]
    if (!config) return null

    const [width, height, depth] = config.boundingSize
    const result: PieceSize = { width, height, depth }

    // Add axis info for wall pieces
    if (pieceType === 'WALL_FRONT' || pieceType === 'WALL_BACK') {
        result.axis = 'z'
    } else if (pieceType === 'WALL_LEFT' || pieceType === 'WALL_RIGHT') {
        result.axis = 'x'
    }

    return result
}
