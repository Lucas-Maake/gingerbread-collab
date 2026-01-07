import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrthographicCamera, Environment } from '@react-three/drei'
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
import ChimneySmoke from './ChimneySmoke'
import InteriorGlow from './InteriorGlow'
import RoofFrosting from './RoofFrosting'

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
      style={{ background: '#1a1a2e' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#1a1a2e')
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
        {/* Frosted window background (handles day/night) */}
        <FrostedBackground />

        {/* Camera controls */}
        <CameraController />

        {/* Interaction manager for piece manipulation */}
        <InteractionManager />

        {/* Lighting */}
        <Lighting />

        {/* Environment map for candy reflections (low intensity to not wash out colors) */}
        <Environment preset="apartment" background={false} environmentIntensity={0.3} />

        {/* Build surface (table/plate) */}
        <BuildSurface />

        {/* Grid overlay for wall/icing drawing */}
        <GridOverlay />

        {/* Wall segments */}
        <WallSegments />

        {/* Auto-generated roofs */}
        <AutoRoofs />

        {/* Frosting drips on roof edges */}
        <RoofFrosting />

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

        {/* Chimney smoke effects */}
        <ChimneySmoke />

        {/* Interior glow from windows/doors */}
        <InteriorGlow />

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
