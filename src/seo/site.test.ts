import { describe, expect, it } from 'vitest'
import {
  SITE,
  headTags,
  normalizeSiteUrl,
  robotsTxt,
  serializeJsonLd,
  sitemapXml,
  webApplicationJsonLd,
} from './site'

const attr = (tags: ReturnType<typeof headTags>, key: string, value: string) =>
  tags.find((t) => t.attrs?.[key] === value)

describe('normalizeSiteUrl', () => {
  it('returns null when unset, so no domain is invented', () => {
    expect(normalizeSiteUrl(undefined)).toBeNull()
    expect(normalizeSiteUrl('   ')).toBeNull()
  })

  it('normalises a production origin', () => {
    expect(normalizeSiteUrl('https://spacelab.example.com/')).toBe('https://spacelab.example.com')
    expect(normalizeSiteUrl('https://example.com/spacelab/')).toBe('https://example.com/spacelab')
  })

  it('rejects values that cannot be the public production URL', () => {
    expect(() => normalizeSiteUrl('spacelab')).toThrow(/valid URL/)
    expect(() => normalizeSiteUrl('http://example.com')).toThrow(/https/)
    expect(() => normalizeSiteUrl('https://localhost:5173')).toThrow(/localhost/)
    expect(() => normalizeSiteUrl('https://example.com/?a=1')).toThrow(/query/)
  })
})

describe('headTags', () => {
  it('always includes description, Open Graph and Twitter text', () => {
    const tags = headTags(null)
    expect(attr(tags, 'name', 'description')?.attrs?.content).toBe(SITE.description)
    expect(attr(tags, 'property', 'og:title')?.attrs?.content).toBe(SITE.title)
    expect(attr(tags, 'name', 'twitter:card')?.attrs?.content).toBe('summary_large_image')
  })

  it('omits canonical and absolute URLs without SITE_URL', () => {
    const tags = headTags(null)
    expect(attr(tags, 'rel', 'canonical')).toBeUndefined()
    expect(attr(tags, 'property', 'og:url')).toBeUndefined()
    expect(attr(tags, 'property', 'og:image')).toBeUndefined()
  })

  it('uses the production URL for canonical, og:url and images when set', () => {
    const tags = headTags('https://spacelab.example.com')
    expect(attr(tags, 'rel', 'canonical')?.attrs?.href).toBe('https://spacelab.example.com/')
    expect(attr(tags, 'property', 'og:url')?.attrs?.content).toBe('https://spacelab.example.com/')
    expect(attr(tags, 'property', 'og:image')?.attrs?.content).toBe('https://spacelab.example.com/og-image.jpg')
    expect(attr(tags, 'name', 'twitter:image')?.attrs?.content).toBe('https://spacelab.example.com/og-image.jpg')
  })

  it('includes WebApplication JSON-LD', () => {
    const script = headTags(null).find((t) => t.attrs?.type === 'application/ld+json')
    expect(JSON.parse(script?.children ?? '{}')).toMatchObject({ '@type': 'WebApplication', name: 'SpaceLab' })
  })
})

describe('JSON-LD', () => {
  it('credits the author and only includes url/image when known', () => {
    expect(webApplicationJsonLd(null)).not.toHaveProperty('url')
    expect(webApplicationJsonLd('https://a.example')).toMatchObject({
      url: 'https://a.example/',
      image: 'https://a.example/og-image.jpg',
      creator: { '@type': 'Person', name: 'Muhammad Usama Saleem', url: 'https://usamadev.com' },
    })
  })

  it('escapes "<" so the JSON cannot end the script element', () => {
    expect(serializeJsonLd({ x: '</script><b>' })).not.toContain('</script>')
  })
})

describe('robots.txt and sitemap.xml', () => {
  it('allows crawling and links the sitemap only when the domain is known', () => {
    expect(robotsTxt(null)).toBe('User-agent: *\nAllow: /\n')
    expect(robotsTxt('https://a.example')).toContain('Sitemap: https://a.example/sitemap.xml')
  })

  it('lists the production home page', () => {
    const xml = sitemapXml('https://a.example', new Date('2026-10-29T10:00:00Z'))
    expect(xml).toContain('<loc>https://a.example/</loc>')
    expect(xml).toContain('<lastmod>2026-10-29</lastmod>')
    expect(xml.startsWith('<?xml')).toBe(true)
  })
})
