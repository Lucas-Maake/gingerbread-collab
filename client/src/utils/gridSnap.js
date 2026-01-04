/**
 * Grid snapping utility for wall and icing drawing
 */

/**
 * Snap a value to the nearest grid increment
 * @param {number} value - The value to snap
 * @param {number} gridSize - Grid increment size
 * @returns {number} Snapped value
 */
export function snapToGrid(value, gridSize) {
  return Math.round(value / gridSize) * gridSize
}

/**
 * Snap a 2D point [x, z] to the grid
 * @param {[number, number]} point - [x, z] coordinates
 * @param {number} gridSize - Grid increment size
 * @returns {[number, number]} Snapped point
 */
export function snapPointToGrid(point, gridSize) {
  return [
    snapToGrid(point[0], gridSize),
    snapToGrid(point[1], gridSize)
  ]
}

/**
 * Snap a 3D point [x, y, z] to the grid (only snaps x and z)
 * @param {[number, number, number]} point - [x, y, z] coordinates
 * @param {number} gridSize - Grid increment size
 * @returns {[number, number, number]} Snapped point
 */
export function snapPoint3DToGrid(point, gridSize) {
  return [
    snapToGrid(point[0], gridSize),
    point[1], // Keep y unchanged
    snapToGrid(point[2], gridSize)
  ]
}

/**
 * Get grid lines for rendering
 * @param {number} size - Half-size of the grid area (grid goes from -size to +size)
 * @param {number} gridSize - Grid increment size
 * @returns {{ horizontal: Array, vertical: Array }} Arrays of line start/end points
 */
export function getGridLines(size, gridSize) {
  const lines = {
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
 * @param {number} size - Half-size of the grid area
 * @param {number} gridSize - Grid increment size
 * @returns {Array<[number, number]>} Array of [x, z] points
 */
export function getGridPoints(size, gridSize) {
  const points = []

  for (let x = -size; x <= size; x += gridSize) {
    for (let z = -size; z <= size; z += gridSize) {
      points.push([x, z])
    }
  }

  return points
}
