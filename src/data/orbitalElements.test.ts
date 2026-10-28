import { describe, expect, it, vi } from 'vitest'
import { computeState, satrecFromElements } from '../orbit/propagate'
import {
  ISS_NORAD_ID,
  OrbitalDataError,
  REFRESH_INTERVAL_MS,
  loadElements,
  parseTleApiResponse,
  parseWhereTheIssResponse,
  providerFor,
  tleChecksum,
  tleUrl,
  validateTle,
} from './orbitalElements'

// Real wheretheiss.at /tles response (ISS TLE, epoch 2026 day 300).
const ISS_TLE = {
  requested_timestamp: 1793205921,
  tle_timestamp: 1793130210,
  id: '25544',
  name: 'iss',
  header: 'ISS (ZARYA)',
  line1: '1 25544U 98067A   26300.82187419  .00005456  00000+0  10681-3 0  9999',
  line2: '2 25544  51.6336   3.7485 0007015 317.3678  42.6766 15.49080514592319',
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const now = new Date('2026-10-28T12:00:00Z')
const okFetch = () => vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json(ISS_TLE))

describe('TLE validation', () => {
  it('computes TLE checksums', () => {
    expect(tleChecksum(ISS_TLE.line1)).toBe(9)
    expect(tleChecksum(ISS_TLE.line2)).toBe(9)
  })

  it('accepts a valid response and keeps the name', () => {
    expect(parseWhereTheIssResponse(ISS_TLE, ISS_NORAD_ID)).toMatchObject({ format: 'tle', name: 'ISS (ZARYA)' })
  })

  it('rejects corrupted lines, wrong satellites and bad shapes', () => {
    const corrupted = `${ISS_TLE.line2.slice(0, 20)}9${ISS_TLE.line2.slice(21)}`
    expect(() => validateTle(ISS_TLE.line1, corrupted, ISS_NORAD_ID)).toThrow(/checksum/)
    expect(() => validateTle(ISS_TLE.line1, ISS_TLE.line2, 20580)).toThrow(/different satellite/)
    expect(() => validateTle(ISS_TLE.line1.slice(1), ISS_TLE.line2, ISS_NORAD_ID)).toThrow(/malformed/)
    expect(() => parseWhereTheIssResponse({ line1: 1 }, ISS_NORAD_ID)).toThrow(OrbitalDataError)
  })

  it('propagates to an ISS-like state', () => {
    const satrec = satrecFromElements(parseWhereTheIssResponse(ISS_TLE, ISS_NORAD_ID))
    const state = computeState(satrec, new Date('2026-10-28T00:00:00Z'))
    expect(state.altitudeKm).toBeGreaterThan(380)
    expect(state.altitudeKm).toBeLessThan(440)
    expect(Math.abs(state.latitudeDeg)).toBeLessThanOrEqual(51.7)
  })
})

describe('loadElements', () => {
  it('fetches the wheretheiss.at TLE endpoint with a timeout, and caches it', async () => {
    const storage = memoryStorage()
    const fetchImpl = okFetch()
    const record = await loadElements(ISS_NORAD_ID, { fetchImpl, storage, now })
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.wheretheiss.at/v1/satellites/25544/tles')
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ signal: expect.any(AbortSignal) })
    expect(record).toMatchObject({ provider: 'wheretheiss.at', source: 'network', name: 'ISS (ZARYA)' })
    expect(storage.data.size).toBe(1)
  })

  it('serves a fresh cache without a request', async () => {
    const storage = memoryStorage()
    await loadElements(ISS_NORAD_ID, { fetchImpl: okFetch(), storage, now })
    const fetchImpl = vi.fn()
    const later = new Date(now.getTime() + REFRESH_INTERVAL_MS - 1000)
    const record = await loadElements(ISS_NORAD_ID, { fetchImpl, storage, now: later })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(record).toMatchObject({ source: 'cache', fetchedAt: now })
  })

  it('refetches once the cache is older than the refresh interval', async () => {
    const storage = memoryStorage()
    await loadElements(ISS_NORAD_ID, { fetchImpl: okFetch(), storage, now })
    const fetchImpl = okFetch()
    await loadElements(ISS_NORAD_ID, { fetchImpl, storage, now: new Date(now.getTime() + REFRESH_INTERVAL_MS) })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('falls back to cached data when a refresh fails', async () => {
    const storage = memoryStorage()
    await loadElements(ISS_NORAD_ID, { fetchImpl: okFetch(), storage, now })
    const record = await loadElements(ISS_NORAD_ID, {
      fetchImpl: async () => json({}, 503),
      storage,
      now,
      force: true,
    })
    expect(record.source).toBe('cache')
    expect(record.refreshError).toMatch(/HTTP 503/)
  })

  it('reports rate limiting distinctly', async () => {
    const storage = memoryStorage()
    await expect(loadElements(ISS_NORAD_ID, { fetchImpl: async () => json({}, 429), storage, now })).rejects.toThrow(
      /rate limit/,
    )
  })

  it('throws when there is no cache and the request fails', async () => {
    const fetchImpl = async () => {
      throw new TypeError('Failed to fetch')
    }
    await expect(loadElements(ISS_NORAD_ID, { fetchImpl, storage: memoryStorage(), now })).rejects.toThrow(
      'Could not reach wheretheiss.at.',
    )
  })

  it('rejects an invalid TLE instead of caching it', async () => {
    const storage = memoryStorage()
    const bad = { ...ISS_TLE, line1: `${ISS_TLE.line1.slice(0, 68)}0` }
    await expect(loadElements(ISS_NORAD_ID, { fetchImpl: async () => json(bad), storage, now })).rejects.toThrow(
      /checksum/,
    )
    expect(storage.data.size).toBe(0)
  })

  it('shares one request between concurrent callers', async () => {
    const fetchImpl = okFetch()
    const storage = memoryStorage()
    const [a, b] = await Promise.all([
      loadElements(ISS_NORAD_ID, { fetchImpl, storage, now }),
      loadElements(ISS_NORAD_ID, { fetchImpl, storage, now }),
    ])
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(a).toBe(b)
  })

  it('ignores corrupt cache entries', async () => {
    const storage = memoryStorage({ [`spacelab:elements:v3:${ISS_NORAD_ID}`]: '{not json' })
    expect((await loadElements(ISS_NORAD_ID, { fetchImpl: okFetch(), storage, now })).source).toBe('network')
  })

  it('builds the documented URL', () => {
    expect(tleUrl(25544)).toBe('https://api.wheretheiss.at/v1/satellites/25544/tles')
  })
})

// Real tle.ivanstanojevic.me /api/tle/20580 response.
const HST_RESPONSE = {
  '@type': 'Tle',
  satelliteId: 20580,
  name: 'HST',
  date: '2026-10-27T22:53:08+00:00',
  line1: '1 20580U 90037B   26300.95357625  .00004578  00000+0  13616-3 0  9990',
  line2: '2 20580  28.4737 252.2364 0001925 183.4227 176.6356 15.32101084808944',
}

describe('other satellites (TLE API)', () => {
  it('routes non-ISS satellites to the TLE API and keeps the ISS on wheretheiss.at', () => {
    expect(providerFor(25544).name).toBe('wheretheiss.at')
    expect(providerFor(20580).name).toBe('tle.ivanstanojevic.me')
    expect(tleUrl(20580)).toBe('https://tle.ivanstanojevic.me/api/tle/20580')
  })

  it('parses a TLE API response', () => {
    expect(parseTleApiResponse(HST_RESPONSE, 20580)).toMatchObject({ format: 'tle', name: 'HST' })
    expect(() => parseTleApiResponse({ ...HST_RESPONSE, satelliteId: 1 }, 20580)).toThrow(/different satellite/)
    expect(() => parseTleApiResponse({ message: 'x' }, 20580)).toThrow(OrbitalDataError)
  })

  it('loads and caches each satellite independently', async () => {
    const storage = memoryStorage()
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) =>
      String(input).includes('ivanstanojevic') ? json(HST_RESPONSE) : json(ISS_TLE),
    )
    const [iss, hst] = await Promise.all([
      loadElements(25544, { fetchImpl, storage, now }),
      loadElements(20580, { fetchImpl, storage, now }),
    ])
    expect(iss).toMatchObject({ provider: 'wheretheiss.at', name: 'ISS (ZARYA)' })
    expect(hst).toMatchObject({ provider: 'tle.ivanstanojevic.me', name: 'HST' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(storage.data.size).toBe(2)

    const cachedHst = await loadElements(20580, { fetchImpl, storage, now })
    expect(cachedHst.source).toBe('cache')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('reports an unknown NORAD ID clearly, as not worth retrying', async () => {
    const fetchImpl = async () => json({ response: { message: 'Unable to find record' } }, 404)
    const failure = await loadElements(99999999, { fetchImpl, storage: memoryStorage(), now }).catch((e) => e)
    expect(failure).toBeInstanceOf(OrbitalDataError)
    expect(failure.message).toBe('NORAD 99999999 was not found at tle.ivanstanojevic.me.')
    expect(failure.retryable).toBe(false)
  })

  it('marks network errors, timeouts, 5xx and 429 as retryable', async () => {
    const storage = memoryStorage()
    const network = async () => {
      throw new TypeError('Failed to fetch')
    }
    for (const fetchImpl of [network, async () => json({}, 503), async () => json({}, 429)]) {
      const failure = await loadElements(20580, { fetchImpl, storage, now }).catch((e) => e)
      expect(failure.retryable).toBe(true)
    }
    const invalid = await loadElements(20580, { fetchImpl: async () => json({ nope: 1 }), storage, now }).catch(
      (e) => e,
    )
    expect(invalid.retryable).toBe(false)
  })

  it('a failure for one satellite leaves another satellite cached data intact', async () => {
    const storage = memoryStorage()
    await loadElements(25544, { fetchImpl: okFetch(), storage, now })
    await expect(
      loadElements(20580, { fetchImpl: async () => json({}, 503), storage, now }),
    ).rejects.toThrow(/503/)
    const iss = await loadElements(25544, { fetchImpl: vi.fn(), storage, now })
    expect(iss.source).toBe('cache')
  })
})
