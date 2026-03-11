// import path from 'path';
// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';
// export default defineConfig({
//     plugins: [react()],
//     resolve: {
//         alias: {
//             "@": path.resolve(__dirname, "./src"),
//         },
//     },
// });

import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        host: true,          // allows external network access
        port: 5173,
        strictPort: true,
        allowedHosts: ['.loca.lt'], // allow all Localtunnel hosts
    },
});