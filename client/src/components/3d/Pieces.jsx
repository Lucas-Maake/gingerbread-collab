import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import PieceModel from './PieceModel'

// Gingerbread piece colors (deep dark brown tones)
const GINGERBREAD_COLOR = '#5A3A1A'
const GINGERBREAD_DARK = '#3D2812'
const FROSTING_COLOR = '#FFFAF0'
const CANDY_RED = '#DC143C'
const CANDY_GREEN = '#228B22'
const CANDY_WHITE = '#FFFAFA'
const CANDY_PINK = '#FF69B4'
const CANDY_YELLOW = '#FFD700'

// Piece type configurations with dimensions, colors, and model paths
// When model files exist in public/models/, they will be loaded automatically
// Otherwise, fallback geometry is used
export const PIECE_CONFIGS = {
  BASE_PLATFORM: {
    geometry: 'box',
    size: [2, 0.15, 2],
    boundingSize: [2, 0.15, 2],
    color: GINGERBREAD_COLOR,
    yOffset: 0.075,
    // model: '/models/gingerbread/base-platform.glb',
    allowColorOverride: false
  },
  WALL_FRONT: {
    geometry: 'box',
    size: [2, 1.5, 0.15],
    boundingSize: [2, 1.5, 0.15],
    color: GINGERBREAD_COLOR,
    yOffset: 0.75,
    // model: '/models/gingerbread/wall-front.glb',
    allowColorOverride: false
  },
  WALL_BACK: {
    geometry: 'box',
    size: [2, 1.5, 0.15],
    boundingSize: [2, 1.5, 0.15],
    color: GINGERBREAD_COLOR,
    yOffset: 0.75,
    // model: '/models/gingerbread/wall-back.glb',
    allowColorOverride: false
  },
  WALL_LEFT: {
    geometry: 'box',
    size: [0.15, 1.5, 2],
    boundingSize: [0.15, 1.5, 2],
    color: GINGERBREAD_COLOR,
    yOffset: 0.75,
    // model: '/models/gingerbread/wall-left.glb',
    allowColorOverride: false
  },
  WALL_RIGHT: {
    geometry: 'box',
    size: [0.15, 1.5, 2],
    boundingSize: [0.15, 1.5, 2],
    color: GINGERBREAD_COLOR,
    yOffset: 0.75,
    // model: '/models/gingerbread/wall-right.glb',
    allowColorOverride: false
  },
  ROOF_LEFT: {
    geometry: 'box',
    size: [1.5, 0.12, 2.2],
    boundingSize: [1.5, 0.12, 2.2],
    color: GINGERBREAD_DARK,
    yOffset: 0.06,
    rotationX: Math.PI / 6, // Angled roof
    // model: '/models/gingerbread/roof-left.glb',
    allowColorOverride: false
  },
  ROOF_RIGHT: {
    geometry: 'box',
    size: [1.5, 0.12, 2.2],
    boundingSize: [1.5, 0.12, 2.2],
    color: GINGERBREAD_DARK,
    yOffset: 0.06,
    rotationX: -Math.PI / 6,
    // model: '/models/gingerbread/roof-right.glb',
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
    color: CANDY_RED,
    yOffset: 0.25,
    model: '/models/candy/candy-cane.glb',
    modelScale: 0.01,
    allowColorOverride: false
  },
  GUMDROP: {
    geometry: 'cone',
    size: [0.12, 0.2, 8],
    boundingSize: [0.24, 0.2, 0.24],
    color: CANDY_GREEN,
    yOffset: 0.1,
    // model: '/models/candy/gumdrop.glb',
    allowColorOverride: true
  },
  PEPPERMINT: {
    geometry: 'cylinder',
    size: [0.15, 0.15, 0.05, 16],
    boundingSize: [0.3, 0.05, 0.3],
    color: CANDY_WHITE,
    yOffset: 0.025,
    // model: '/models/candy/peppermint.glb',
    allowColorOverride: true
  },
  GINGERBREAD_MAN: {
    geometry: 'gingerbreadMan',
    size: [0.3, 0.45, 0.08],
    boundingSize: [0.25, 0.45, 0.15],
    color: GINGERBREAD_COLOR,
    yOffset: 0.225,
    allowColorOverride: false
  },
  COOKIE_STAR: {
    geometry: 'star',
    size: [0.3, 0.06, 0.3],
    boundingSize: [0.35, 0.06, 0.35],
    color: '#FFD54F', // Bright golden yellow
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
    color: CANDY_GREEN,
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
    color: CANDY_RED,
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
    color: FROSTING_COLOR,
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
    color: GINGERBREAD_COLOR,
    yOffset: 0.225,
    allowColorOverride: false
  },
  PRESENT: {
    geometry: 'present',
    size: [0.22, 0.22, 0.22],
    boundingSize: [0.22, 0.22, 0.22],
    color: CANDY_RED,
    yOffset: 0.11,
    allowColorOverride: true
  }
}

// Candy colors for random variation
const CANDY_COLORS = [CANDY_RED, CANDY_GREEN, CANDY_PINK, CANDY_YELLOW, CANDY_WHITE]

/**
 * Container for all pieces in the room
 */
export default function Pieces() {
  const pieces = useGameStore((state) => state.pieces)
  const userId = useGameStore((state) => state.userId)
  const heldPieceId = useGameStore((state) => state.heldPieceId)

  // Convert Map to array for rendering
  const pieceArray = useMemo(() => {
    return Array.from(pieces.values())
  }, [pieces])

  return (
    <group>
      {pieceArray.map((piece) => (
        <Piece
          key={piece.pieceId}
          piece={piece}
          isLocallyHeld={piece.pieceId === heldPieceId}
          isHeldByOther={piece.heldBy !== null && piece.heldBy !== userId}
          localUserId={userId}
        />
      ))}
    </group>
  )
}

/**
 * Individual piece component with geometry and interactions
 */
function Piece({ piece, isLocallyHeld, isHeldByOther, localUserId }) {
  const meshRef = useRef()
  const outlineRef = useRef()
  const [isHovered, setIsHovered] = useState(false)

  const config = PIECE_CONFIGS[piece.type] || PIECE_CONFIGS.GUMDROP
  const users = useGameStore((state) => state.users)
  const snapInfo = useGameStore((state) => state.snapInfo)
  const walls = useGameStore((state) => state.walls)
  const allPieces = useGameStore((state) => state.pieces)

  // Handle click on piece
  const handleClick = async (event) => {
    // Stop propagation to prevent other handlers
    event.stopPropagation()

    // Can't interact if held by someone else
    if (isHeldByOther) {
      console.log('Piece held by another user')
      return
    }

    const state = useGameStore.getState()
    const { heldPieceId, grabPiece, releasePiece } = state

    // If we're already holding this piece, release it
    if (heldPieceId === piece.pieceId) {
      console.log('Releasing piece:', piece.pieceId)
      // Pass the current attachedTo value (preserved from previous snap)
      await releasePiece(piece.pos, piece.yaw, piece.attachedTo || null)
      return
    }

    // If we're holding a different piece, don't grab this one
    if (heldPieceId) {
      console.log('Already holding another piece')
      return
    }

    // Try to grab this piece
    console.log('Attempting to grab piece:', piece.pieceId)
    const result = await grabPiece(piece.pieceId)
    if (result) {
      console.log('Successfully grabbed piece:', piece.pieceId)
    } else {
      console.log('Failed to grab piece')
    }
  }

  // Get holder color for outline
  const holderColor = useMemo(() => {
    if (piece.heldBy) {
      const holder = users.get(piece.heldBy)
      return holder?.color || '#ffffff'
    }
    return null
  }, [piece.heldBy, users])

  // Get holder name
  const holderName = useMemo(() => {
    if (piece.heldBy && piece.heldBy !== localUserId) {
      const holder = users.get(piece.heldBy)
      return holder?.name || 'Unknown'
    }
    return null
  }, [piece.heldBy, users, localUserId])

  // Candy color variation based on pieceId
  const pieceColor = useMemo(() => {
    if (['CANDY_CANE', 'GUMDROP', 'PEPPERMINT'].includes(piece.type)) {
      // Use pieceId hash for consistent random color
      const hash = piece.pieceId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
      return CANDY_COLORS[hash % CANDY_COLORS.length]
    }
    return config.color
  }, [piece.type, piece.pieceId, config.color])

  // Animate held pieces (float effect)
  useFrame((state) => {
    if (meshRef.current && isLocallyHeld) {
      const floatOffset = Math.sin(state.clock.elapsedTime * 4) * 0.03
      // Use 0 as base since group already has Y position
      meshRef.current.position.y = 0.15 + floatOffset
    }
  })

  // Position from piece state
  // For snappable pieces (doors, windows, decoratives), use actual Y position from state when snapped
  // For other pieces, use config.yOffset (ground-based)
  const basePosition = piece.pos || [0, 0, 0]
  const isWindowOrDoor = ['DOOR', 'WINDOW_SMALL', 'WINDOW_LARGE'].includes(piece.type)
  const isDecorativeSnappable = [
    'GUMDROP', 'PEPPERMINT', 'COOKIE_STAR', 'COOKIE_HEART', 'SNOWFLAKE',
    'CANDY_BUTTON', 'FROSTING_DOLLOP', 'PRESENT', 'CHIMNEY'
  ].includes(piece.type)
  const isSnappedPiece = piece.attachedTo !== null && piece.attachedTo !== undefined

  // Check if piece is currently being snapped (during drag) via snapInfo
  const isCurrentlySnapping = isLocallyHeld && snapInfo !== null

  // Use snapped Y position if piece is snapped (either released+attached or currently snapping)
  // For currently snapping pieces, basePosition already contains the snapped Y from updatePieceTransform
  const useSnappedY = (isWindowOrDoor || isDecorativeSnappable) && (isSnappedPiece || isCurrentlySnapping)
  const yPos = useSnappedY && basePosition[1] > 0.05
    ? basePosition[1]  // Use snapped Y position
    : config.yOffset   // Use default ground-based offset
  const position = [
    basePosition[0],
    yPos + (isLocallyHeld ? 0.15 : 0),
    basePosition[2]
  ]

  // Calculate wall normal from attachedTo ID
  const getWallNormal = (attachedToId) => {
    if (!attachedToId || attachedToId === 'roof') return null

    // Check if it's a drawn wall
    const drawnWall = walls.get(attachedToId)
    if (drawnWall) {
      // Calculate normal from wall start/end points
      const [startX, startZ] = drawnWall.start
      const [endX, endZ] = drawnWall.end
      const wallDx = endX - startX
      const wallDz = endZ - startZ
      const wallLength = Math.sqrt(wallDx * wallDx + wallDz * wallDz)
      if (wallLength < 0.1) return null
      // Perpendicular to wall direction
      const nx = -wallDz / wallLength
      const nz = wallDx / wallLength
      // Determine side based on piece position relative to wall
      const piecePos = piece.pos || [0, 0, 0]
      const wallCenterX = (startX + endX) / 2
      const wallCenterZ = (startZ + endZ) / 2
      const toPieceX = piecePos[0] - wallCenterX
      const toPieceZ = piecePos[2] - wallCenterZ
      const side = (toPieceX * nx + toPieceZ * nz) >= 0 ? 1 : -1
      return [nx * side, 0, nz * side]
    }

    // Check if it's a pre-built wall piece
    const wallPiece = allPieces.get(attachedToId)
    if (wallPiece) {
      const wallType = wallPiece.type
      const piecePos = piece.pos || [0, 0, 0]
      const wallPos = wallPiece.pos || [0, 0, 0]
      if (wallType === 'WALL_FRONT' || wallType === 'WALL_BACK') {
        const side = piecePos[2] >= wallPos[2] ? 1 : -1
        return [0, 0, side]
      } else if (wallType === 'WALL_LEFT' || wallType === 'WALL_RIGHT') {
        const side = piecePos[0] >= wallPos[0] ? 1 : -1
        return [side, 0, 0]
      }
    }

    return null
  }

  // Calculate rotation for decorative pieces on walls
  // They lay flat against the wall, with their surface normal matching the wall's surface normal
  const calculateWallRotation = () => {
    if (!isDecorativeSnappable) {
      return [config.rotationX || 0, piece.yaw || 0, 0]
    }

    let surfaceType = null
    let normal = null

    // Determine surface type and normal
    if (isLocallyHeld && snapInfo) {
      surfaceType = snapInfo.surfaceType
      normal = snapInfo.normal
    } else if (isSnappedPiece) {
      surfaceType = piece.attachedTo === 'roof' ? 'roof' : 'wall'
      normal = getWallNormal(piece.attachedTo)
    }

    // For roof or no snap, piece sits normally (no special rotation)
    if (surfaceType !== 'wall') {
      return [config.rotationX || 0, piece.yaw || 0, 0]
    }

    // For walls: use quaternion to align piece's Y-axis with the wall normal
    // This makes the piece lay flat against the wall surface
    if (normal && Array.isArray(normal) && normal.length >= 3) {
      const wallNormal = new THREE.Vector3(normal[0], normal[1], normal[2]).normalize()
      const upVector = new THREE.Vector3(0, 1, 0)

      // Create quaternion that rotates the up vector to align with the wall normal
      const quaternion = new THREE.Quaternion()
      quaternion.setFromUnitVectors(upVector, wallNormal)

      // Convert to Euler angles
      const euler = new THREE.Euler()
      euler.setFromQuaternion(quaternion, 'XYZ')

      return [euler.x, euler.y, euler.z]
    }

    // Fallback: use the yaw with a -90° pitch
    const yaw = piece.yaw || 0
    return [-Math.PI / 2, yaw, 0]
  }

  // Rotation - apply piece yaw plus any config rotation
  const rotation = calculateWallRotation()

  // Determine if piece can be interacted with
  const canInteract = !isHeldByOther

  // Get bounding size for hit detection and outlines
  const boundingSize = config.boundingSize || config.size

  return (
    <group position={position} rotation={rotation}>
      {/* Invisible hit box for raycasting */}
      <mesh
        ref={meshRef}
        userData={{ pieceId: piece.pieceId, type: piece.type }}
        onClick={handleClick}
        onPointerOver={() => canInteract && setIsHovered(true)}
        onPointerOut={() => setIsHovered(false)}
      >
        <boxGeometry args={boundingSize} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Visible piece model (or fallback geometry) */}
      <PieceModel
        config={config}
        color={pieceColor}
        opacity={isHeldByOther ? 0.7 : 1}
        emissive={isHovered && canInteract ? pieceColor : '#000000'}
        emissiveIntensity={isHovered && canInteract ? 0.2 : 0}
      />

      {/* Outline when held */}
      {piece.heldBy && (
        <mesh ref={outlineRef} scale={[1.08, 1.08, 1.08]}>
          <boxGeometry args={boundingSize} />
          <meshBasicMaterial
            color={holderColor}
            transparent
            opacity={0.4}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Glow ring when locally held */}
      {isLocallyHeld && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -config.yOffset + 0.02, 0]}>
          <ringGeometry args={[0.3, 0.5, 32]} />
          <meshBasicMaterial
            color={holderColor || '#00ff00'}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Hover outline */}
      {isHovered && canInteract && !piece.heldBy && (
        <mesh scale={[1.05, 1.05, 1.05]}>
          <boxGeometry args={boundingSize} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.3}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* "Held by" label for pieces held by others */}
      {holderName && (
        <Billboard position={[0, boundingSize[1] / 2 + 0.4, 0]}>
          <Text
            fontSize={0.12}
            color={holderColor}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.015}
            outlineColor="#000000"
          >
            {`Held by ${holderName}`}
          </Text>
        </Billboard>
      )}

      {/* Lock indicator for held pieces */}
      {isHeldByOther && (
        <mesh position={[0, boundingSize[1] / 2 + 0.2, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color={holderColor} />
        </mesh>
      )}
    </group>
  )
}
