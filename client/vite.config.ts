import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

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
        chunkSizeWarningLimit: 1300,
    },
})
