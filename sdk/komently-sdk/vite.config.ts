import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist/sdk',
        lib: {
            entry: resolve(__dirname, 'src/browser.tsx'),
            name: 'Komently',
            // Simple name for the CDN bundle
            fileName: () => 'komently.js',
            formats: ['umd'],
        },
        rollupOptions: {
            // Do NOT externalize React/ReactDOM for the CDN bundle
            // as it needs to be "one js that injects"
            external: [],
            output: {
                extend: true,
                // Global variables for the UMD bundle
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM',
                },
            },
        },
        minify: 'esbuild',
        cssCodeSplit: false, // Ensure CSS is in one file
        sourcemap: false,
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
    },
});
