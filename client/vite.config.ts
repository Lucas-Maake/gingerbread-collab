import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
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
        chunkSizeWarningLimit: 800,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) {
                        return undefined
                    }

                    if (id.includes('@react-three/drei')) {
                        return 'vendor-drei'
                    }

                    if (id.includes('@react-three/fiber')) {
                        return 'vendor-r3f'
                    }

                    if (id.includes('three/examples')) {
                        return 'vendor-three-examples'
                    }

                    if (id.includes('node_modules/three') || id.includes('node_modules\\three')) {
                        return 'vendor-three'
                    }

                    if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                        return 'vendor-react'
                    }

                    if (id.includes('socket.io-client')) {
                        return 'vendor-realtime'
                    }

                    return 'vendor'
                },
            },
        },
    },
})
