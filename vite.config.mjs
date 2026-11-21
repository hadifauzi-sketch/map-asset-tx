import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import obfuscator from 'vite-plugin-javascript-obfuscator';

// Cesium ships Web Workers, shaders and widget assets that must be served as
// static files. They are copied to /cesium and Cesium is told where to find
// them through the CESIUM_BASE_URL global.
const CESIUM_SOURCE = 'node_modules/cesium/Build/Cesium';
const CESIUM_BASE_URL = 'cesium';

// JS obfuscation is OPT-IN (OBFUSCATE=1), not on by default. The obfuscator
// runs per-build with random string-array shuffling and can non-deterministically
// mangle dynamic import() specifiers, which breaks Vite code-splitting (lazy
// chunks 404 at runtime — seen on the v5.4 deploy). Terser minification, console
// stripping, no source maps and the copyright banner below stay on always and
// are safe. Only enable obfuscation after a `vite preview` smoke-test confirms
// lazy-loaded views (3D globe, transformer modals) still load.
const OBFUSCATE = process.env.OBFUSCATE === '1';

// Short copyright banner prepended to every emitted JS chunk. A visible claim
// of ownership — it does not stop copying, but it removes any "I didn't know"
// defence and is cheap to carry.
const BANNER = [
  '/*!',
  ` * Transformer Asset Management System`,
  ` * Copyright (c) ${new Date().getFullYear()} ChM. Ts. Hadi Fauzi. All rights reserved.`,
  ' * Proprietary and confidential. Unauthorised copying, redistribution or',
  ' * reverse engineering of this software, via any medium, is strictly prohibited.',
  ' */',
].join('\n');

// Conservative obfuscation: rename identifiers and encode string literals so
// the shipped app logic and endpoints are not plainly readable. The fragile,
// bundle-bloating transforms (control-flow flattening, dead-code injection,
// self-defending, debug protection, global renaming) are deliberately left OFF
// — on an app this size they can 3-5x the bundle and risk runtime breakage for
// little extra protection. Only the app's own source is touched; node_modules
// (React, Cesium, Supabase, Leaflet) are excluded, so vendor code is untouched.
const obfuscatorPlugin = obfuscator({
  include: ['**/*.js', '**/*.jsx', '**/*.mjs'],
  exclude: [/node_modules/, /[\\/]cesium[\\/]/, /\.worker\.js$/],
  apply: 'build',
  options: {
    compact: true,
    simplify: true,
    identifierNamesGenerator: 'mangled-shuffled',
    renameGlobals: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    splitStrings: false,
    transformObjectKeys: false,
    numbersToExpressions: false,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    selfDefending: false,
    disableConsoleOutput: false,
    unicodeEscapeSequence: false,
  },
});

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
    ...(OBFUSCATE ? [obfuscatorPlugin] : []),
  ],
  build: {
    // No source maps in production: shipping them would hand reviewers the
    // original, un-obfuscated source and defeat the hardening below.
    sourcemap: false,
    // Terser strips console/debugger and mangles names. Must run before/with
    // the obfuscator for a clean, small bundle.
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
      },
      format: {
        comments: false,
        preamble: BANNER,
      },
    },
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
