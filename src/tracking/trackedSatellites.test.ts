import { describe, expect, it } from 'vitest'
import { ISS_NORAD_ID } from '../data/orbitalElements'
import {
  INITIAL_TRACKED,
  MAX_TRACKED,
  addSatellite,
  parseNoradId,
  removeSatellite,
  restoreTracked,
  selectSatellite,
} from './trackedSatellites'

const HST = 20580
const CSS = 48274

describe('tracked satellites', () => {
  it('starts with only the ISS, active', () => {
    expect(INITIAL_TRACKED).toEqual({ ids: [ISS_NORAD_ID], activeId: ISS_NORAD_ID })
  })

  it('adds a satellite and makes it active', () => {
    expect(addSatellite(INITIAL_TRACKED, HST)).toEqual({ ids: [ISS_NORAD_ID, HST], activeId: HST })
  })

  it('does not duplicate; adding an existing satellite just selects it', () => {
    const list = addSatellite(addSatellite(INITIAL_TRACKED, HST), CSS)
    expect(addSatellite(list, HST)).toEqual({ ids: [ISS_NORAD_ID, HST, CSS], activeId: HST })
  })

  it(`stops at ${MAX_TRACKED} satellites`, () => {
    let list = INITIAL_TRACKED
    for (let id = 1; id <= MAX_TRACKED + 3; id++) list = addSatellite(list, id)
    expect(list.ids).toHaveLength(MAX_TRACKED)
    expect(addSatellite(list, 999)).toBe(list)
  })

  it('selects only tracked satellites', () => {
    const list = addSatellite(INITIAL_TRACKED, HST)
    expect(selectSatellite(list, ISS_NORAD_ID).activeId).toBe(ISS_NORAD_ID)
    expect(selectSatellite(list, CSS)).toBe(list)
  })

  it('never removes the ISS', () => {
    const list = addSatellite(INITIAL_TRACKED, HST)
    expect(removeSatellite(list, ISS_NORAD_ID)).toBe(list)
  })

  it('falls back to the ISS when the active satellite is removed', () => {
    const list = addSatellite(INITIAL_TRACKED, HST)
    expect(removeSatellite(list, HST)).toEqual({ ids: [ISS_NORAD_ID], activeId: ISS_NORAD_ID })
  })

  it('keeps the active satellite when another is removed', () => {
    const list = selectSatellite(addSatellite(addSatellite(INITIAL_TRACKED, HST), CSS), HST)
    expect(removeSatellite(list, CSS)).toEqual({ ids: [ISS_NORAD_ID, HST], activeId: HST })
  })
})

describe('parseNoradId', () => {
  it('accepts positive integers up to 9 digits', () => {
    expect(parseNoradId(' 20580 ')).toBe(20580)
    expect(parseNoradId('999999999')).toBe(999999999)
  })

  it('rejects everything else', () => {
    for (const input of ['', '0', '-5', '12.5', 'ISS', '1e5', '1234567890']) expect(parseNoradId(input)).toBeNull()
  })
})

describe('restoreTracked', () => {
  it('restores a valid list', () => {
    expect(restoreTracked({ ids: [ISS_NORAD_ID, HST], activeId: HST })).toEqual({
      ids: [ISS_NORAD_ID, HST],
      activeId: HST,
    })
  })

  it('always keeps the ISS first and drops invalid or duplicate IDs', () => {
    expect(restoreTracked({ ids: [HST, 'x', -1, HST, 1.5, CSS], activeId: CSS })).toEqual({
      ids: [ISS_NORAD_ID, HST, CSS],
      activeId: CSS,
    })
  })

  it('falls back to the ISS for an unknown active ID or bad input', () => {
    expect(restoreTracked({ ids: [HST], activeId: 1 }).activeId).toBe(ISS_NORAD_ID)
    expect(restoreTracked(null)).toEqual(INITIAL_TRACKED)
    expect(restoreTracked({ ids: 'nope' })).toEqual(INITIAL_TRACKED)
  })

  it('caps the list length', () => {
    const ids = Array.from({ length: 20 }, (_, i) => i + 1)
    expect(restoreTracked({ ids, activeId: 1 }).ids).toHaveLength(MAX_TRACKED)
  })
})
