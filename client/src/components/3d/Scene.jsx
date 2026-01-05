import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import BuildSurface from './BuildSurface'
import Pieces from './Pieces'
import Cursors from './Cursors'
import CameraController from './CameraController'
import InteractionManager from './InteractionManager'
import Lighting from './Lighting'
import SnowParticles from './SnowParticles'
import GridOverlay from './GridOverlay'
import WallSegments from './WallSegments'
import WallPreview from './WallPreview'
import WallDrawingManager from './WallDrawingManager'
import AutoRoofs from './AutoRoofs'
import IcingStrokes from './IcingStrokes'
import IcingDrawingManager from './IcingDrawingManager'
import FrostedBackground from './FrostedBackground'

/**
 * Main 3D Scene component
 * Uses React Three Fiber for Three.js integration
 */
export default function Scene() {
  return (
    <Canvas
      shadows
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true // Required for screenshots
      }}
      style={{ background: '#E8EEF4' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#E8EEF4')
      }}
    >
      {/* Orthographic camera for isometric view */}
      <OrthographicCamera
        makeDefault
        position={[15, 15, 15]}
        zoom={70}
        near={0.1}
        far={1000}
      />

      {/* Loading fallback */}
      <Suspense fallback={<LoadingIndicator />}>
        {/* Frosted window background */}
        <FrostedBackground />

        {/* Camera controls */}
        <CameraController />

        {/* Interaction manager for piece manipulation */}
        <InteractionManager />

        {/* Lighting */}
        <Lighting />

        {/* Build surface (table/plate) */}
        <BuildSurface />

        {/* Grid overlay for wall/icing drawing */}
        <GridOverlay />

        {/* Wall segments */}
        <WallSegments />

        {/* Auto-generated roofs */}
        <AutoRoofs />

        {/* Wall preview while drawing */}
        <WallPreview />

        {/* Wall drawing interaction manager */}
        <WallDrawingManager />

        {/* Icing strokes */}
        <IcingStrokes />

        {/* Icing drawing interaction manager */}
        <IcingDrawingManager />

        {/* Gingerbread pieces */}
        <Pieces />

        {/* Other users' cursors */}
        <Cursors />

        {/* Snow particles */}
        <SnowParticles />
      </Suspense>
    </Canvas>
  )
}

/**
 * Simple loading indicator while scene loads
 */
function LoadingIndicator() {
  return (
    <mesh position={[0, 1, 0]}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshBasicMaterial color="#CD853F" wireframe />
    </mesh>
  )
}
