import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// CesiumJS loads workers, textures and widget assets at runtime from CESIUM_BASE_URL
// (set in src/globe/cesiumBase.ts). Serve them from /cesium in dev and copy them to
// dist/cesium in production. stripBase drops the node_modules/cesium/Build/Cesium prefix.
const cesiumBuild = 'node_modules/cesium/Build/Cesium'

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: `${cesiumBuild}/{Workers,ThirdParty,Assets,Widgets}/**/*`,
          dest: 'cesium',
          rename: { stripBase: 4 },
        },
      ],
    }),
  ],
  // satellite.js re-exports an optional WASM build whose worker uses top-level
  // await, which the default 'iife' worker format cannot bundle. Build-only:
  // the same setting breaks Vitest's runner.
  worker: command === 'build' ? { format: 'es' as const } : undefined,
  build: {
    // Cesium is a single ~4 MB library; it is lazy-loaded into its own chunk.
    chunkSizeWarningLimit: 5000,
  },
}))
