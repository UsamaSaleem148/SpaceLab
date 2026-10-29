/**
 * Single source for SpaceLab's SEO metadata. Used at build time by the Vite SEO
 * plugin (vite.config.ts) to write head tags, robots.txt and sitemap.xml. Pure:
 * no DOM or Node APIs.
 */

export const SITE = {
  name: 'SpaceLab',
  title: 'Live ISS Tracker | Real-Time 3D Earth & Orbit Map | SpaceLab',
  description:
    'Track the International Space Station live on an interactive 3D globe. See its current location, altitude and speed, its recent ground track and predicted orbit, and follow other satellites in real time.',
  /** Short visible summary shown on the page itself. */
  summary: 'Live ISS position, altitude, speed and orbit predictions on an interactive 3D globe.',
  author: { name: 'Muhammad Usama Saleem', url: 'https://usamadev.com' },
  image: {
    path: '/og-image.jpg',
    width: 1200,
    height: 630,
    type: 'image/jpeg',
    alt: 'SpaceLab showing the International Space Station, its orbit and live telemetry over a 3D Earth',
  },
  themeColor: '#0B0B10',
} as const

/** Shape compatible with Vite's HtmlTagDescriptor. */
export interface HeadTag {
  tag: string
  attrs?: Record<string, string>
  children?: string
  injectTo: 'head'
}

/**
 * Validates the production origin from SITE_URL. Returns the origin without a
 * trailing slash, null when unset, or throws for values that cannot be a public
 * production URL.
 */
export function normalizeSiteUrl(raw: string | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`SITE_URL "${value}" is not a valid URL.`)
  }
  if (url.protocol !== 'https:') throw new Error(`SITE_URL must use https:// (got "${value}").`)
  if (['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(url.hostname)) {
    throw new Error('SITE_URL must be the public production domain, not localhost.')
  }
  if (url.search || url.hash) throw new Error('SITE_URL must not include a query string or fragment.')
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
}

/** schema.org WebApplication description of SpaceLab. */
export function webApplicationJsonLd(siteUrl: string | null): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE.name,
    alternateName: 'SpaceLab Live ISS Tracker',
    description: SITE.description,
    ...(siteUrl ? { url: `${siteUrl}/`, image: `${siteUrl}${SITE.image.path}` } : {}),
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript and WebGL.',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: [
      'Live International Space Station position, altitude and speed',
      'Predicted orbit and recent ground track',
      'Interactive 3D globe with terrain and country-border views',
      'Tracking of additional satellites by NORAD ID',
    ],
    creator: { '@type': 'Person', name: SITE.author.name, url: SITE.author.url },
  }
}

/** JSON for an inline <script>, with '<' escaped so it cannot close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

/** Head tags written into index.html at build time. URL-based tags need SITE_URL. */
export function headTags(siteUrl: string | null): HeadTag[] {
  const meta = (attrs: Record<string, string>): HeadTag => ({ tag: 'meta', attrs, injectTo: 'head' })
  const tags: HeadTag[] = [
    meta({ name: 'description', content: SITE.description }),
    meta({ name: 'author', content: SITE.author.name }),
    meta({ property: 'og:type', content: 'website' }),
    meta({ property: 'og:site_name', content: SITE.name }),
    meta({ property: 'og:title', content: SITE.title }),
    meta({ property: 'og:description', content: SITE.description }),
    meta({ property: 'og:locale', content: 'en_US' }),
    meta({ name: 'twitter:card', content: 'summary_large_image' }),
    meta({ name: 'twitter:title', content: SITE.title }),
    meta({ name: 'twitter:description', content: SITE.description }),
  ]

  if (siteUrl) {
    const image = `${siteUrl}${SITE.image.path}`
    tags.push(
      { tag: 'link', attrs: { rel: 'canonical', href: `${siteUrl}/` }, injectTo: 'head' },
      meta({ property: 'og:url', content: `${siteUrl}/` }),
      meta({ property: 'og:image', content: image }),
      meta({ property: 'og:image:type', content: SITE.image.type }),
      meta({ property: 'og:image:width', content: String(SITE.image.width) }),
      meta({ property: 'og:image:height', content: String(SITE.image.height) }),
      meta({ property: 'og:image:alt', content: SITE.image.alt }),
      meta({ name: 'twitter:image', content: image }),
      meta({ name: 'twitter:image:alt', content: SITE.image.alt }),
    )
  }

  tags.push({
    tag: 'script',
    attrs: { type: 'application/ld+json' },
    children: serializeJsonLd(webApplicationJsonLd(siteUrl)),
    injectTo: 'head',
  })
  return tags
}

export function robotsTxt(siteUrl: string | null): string {
  const lines = ['User-agent: *', 'Allow: /']
  if (siteUrl) lines.push('', `Sitemap: ${siteUrl}/sitemap.xml`)
  return `${lines.join('\n')}\n`
}

export function sitemapXml(siteUrl: string, lastModified: Date): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${escapeXml(`${siteUrl}/`)}</loc>`,
    `    <lastmod>${lastModified.toISOString().slice(0, 10)}</lastmod>`,
    '    <changefreq>weekly</changefreq>',
    '  </url>',
    '</urlset>',
    '',
  ].join('\n')
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escapeXml(text: string): string {
  return escapeHtml(text).replace(/'/g, '&apos;')
}
