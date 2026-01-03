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
      style={{ background: 'linear-gradient(180deg, #FFA270 0%, #FFE4EC 100%)' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#FFD6DC')
      }}
    >
      {/* Orthographic camera for isometric view */}
      <OrthographicCamera
        makeDefault
        position={[15, 15, 15]}
        zoom={50}
        near={0.1}
        far={1000}
      />

      {/* Loading fallback */}
      <Suspense fallback={<LoadingIndicator />}>
        {/* Camera controls */}
        <CameraController />

        {/* Interaction manager for piece manipulation */}
        <InteractionManager />

        {/* Lighting */}
        <Lighting />

        {/* Build surface (table/plate) */}
        <BuildSurface />

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
