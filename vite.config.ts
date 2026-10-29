import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { SITE, escapeHtml, headTags, normalizeSiteUrl, robotsTxt, sitemapXml } from './src/seo/site'

// CesiumJS loads workers, textures and widget assets at runtime from CESIUM_BASE_URL
// (set in src/globe/cesiumBase.ts). Serve them from /cesium in dev and copy them to
// dist/cesium in production. stripBase drops the node_modules/cesium/Build/Cesium prefix.
const cesiumBuild = 'node_modules/cesium/Build/Cesium'

/**
 * Writes SEO metadata into index.html and emits robots.txt / sitemap.xml.
 * SITE_URL (the public production origin) is required for canonical, og:url,
 * absolute image URLs and the sitemap; without it they are omitted, never guessed.
 */
function seo(siteUrl: string | null): Plugin {
  return {
    name: 'spacelab-seo',
    buildStart() {
      if (!siteUrl) {
        this.warn(
          'SITE_URL is not set: canonical URL, og:url, og:image and sitemap.xml are omitted. ' +
            'Set SITE_URL=https://your-domain before a production build.',
        )
      }
    },
    transformIndexHtml(html) {
      return {
        html: html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(SITE.title)}</title>`),
        tags: headTags(siteUrl),
      }
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(siteUrl) })
      if (siteUrl) {
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(siteUrl, new Date()) })
      }
    },
  }
}

export default defineConfig(({ command, mode }) => {
  // Not VITE_-prefixed: used only at build time, never shipped to the client bundle.
  const siteUrl = normalizeSiteUrl(loadEnv(mode, process.cwd(), '').SITE_URL)

  return {
    plugins: [
      react(),
      tailwindcss(),
      seo(siteUrl),
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
  }
})
