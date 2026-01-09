import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/shorten': 'http://localhost:3006',
            '/auth': 'http://localhost:3006',
            '/api': 'http://localhost:3006',
        }
    }
});
