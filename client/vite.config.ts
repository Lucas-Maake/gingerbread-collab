import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

function getManualChunk(id: string) {
    const normalizedId = id.replace(/\\/g, '/')

    if (normalizedId.includes('vite/preload-helper')) {
        return 'vendor-runtime'
    }

    if (!normalizedId.includes('/node_modules/')) {
        return undefined
    }

    if (
        normalizedId.includes('/node_modules/react/') ||
        normalizedId.includes('/node_modules/react-dom/') ||
        normalizedId.includes('/node_modules/scheduler/') ||
        normalizedId.includes('/node_modules/react-router/') ||
        normalizedId.includes('/node_modules/react-router-dom/') ||
        normalizedId.includes('/node_modules/@remix-run/router/')
    ) {
        return 'vendor-react'
    }

    if (normalizedId.includes('/node_modules/three/')) {
        return 'vendor-three'
    }

    if (
        normalizedId.includes('/node_modules/@react-three/fiber/') ||
        normalizedId.includes('/node_modules/react-reconciler/') ||
        normalizedId.includes('/node_modules/its-fine/')
    ) {
        return 'vendor-r3f'
    }

    if (
        normalizedId.includes('/node_modules/@react-three/drei/') ||
        normalizedId.includes('/node_modules/three-stdlib/') ||
        normalizedId.includes('/node_modules/troika-') ||
        normalizedId.includes('/node_modules/bidi-js/') ||
        normalizedId.includes('/node_modules/webgl-sdf-generator/') ||
        normalizedId.includes('/node_modules/@monogrid/gainmap-js/') ||
        normalizedId.includes('/node_modules/fflate/')
    ) {
        return 'vendor-drei'
    }

    if (
        normalizedId.includes('/node_modules/socket.io-client/') ||
        normalizedId.includes('/node_modules/socket.io-parser/') ||
        normalizedId.includes('/node_modules/engine.io-client/') ||
        normalizedId.includes('/node_modules/engine.io-parser/')
    ) {
        return 'vendor-realtime'
    }

    return undefined
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        environmentOptions: {
            jsdom: {
                url: 'http://localhost:5173/',
            },
        },
        setupFiles: './src/test/setup.ts',
    },
    server: {
        port: 5173,
        strictPort: false,
        fs: {
            allow: ['..'],
        },
        proxy: {
            '/socket.io': {
                target: 'http://localhost:3001',
                ws: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        modulePreload: false,
        chunkSizeWarningLimit: 700,
        rollupOptions: {
            output: {
                manualChunks: getManualChunk,
            },
        },
    },
})
