import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import PieceModel from './PieceModel'

// Gingerbread piece colors
const GINGERBREAD_COLOR = '#CD853F'
const GINGERBREAD_DARK = '#A0522D'
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
    geometry: 'box',
    size: [0.5, 0.9, 0.08],
    boundingSize: [0.5, 0.9, 0.08],
    color: '#654321',
    yOffset: 0.45,
    // model: '/models/gingerbread/door.glb',
    allowColorOverride: false
  },
  WINDOW_SMALL: {
    geometry: 'box',
    size: [0.35, 0.35, 0.08],
    boundingSize: [0.35, 0.35, 0.08],
    color: '#87CEEB',
    yOffset: 0.175,
    // model: '/models/gingerbread/window-small.glb',
    allowColorOverride: false
  },
  WINDOW_LARGE: {
    geometry: 'box',
    size: [0.55, 0.55, 0.08],
    boundingSize: [0.55, 0.55, 0.08],
    color: '#87CEEB',
    yOffset: 0.275,
    // model: '/models/gingerbread/window-large.glb',
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
    color: '#DEB887',
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
      await releasePiece(piece.pos, piece.yaw)
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
  // For snappable pieces (doors, windows), use actual Y position from state
  // For other pieces, use config.yOffset (ground-based)
  const basePosition = piece.pos || [0, 0, 0]
  const isSnappablePiece = ['DOOR', 'WINDOW_SMALL', 'WINDOW_LARGE'].includes(piece.type)
  const yPos = isSnappablePiece && basePosition[1] > 0.2
    ? basePosition[1]  // Use snapped Y position
    : config.yOffset   // Use default ground-based offset
  const position = [
    basePosition[0],
    yPos + (isLocallyHeld ? 0.15 : 0),
    basePosition[2]
  ]

  // Rotation - apply piece yaw plus any config rotation
  const rotation = [
    config.rotationX || 0,
    piece.yaw || 0,
    0
  ]

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
