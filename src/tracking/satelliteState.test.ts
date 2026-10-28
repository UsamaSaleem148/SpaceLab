import { describe, expect, it } from 'vitest'
import type { ElementsRecord } from '../data/orbitalElements'
import { elementEpoch, satrecFromElements, type OrbitalElements } from '../orbit/propagate'
import { computeTracking, type LoadedElements } from './satelliteState'

// Real TLEs as returned by the two sources (test inputs only).
const ISS: OrbitalElements = {
  format: 'tle',
  name: 'ISS (ZARYA)',
  line1: '1 25544U 98067A   26300.82187419  .00005456  00000+0  10681-3 0  9999',
  line2: '2 25544  51.6336   3.7485 0007015 317.3678  42.6766 15.49080514592319',
}
const HST: OrbitalElements = {
  format: 'tle',
  name: 'HST',
  line1: '1 20580U 90037B   26300.95357625  .00004578  00000+0  13616-3 0  9990',
  line2: '2 20580  28.4737 252.2364 0001925 183.4227 176.6356 15.32101084808944',
}

function loaded(elements: OrbitalElements, provider: ElementsRecord['provider']): LoadedElements {
  const satrec = satrecFromElements(elements)
  const record: ElementsRecord = {
    elements,
    name: elements.format === 'tle' ? elements.name : '',
    provider,
    fetchedAt: new Date('2026-10-28T12:00:00Z'),
    source: 'network',
  }
  return { record, satrec, epoch: elementEpoch(satrec) }
}

const now = new Date('2026-10-28T12:00:00Z')

describe('computeTracking with multiple satellites', () => {
  const iss = computeTracking(25544, loaded(ISS, 'wheretheiss.at'), undefined, now)
  const hst = computeTracking(20580, loaded(HST, 'tle.ivanstanojevic.me'), undefined, now)

  it('gives each satellite its own position, altitude, speed and paths', () => {
    if (iss.status !== 'ready' || hst.status !== 'ready') throw new Error('expected ready')
    expect(iss.info).toMatchObject({ noradId: 25544, name: 'ISS (ZARYA)', provider: 'wheretheiss.at' })
    expect(hst.info).toMatchObject({ noradId: 20580, name: 'HST', provider: 'tle.ivanstanojevic.me' })
    expect(iss.state.positionEcfKm).not.toEqual(hst.state.positionEcfKm)
    expect(iss.trailEcfKm.at(-1)).toEqual(iss.state.positionEcfKm)
    expect(hst.predictionEcfKm[0]).toEqual(hst.state.positionEcfKm)
    expect(hst.trailEcfKm.length).toBeGreaterThan(80)
  })

  it('reflects each orbit: Hubble is higher and less inclined than the ISS', () => {
    if (iss.status !== 'ready' || hst.status !== 'ready') throw new Error('expected ready')
    // Mean motion 15.321 rev/day → semi-major axis (μ/n²)^⅓ ≈ 6847 km → ~469 km mean altitude.
    expect(hst.state.altitudeKm).toBeGreaterThan(440)
    expect(hst.state.altitudeKm).toBeLessThan(500)
    expect(Math.abs(hst.state.latitudeDeg)).toBeLessThanOrEqual(28.6)
    expect(iss.state.altitudeKm).toBeLessThan(hst.state.altitudeKm)
  })

  it('isolates failures: one satellite erroring does not affect another', () => {
    const failed = computeTracking(43013, undefined, 'NORAD 43013 was not found.', now)
    expect(failed).toEqual({ status: 'error', message: 'NORAD 43013 was not found.' })
    expect(computeTracking(25544, loaded(ISS, 'wheretheiss.at'), undefined, now).status).toBe('ready')
  })

  it('reports loading until elements arrive', () => {
    expect(computeTracking(48274, undefined, undefined, now)).toEqual({ status: 'loading' })
  })

  it('keeps showing data with a warning when a refresh failed', () => {
    const state = computeTracking(20580, loaded(HST, 'tle.ivanstanojevic.me'), 'HTTP 503', now)
    expect(state).toMatchObject({ status: 'ready', refreshError: 'HTTP 503' })
  })

  it('marks stale elements and refuses expired ones', () => {
    const fiveDaysLater = new Date(now.getTime() + 5 * 86_400_000)
    expect(computeTracking(20580, loaded(HST, 'tle.ivanstanojevic.me'), undefined, fiveDaysLater)).toMatchObject({
      status: 'ready',
      freshness: 'stale',
    })
    const monthLater = new Date(now.getTime() + 30 * 86_400_000)
    expect(computeTracking(20580, loaded(HST, 'tle.ivanstanojevic.me'), undefined, monthLater).status).toBe('error')
  })
})
