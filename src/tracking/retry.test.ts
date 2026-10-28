import { describe, expect, it } from 'vitest'
import { RETRY_DELAYS_MS, retryDelay } from './retry'

describe('retryDelay', () => {
  it('backs off, then stops', () => {
    expect([0, 1, 2].map(retryDelay)).toEqual([...RETRY_DELAYS_MS])
    expect(retryDelay(3)).toBeNull()
  })

  it('makes at most three automatic attempts per failure streak', () => {
    expect(RETRY_DELAYS_MS).toHaveLength(3)
    expect([...RETRY_DELAYS_MS].every((delay, i, all) => i === 0 || delay > all[i - 1]!)).toBe(true)
  })
})
