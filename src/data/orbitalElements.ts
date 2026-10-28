import type { OrbitalElements } from '../orbit/propagate'

export const ISS_NORAD_ID = 25544

/**
 * TLEs change a few times a day. One request per satellite per hour (plus the
 * cache across reloads) stays far below wheretheiss.at's 350 requests / 5 min
 * and is a light load on the free TLE API.
 */
export const REFRESH_INTERVAL_MS = 60 * 60 * 1000
/** Fail quickly instead of waiting for the browser's own connection timeout. */
export const FETCH_TIMEOUT_MS = 8000

const CACHE_PREFIX = 'spacelab:elements:v3:'

export type ElementsProvider = 'wheretheiss.at' | 'tle.ivanstanojevic.me'

interface Provider {
  name: ElementsProvider
  url(noradId: number): string
  parse(data: unknown, noradId: number): OrbitalElements
}

/** ISS only. */
const WHERE_THE_ISS: Provider = {
  name: 'wheretheiss.at',
  url: (id) => `https://api.wheretheiss.at/v1/satellites/${id}/tles`,
  parse: (data, id) => parseWhereTheIssResponse(data, id),
}

/** Any NORAD ID; browser-accessible (CORS) and needs no key. */
const TLE_API: Provider = {
  name: 'tle.ivanstanojevic.me',
  url: (id) => `https://tle.ivanstanojevic.me/api/tle/${id}`,
  parse: (data, id) => parseTleApiResponse(data, id),
}

/** The ISS keeps its dedicated source; every other satellite uses the TLE API. */
export function providerFor(noradId: number): Provider {
  return noradId === ISS_NORAD_ID ? WHERE_THE_ISS : TLE_API
}

export function tleUrl(noradId: number): string {
  return providerFor(noradId).url(noradId)
}

export interface ElementsRecord {
  elements: OrbitalElements
  name: string
  provider: ElementsProvider
  /** When this data was last fetched successfully. */
  fetchedAt: Date
  source: 'network' | 'cache'
  /** Set when a refresh failed and older cached data is being used instead. */
  refreshError?: string
}

export class OrbitalDataError extends Error {
  /**
   * @param retryable true for failures that may succeed later (network, timeout,
   * HTTP 5xx, rate limiting); false for ones that will not (unknown ID, bad data).
   */
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message)
    this.name = 'OrbitalDataError'
  }
}

/** Validates a wheretheiss.at `/tles` response. */
export function parseWhereTheIssResponse(data: unknown, noradId: number): OrbitalElements {
  if (!isRecord(data) || typeof data.line1 !== 'string' || typeof data.line2 !== 'string') {
    throw new OrbitalDataError('wheretheiss.at returned an unexpected response.')
  }
  validateTle(data.line1, data.line2, noradId)
  const name = typeof data.header === 'string' && data.header.trim() ? data.header.trim() : `NORAD ${noradId}`
  return { format: 'tle', name, line1: data.line1, line2: data.line2 }
}

/** Validates a tle.ivanstanojevic.me `/api/tle/{id}` response. */
export function parseTleApiResponse(data: unknown, noradId: number): OrbitalElements {
  if (!isRecord(data) || typeof data.line1 !== 'string' || typeof data.line2 !== 'string') {
    throw new OrbitalDataError('The TLE API returned an unexpected response.')
  }
  if (Number(data.satelliteId) !== noradId) {
    throw new OrbitalDataError(`The TLE API returned a different satellite than NORAD ${noradId}.`)
  }
  validateTle(data.line1, data.line2, noradId)
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : `NORAD ${noradId}`
  return { format: 'tle', name, line1: data.line1, line2: data.line2 }
}

/** TLE checksum: sum of digits, with '-' counting as 1, modulo 10. */
export function tleChecksum(line: string): number {
  let sum = 0
  for (const char of line.slice(0, 68)) {
    if (char >= '0' && char <= '9') sum += Number(char)
    else if (char === '-') sum += 1
  }
  return sum % 10
}

export function validateTle(line1: string, line2: string, noradId: number): void {
  for (const [index, line] of [line1, line2].entries()) {
    if (line.length !== 69 || line[0] !== String(index + 1)) {
      throw new OrbitalDataError(`TLE line ${index + 1} is malformed.`)
    }
    if (tleChecksum(line) !== Number(line[68])) {
      throw new OrbitalDataError(`TLE line ${index + 1} failed its checksum.`)
    }
    if (Number(line.slice(2, 7)) !== noradId) {
      throw new OrbitalDataError(`TLE is for a different satellite than NORAD ${noradId}.`)
    }
  }
}

function elementsName(elements: OrbitalElements): string {
  return elements.format === 'omm' ? elements.omm.OBJECT_NAME : elements.name
}

interface LoadOptions {
  fetchImpl?: typeof fetch
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  now?: Date
  /** Ignore a fresh cache (used for manual retry). */
  force?: boolean
}

// Concurrent callers (e.g. React StrictMode's double effect) share one request.
const inFlight = new Map<number, Promise<ElementsRecord>>()

/**
 * Returns the TLE for `noradId`: from cache when younger than REFRESH_INTERVAL_MS,
 * otherwise from the satellite's provider. If the request fails, falls back to any
 * cached copy (flagged with refreshError) before giving up.
 */
export function loadElements(noradId: number, options: LoadOptions = {}): Promise<ElementsRecord> {
  const pending = inFlight.get(noradId)
  if (pending) return pending
  const request = loadUncached(noradId, options).finally(() => inFlight.delete(noradId))
  inFlight.set(noradId, request)
  return request
}

async function loadUncached(noradId: number, options: LoadOptions): Promise<ElementsRecord> {
  const { fetchImpl = fetch, storage = safeLocalStorage(), now = new Date(), force = false } = options
  const provider = providerFor(noradId)
  const cached = readCache(storage, noradId)

  if (cached && !force && now.getTime() - cached.fetchedAt.getTime() < REFRESH_INTERVAL_MS) {
    return cached
  }

  try {
    const elements = provider.parse(await fetchJson(fetchImpl, provider, noradId), noradId)
    const record: ElementsRecord = {
      elements,
      name: elementsName(elements),
      provider: provider.name,
      fetchedAt: now,
      source: 'network',
    }
    writeCache(storage, noradId, record)
    return record
  } catch (error) {
    // Anything that is not an OrbitalDataError is a network failure or timeout.
    const failure =
      error instanceof OrbitalDataError ? error : new OrbitalDataError(`Could not reach ${provider.name}.`, true)
    if (cached) return { ...cached, refreshError: failure.message }
    throw failure
  }
}

async function fetchJson(fetchImpl: typeof fetch, provider: Provider, noradId: number): Promise<unknown> {
  const response = await fetchImpl(provider.url(noradId), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (response.status === 404) throw new OrbitalDataError(`NORAD ${noradId} was not found at ${provider.name}.`)
  if (response.status === 429) {
    throw new OrbitalDataError(`${provider.name} rate limit reached; will retry later.`, true)
  }
  if (!response.ok) {
    throw new OrbitalDataError(`${provider.name} request failed (HTTP ${response.status}).`, response.status >= 500)
  }
  try {
    return await response.json()
  } catch {
    throw new OrbitalDataError(`${provider.name} returned invalid JSON.`)
  }
}

function readCache(storage: LoadOptions['storage'], noradId: number): ElementsRecord | null {
  try {
    const raw = storage?.getItem(CACHE_PREFIX + noradId)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || typeof parsed.fetchedAt !== 'string' || !isRecord(parsed.elements)) return null
    const fetchedAt = new Date(parsed.fetchedAt)
    if (Number.isNaN(fetchedAt.getTime())) return null
    // Only trust entries from this satellite's current provider, re-validated
    // with the same TLE checks used for network responses.
    const provider = providerFor(noradId)
    if (parsed.provider !== provider.name) return null
    const { name, line1, line2 } = parsed.elements
    if (typeof line1 !== 'string' || typeof line2 !== 'string') return null
    validateTle(line1, line2, noradId)
    const elements: OrbitalElements = {
      format: 'tle',
      name: typeof name === 'string' && name ? name : `NORAD ${noradId}`,
      line1,
      line2,
    }
    return { elements, name: elementsName(elements), provider: provider.name, fetchedAt, source: 'cache' }
  } catch {
    return null
  }
}

function writeCache(storage: LoadOptions['storage'], noradId: number, record: ElementsRecord): void {
  try {
    storage?.setItem(
      CACHE_PREFIX + noradId,
      JSON.stringify({
        elements: record.elements,
        provider: record.provider,
        fetchedAt: record.fetchedAt.toISOString(),
      }),
    )
  } catch {
    // Storage full or blocked: caching is an optimisation only.
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
