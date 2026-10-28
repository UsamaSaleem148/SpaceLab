import { describe, expect, it } from 'vitest'
import { classifyFreshness, elementAgeDays } from './freshness'

const epoch = new Date('2026-10-20T00:00:00Z')
const days = (n: number) => new Date(epoch.getTime() + n * 86_400_000)

describe('element freshness', () => {
  it('measures age in days', () => {
    expect(elementAgeDays(epoch, days(1.5))).toBeCloseTo(1.5)
  })

  it('classifies by age', () => {
    expect(classifyFreshness(epoch, days(0.5))).toBe('current')
    expect(classifyFreshness(epoch, days(3))).toBe('current')
    expect(classifyFreshness(epoch, days(3.1))).toBe('stale')
    expect(classifyFreshness(epoch, days(14.1))).toBe('expired')
  })

  it('treats epochs far in the future as unusable too', () => {
    expect(classifyFreshness(epoch, days(-20))).toBe('expired')
  })
})
