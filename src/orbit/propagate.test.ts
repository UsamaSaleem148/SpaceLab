import { describe, expect, it } from 'vitest'
import { gstime, propagate, twoline2satrec } from 'satellite.js'
import { ISS_OMM_FIXTURE, VALLADO_00005 } from './fixtures'
import {
  PropagationError,
  computePrediction,
  computeState,
  computeTrail,
  elementEpoch,
  julianToDate,
  satrecFromOmm,
  type Vec3,
} from './propagate'

const DEG = 180 / Math.PI

/** Independent ECEF -> WGS84 geodetic (Bowring iteration) to cross-check results. */
function ecefToGeodetic({ x, y, z }: Vec3) {
  const a = 6378.137
  const f = 1 / 298.257223563
  const e2 = f * (2 - f)
  const p = Math.hypot(x, y)
  let lat = Math.atan2(z, p * (1 - e2))
  let height = 0
  for (let i = 0; i < 10; i++) {
    const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2)
    height = p / Math.cos(lat) - n
    lat = Math.atan2(z, p * (1 - (e2 * n) / (n + height)))
  }
  return { latitudeDeg: lat * DEG, longitudeDeg: Math.atan2(y, x) * DEG, altitudeKm: height }
}

function rotateZ({ x, y, z }: Vec3, angle: number): Vec3 {
  return {
    x: x * Math.cos(angle) + y * Math.sin(angle),
    y: -x * Math.sin(angle) + y * Math.cos(angle),
    z,
  }
}

describe('SGP4 reference case', () => {
  const satrec = twoline2satrec(VALLADO_00005.line1, VALLADO_00005.line2)
  const epoch = elementEpoch(satrec)

  it('reproduces the published TEME state at epoch', () => {
    const result = propagate(satrec, epoch)
    expect(result).not.toBeNull()
    const { position, velocity } = result!
    // Date has millisecond resolution, so allow a few metres of drift.
    expect(position.x).toBeCloseTo(VALLADO_00005.positionKm.x, 1)
    expect(position.y).toBeCloseTo(VALLADO_00005.positionKm.y, 1)
    expect(position.z).toBeCloseTo(VALLADO_00005.positionKm.z, 1)
    expect(velocity.x).toBeCloseTo(VALLADO_00005.velocityKmS.x, 4)
    expect(velocity.y).toBeCloseTo(VALLADO_00005.velocityKmS.y, 4)
    expect(velocity.z).toBeCloseTo(VALLADO_00005.velocityKmS.z, 4)
  })

  it('reports inertial speed as the velocity magnitude', () => {
    const { x, y, z } = VALLADO_00005.velocityKmS
    expect(computeState(satrec, epoch).speedKmS).toBeCloseTo(Math.hypot(x, y, z), 4)
  })
})

describe('time conversions', () => {
  it('converts Julian dates to UTC', () => {
    expect(julianToDate(2451545.0).toISOString()).toBe('2000-01-01T12:00:00.000Z')
  })

  it('reads the element epoch from OMM', () => {
    const satrec = satrecFromOmm(ISS_OMM_FIXTURE)
    expect(Math.abs(elementEpoch(satrec).getTime() - Date.parse('2026-10-27T12:00:00Z'))).toBeLessThan(1)
  })

  it('computes Greenwich sidereal time at J2000.0', () => {
    // IAU 1982 GMST at 2000-01-01 12:00 UT is 280.46061837 degrees.
    expect(gstime(new Date('2000-01-01T12:00:00Z')) * DEG).toBeCloseTo(280.46061837, 5)
  })
})

describe('TEME to Earth-fixed conversion', () => {
  const satrec = satrecFromOmm(ISS_OMM_FIXTURE)
  const time = new Date('2026-10-27T15:30:00Z')
  const state = computeState(satrec, time)
  const eci = propagate(satrec, time)!.position

  it('rotates by GMST at the calculation timestamp', () => {
    const expected = rotateZ(eci, gstime(time))
    expect(state.positionEcfKm.x).toBeCloseTo(expected.x, 6)
    expect(state.positionEcfKm.y).toBeCloseTo(expected.y, 6)
    expect(state.positionEcfKm.z).toBeCloseTo(expected.z, 6)
  })

  it('preserves distance from Earth centre', () => {
    const r = (v: Vec3) => Math.hypot(v.x, v.y, v.z)
    expect(r(state.positionEcfKm)).toBeCloseTo(r(eci), 6)
  })

  it('matches an independent WGS84 geodetic conversion', () => {
    const geo = ecefToGeodetic(state.positionEcfKm)
    expect(state.latitudeDeg).toBeCloseTo(geo.latitudeDeg, 4)
    expect(state.longitudeDeg).toBeCloseTo(geo.longitudeDeg, 4)
    expect(state.altitudeKm).toBeCloseTo(geo.altitudeKm, 2)
  })

  it('gives a different longitude for the same inertial point at a different time', () => {
    // Earth rotates ~0.25°/min; one sidereal-ignorant bug would leave longitude unchanged.
    const later = computeState(satrec, new Date(time.getTime() + 60_000))
    expect(later.longitudeDeg).not.toBeCloseTo(state.longitudeDeg, 1)
  })
})

describe('ISS-like orbit outputs', () => {
  const satrec = satrecFromOmm(ISS_OMM_FIXTURE)
  const start = Date.parse('2026-10-27T12:00:00Z')
  // One full orbit (~93 min) sampled every minute.
  const states = Array.from({ length: 94 }, (_, i) => computeState(satrec, new Date(start + i * 60_000)))

  it('stays at ISS altitude and speed', () => {
    for (const s of states) {
      expect(s.altitudeKm).toBeGreaterThan(380)
      expect(s.altitudeKm).toBeLessThan(440)
      expect(s.speedKmS).toBeGreaterThan(7.6)
      expect(s.speedKmS).toBeLessThan(7.75)
    }
  })

  it('keeps latitude within the inclination and longitude in range', () => {
    for (const s of states) {
      expect(Math.abs(s.latitudeDeg)).toBeLessThanOrEqual(51.64 + 0.2)
      expect(s.longitudeDeg).toBeGreaterThanOrEqual(-180)
      expect(s.longitudeDeg).toBeLessThanOrEqual(180)
    }
    const maxLat = Math.max(...states.map((s) => Math.abs(s.latitudeDeg)))
    expect(maxLat).toBeGreaterThan(51)
  })

  it('moves about 7.7 km per second', () => {
    const a = propagate(satrec, new Date(start))!.position
    const b = propagate(satrec, new Date(start + 1000))!.position
    expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeCloseTo(states[0]!.speedKmS, 1)
  })
})

describe('computeTrail', () => {
  const satrec = satrecFromOmm(ISS_OMM_FIXTURE)
  const end = new Date('2026-10-27T15:30:00Z')
  const trail = computeTrail(satrec, end, 45 * 60_000, 30_000)
  const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

  it('covers the duration at the given step and ends at the current position', () => {
    expect(trail).toHaveLength(91)
    expect(trail.at(-1)).toEqual(computeState(satrec, end).positionEcfKm)
    expect(trail[0]).toEqual(computeState(satrec, new Date(end.getTime() - 45 * 60_000)).positionEcfKm)
  })

  it('spaces points by roughly ground-relative speed × step', () => {
    // ~7.66 km/s inertial, minus up to ~0.46 km/s of Earth rotation: 210–240 km per 30 s.
    for (let i = 1; i < trail.length; i++) {
      const step = distance(trail[i - 1]!, trail[i]!)
      expect(step).toBeGreaterThan(210)
      expect(step).toBeLessThan(240)
    }
  })

  it('stays at orbital altitude', () => {
    for (const p of trail) expect(Math.hypot(p.x, p.y, p.z) - 6378).toBeGreaterThan(350)
  })
})

describe('computePrediction', () => {
  const satrec = satrecFromOmm(ISS_OMM_FIXTURE)
  const start = new Date('2026-10-27T15:30:00Z')
  const prediction = computePrediction(satrec, start, 90 * 60_000, 30_000)

  it('starts at the current position and ends 90 minutes ahead', () => {
    expect(prediction).toHaveLength(181)
    expect(prediction[0]).toEqual(computeState(satrec, start).positionEcfKm)
    expect(prediction.at(-1)).toEqual(computeState(satrec, new Date(start.getTime() + 90 * 60_000)).positionEcfKm)
  })

  it('joins the trail at the current position', () => {
    const trail = computeTrail(satrec, start, 45 * 60_000, 30_000)
    expect(trail.at(-1)).toEqual(prediction[0])
  })

  it('after one orbital period returns to the same latitude, shifted west by Earth rotation', () => {
    // Period = 1440 / 15.5 rev/day ≈ 92.90 min. Earth turns 360° per 1436.07 min,
    // so the ground track moves ~23.3° west per orbit (plus ~0.3° nodal regression).
    const periodMs = (1440 / 15.5) * 60_000
    const first = computeState(satrec, start)
    const end = computePrediction(satrec, start, periodMs, 30_000).at(-1)!
    const last = computeState(satrec, new Date(start.getTime() + periodMs))
    expect(end).toEqual(last.positionEcfKm)
    expect(last.latitudeDeg).toBeCloseTo(first.latitudeDeg, 0)
    const westShift = ((first.longitudeDeg - last.longitudeDeg + 540) % 360) - 180
    expect(westShift).toBeGreaterThan(22.5)
    expect(westShift).toBeLessThan(24.5)
  })

  it('returns only the points SGP4 can propagate', () => {
    const decaying = satrecFromOmm({ ...ISS_OMM_FIXTURE, ECCENTRICITY: 1.5 })
    expect(computePrediction(decaying, start, 90 * 60_000, 30_000)).toEqual([])
  })
})

describe('propagation failures', () => {
  it('throws PropagationError for invalid elements', () => {
    const satrec = satrecFromOmm({ ...ISS_OMM_FIXTURE, ECCENTRICITY: 1.5 })
    expect(() => computeState(satrec, new Date('2026-10-27T13:00:00Z'))).toThrow(PropagationError)
  })
})
