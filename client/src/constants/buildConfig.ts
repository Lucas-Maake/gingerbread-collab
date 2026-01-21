/**
 * Centralized build configuration constants
 * Single source of truth for all gameplay-related values
 */

// ===========================================
// BUILD SURFACE
// ===========================================
export const BUILD_SURFACE = {
    SIZE: 10,           // Total size in world units
    CELL_SIZE: 0.25,    // Grid cell size for placement
} as const

// ===========================================
// WALL CONSTANTS
// ===========================================
export const WALL = {
    HEIGHT: 1.5,        // Default wall height
    THICKNESS: 0.15,    // Wall thickness
} as const

// ===========================================
// ROOF CONSTANTS
// ===========================================
export const ROOF = {
    ANGLE_DEGREES: 30,                          // Pitched roof angle in degrees
    ANGLE_RADIANS: Math.PI / 6,                 // Pitched roof angle in radians (30°)
    THICKNESS: 0.1,                             // Roof panel thickness
    OVERHANG: 0.15,                             // How far roof extends past walls
} as const

// ===========================================
// SNAPPING CONSTANTS
// ===========================================
export const SNAP = {
    DISTANCE: 0.6,              // How close before piece snaps to wall
    ROOF_DISTANCE: 0.8,         // Snap distance for roof surfaces
    ROOF_SEARCH_RADIUS: 3.0,    // Search radius for roof-only pieces (chimney)
    HEIGHT_STEP: 0.1,           // Scroll wheel height adjustment increment
    MIN_HEIGHT: 0.1,            // Minimum center height for snapped pieces
    MAX_HEIGHT: 1.3,            // Maximum center height (below wall top)
    SURFACE_OFFSET: 0.005,      // Small gap to prevent z-fighting
} as const

// ===========================================
// INTERACTION CONSTANTS
// ===========================================
export const INTERACTION = {
    ROTATION_SPEED: Math.PI / 8,    // 22.5 degrees per keypress
    DRAG_PLANE_Y: 0.1,              // Height of drag plane above surface
} as const

// ===========================================
// COLORS
// ===========================================
export const COLORS = {
    GINGERBREAD: '#5A3A1A',
    GINGERBREAD_DARK: '#3D2812',
    FROSTING: '#FFFAF0',
    CANDY_RED: '#DC143C',
    CANDY_GREEN: '#228B22',
    CANDY_WHITE: '#FFFAFA',
    CANDY_PINK: '#FF69B4',
    CANDY_YELLOW: '#FFD700',
} as const

// Candy colors for random variation
export const CANDY_COLORS: readonly string[] = [
    COLORS.CANDY_RED,
    COLORS.CANDY_GREEN,
    COLORS.CANDY_PINK,
    COLORS.CANDY_YELLOW,
    COLORS.CANDY_WHITE,
]
