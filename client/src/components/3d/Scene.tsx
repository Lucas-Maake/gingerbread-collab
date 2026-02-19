import { Suspense, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
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
import FencePreview from './FencePreview'
import FenceDrawingManager from './FenceDrawingManager'
import FenceRails from './FenceRails'
import AutoRoofs from './AutoRoofs'
import IcingStrokes from './IcingStrokes'
import IcingDrawingManager from './IcingDrawingManager'
import FrostedBackground from './FrostedBackground'
import ChimneySmoke from './ChimneySmoke'
import InteriorGlow from './InteriorGlow'
import RoofFrosting from './RoofFrosting'
import SnapIndicator from './SnapIndicator'
import { SCREENSHOT_REQUEST_EVENT, SCREENSHOT_RESULT_EVENT } from '../../utils/screenshotCapture'


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
                powerPreference: 'high-performance'
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

                {/* Screenshot capture bridge (render-on-demand capture without preserveDrawingBuffer) */}
                <ScreenshotCaptureBridge />

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

                {/* Fence rails between adjacent fence posts */}
                <FenceRails />

                {/* Auto-generated roofs */}
                <AutoRoofs />

                {/* Frosting drips on roof edges */}
                <RoofFrosting />

                {/* Wall preview while drawing */}
                <WallPreview />

                {/* Wall drawing interaction manager */}
                <WallDrawingManager />

                {/* Fence preview while drawing */}
                <FencePreview />

                {/* Fence drawing interaction manager */}
                <FenceDrawingManager />

                {/* Icing strokes */}
                <IcingStrokes />

                {/* Icing drawing interaction manager */}
                <IcingDrawingManager />

                {/* Gingerbread pieces */}
                <Pieces />

                {/* Visual snap indicator when dragging pieces */}
                <SnapIndicator />

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

function ScreenshotCaptureBridge() {
    const { gl, scene, camera } = useThree()

    useEffect(() => {
        const handleRequest = (event: Event) => {
            const customEvent = event as CustomEvent<{ requestId?: string }>
            const requestId = customEvent.detail?.requestId
            if (!requestId) {
                return
            }

            try {
                gl.render(scene, camera)
                const dataUrl = gl.domElement.toDataURL('image/png')

                window.dispatchEvent(new CustomEvent(SCREENSHOT_RESULT_EVENT, {
                    detail: {
                        requestId,
                        success: true,
                        dataUrl
                    }
                }))
            } catch (error: any) {
                window.dispatchEvent(new CustomEvent(SCREENSHOT_RESULT_EVENT, {
                    detail: {
                        requestId,
                        success: false,
                        error: error?.message || 'Screenshot capture failed'
                    }
                }))
            }
        }

        window.addEventListener(SCREENSHOT_REQUEST_EVENT, handleRequest)
        return () => {
            window.removeEventListener(SCREENSHOT_REQUEST_EVENT, handleRequest)
        }
    }, [gl, scene, camera])

    return null
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
