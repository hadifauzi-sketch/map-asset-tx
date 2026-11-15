import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Cesium ships Web Workers, shaders and widget assets that must be served as
// static files. They are copied to /cesium and Cesium is told where to find
// them through the CESIUM_BASE_URL global.
const CESIUM_SOURCE = 'node_modules/cesium/Build/Cesium';
const CESIUM_BASE_URL = 'cesium';

export default defineConfig({
  define: {
    CESIUM_BASE_URL: JSON.stringify(`/${CESIUM_BASE_URL}`),
  },
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: ['ThirdParty', 'Workers', 'Assets', 'Widgets'].map((folder) => ({
        src: `${CESIUM_SOURCE}/${folder}`,
        dest: CESIUM_BASE_URL,
      })),
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: app-code deploys no longer invalidate the
        // browser cache for the map, auth and React libraries.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules[\\/](leaflet|react-leaflet|leaflet\.markercluster|react-leaflet-cluster|@react-leaflet)[\\/]/.test(id)) return 'vendor-leaflet';
          if (/node_modules[\\/](@supabase|iceberg-js)[\\/]/.test(id)) return 'vendor-supabase';
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
