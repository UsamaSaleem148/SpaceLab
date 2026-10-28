import { describe, expect, it } from 'vitest'
import { formatAge, formatLatitude, formatLongitude, formatUtc } from './format'

describe('format', () => {
  it('formats coordinates with hemispheres', () => {
    expect(formatLatitude(51.6432)).toBe('51.64° N')
    expect(formatLatitude(-12.3)).toBe('12.30° S')
    expect(formatLongitude(-0.004)).toBe('0.00° W')
    expect(formatLongitude(179.999)).toBe('180.00° E')
  })

  it('formats UTC timestamps', () => {
    expect(formatUtc(new Date('2026-10-28T09:12:34Z'))).toBe('2026-10-28 09:12 UTC')
  })

  it('formats ages', () => {
    expect(formatAge(30 * 60_000)).toBe('30 min')
    expect(formatAge(6.2 * 3_600_000)).toBe('6.2 h')
    expect(formatAge(3 * 86_400_000)).toBe('3.0 d')
  })
})
