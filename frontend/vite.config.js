// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// El frontend es deliberadamente liviano: solo build tooling y el plugin de React.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        // Solo `npm run dev`: deja que Nagios en modo local (contenedor) revise el frontend.
        allowedHosts: ['host.docker.internal'],
    },
    optimizeDeps: {
        exclude: ['maplibre-gl'],
    },
});
