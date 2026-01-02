import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'

// Gingerbread piece colors
const GINGERBREAD_COLOR = '#CD853F'
const GINGERBREAD_DARK = '#A0522D'
const FROSTING_COLOR = '#FFFAF0'
const CANDY_RED = '#DC143C'
const CANDY_GREEN = '#228B22'
const CANDY_WHITE = '#FFFAFA'
const CANDY_PINK = '#FF69B4'
const CANDY_YELLOW = '#FFD700'

// Piece type configurations with dimensions and colors
const PIECE_CONFIGS = {
  BASE_PLATFORM: {
    geometry: 'box',
    size: [2, 0.15, 2],
    color: GINGERBREAD_COLOR,
    yOffset: 0.075
  },
  WALL_FRONT: {
    geometry: 'box',
    size: [2, 1.5, 0.15],
    color: GINGERBREAD_COLOR,
    yOffset: 0.75
  },
  WALL_BACK: {
    geometry: 'box',
    size: [2, 1.5, 0.15],
    color: GINGERBREAD_COLOR,
    yOffset: 0.75
  },
  WALL_LEFT: {
    geometry: 'box',
    size: [0.15, 1.5, 2],
    color: GINGERBREAD_COLOR,
    yOffset: 0.75
  },
  WALL_RIGHT: {
    geometry: 'box',
    size: [0.15, 1.5, 2],
    color: GINGERBREAD_COLOR,
    yOffset: 0.75
  },
  ROOF_LEFT: {
    geometry: 'box',
    size: [1.5, 0.12, 2.2],
    color: GINGERBREAD_DARK,
    yOffset: 0.06,
    rotationX: Math.PI / 6 // Angled roof
  },
  ROOF_RIGHT: {
    geometry: 'box',
    size: [1.5, 0.12, 2.2],
    color: GINGERBREAD_DARK,
    yOffset: 0.06,
    rotationX: -Math.PI / 6
  },
  DOOR: {
    geometry: 'box',
    size: [0.5, 0.9, 0.08],
    color: '#654321',
    yOffset: 0.45
  },
  WINDOW_SMALL: {
    geometry: 'box',
    size: [0.35, 0.35, 0.08],
    color: '#87CEEB',
    yOffset: 0.175
  },
  WINDOW_LARGE: {
    geometry: 'box',
    size: [0.55, 0.55, 0.08],
    color: '#87CEEB',
    yOffset: 0.275
  },
  CANDY_CANE: {
    geometry: 'cylinder',
    size: [0.05, 0.05, 0.5, 8],
    color: CANDY_RED,
    yOffset: 0.25
  },
  GUMDROP: {
    geometry: 'cone',
    size: [0.12, 0.2, 8],
    color: CANDY_GREEN,
    yOffset: 0.1
  },
  PEPPERMINT: {
    geometry: 'cylinder',
    size: [0.15, 0.15, 0.05, 16],
    color: CANDY_WHITE,
    yOffset: 0.025
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

  return (
    <group position={position} rotation={rotation}>
      {/* Main piece mesh */}
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
        userData={{ pieceId: piece.pieceId, type: piece.type }}
        onClick={handleClick}
        onPointerOver={() => canInteract && setIsHovered(true)}
        onPointerOut={() => setIsHovered(false)}
      >
        <PieceGeometry type={config.geometry} size={config.size} />
        <meshStandardMaterial
          color={pieceColor}
          roughness={0.6}
          metalness={0.1}
          opacity={isHeldByOther ? 0.7 : 1}
          transparent={isHeldByOther}
          emissive={isHovered && canInteract ? pieceColor : '#000000'}
          emissiveIntensity={isHovered && canInteract ? 0.2 : 0}
        />
      </mesh>

      {/* Outline when held */}
      {piece.heldBy && (
        <mesh ref={outlineRef} scale={[1.08, 1.08, 1.08]}>
          <PieceGeometry type={config.geometry} size={config.size} />
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
          <PieceGeometry type={config.geometry} size={config.size} />
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
        <Billboard position={[0, config.size[1] / 2 + 0.4, 0]}>
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
        <mesh position={[0, config.size[1] / 2 + 0.2, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color={holderColor} />
        </mesh>
      )}
    </group>
  )
}

/**
 * Renders appropriate geometry based on type
 */
function PieceGeometry({ type, size }) {
  switch (type) {
    case 'box':
      return <boxGeometry args={size} />
    case 'cylinder':
      return <cylinderGeometry args={size} />
    case 'cone':
      return <coneGeometry args={size} />
    case 'sphere':
      return <sphereGeometry args={size} />
    default:
      return <boxGeometry args={size} />
  }
}
