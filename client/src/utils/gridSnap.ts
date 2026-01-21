/**
 * Grid snapping utility for wall and icing drawing
 */

/**
 * Snap a value to the nearest grid increment
 */
export function snapToGrid(value: number, gridSize: number): number {
    return Math.round(value / gridSize) * gridSize
}

/**
 * Snap a 2D point [x, z] to the grid
 */
export function snapPointToGrid(point: [number, number], gridSize: number): [number, number] {
    return [
        snapToGrid(point[0], gridSize),
        snapToGrid(point[1], gridSize)
    ]
}

/**
 * Snap a 3D point [x, y, z] to the grid (only snaps x and z)
 */
export function snapPoint3DToGrid(point: [number, number, number], gridSize: number): [number, number, number] {
    return [
        snapToGrid(point[0], gridSize),
        point[1], // Keep y unchanged
        snapToGrid(point[2], gridSize)
    ]
}

interface GridLine {
    start: [number, number]
    end: [number, number]
}

interface GridLines {
    horizontal: GridLine[]
    vertical: GridLine[]
}

/**
 * Get grid lines for rendering
 */
export function getGridLines(size: number, gridSize: number): GridLines {
    const lines: GridLines = {
        horizontal: [],
        vertical: []
    }

    // Generate lines from -size to +size
    for (let i = -size; i <= size; i += gridSize) {
        // Horizontal lines (along X axis)
        lines.horizontal.push({
            start: [-size, i],
            end: [size, i]
        })
        // Vertical lines (along Z axis)
        lines.vertical.push({
            start: [i, -size],
            end: [i, size]
        })
    }

    return lines
}

/**
 * Get grid points for rendering dots at intersections
 */
export function getGridPoints(size: number, gridSize: number): [number, number][] {
    const points: [number, number][] = []

    for (let x = -size; x <= size; x += gridSize) {
        for (let z = -size; z <= size; z += gridSize) {
            points.push([x, z])
        }
    }

    return points
}
