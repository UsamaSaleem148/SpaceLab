import { describe, expect, it } from 'vitest'
import { ISS_NORAD_ID } from './orbitalElements'
import { CATEGORY_COLORS, SATELLITE_CATALOG, categoryOf } from './satelliteCatalog'

describe('satellite catalog', () => {
  it('lists the ISS first, with unique NORAD IDs', () => {
    expect(SATELLITE_CATALOG[0]?.noradId).toBe(ISS_NORAD_ID)
    const ids = SATELLITE_CATALOG.map((entry) => entry.noradId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('holds identifiers only, never orbital elements', () => {
    for (const entry of SATELLITE_CATALOG) expect(Object.keys(entry).sort()).toEqual(['category', 'name', 'noradId'])
  })

  it('maps categories to design-system colours, with "other" for unknown satellites', () => {
    expect(CATEGORY_COLORS[categoryOf(ISS_NORAD_ID)]).toBe('#F8FAFC')
    expect(categoryOf(123456)).toBe('other')
  })
})
