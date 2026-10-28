import { describe, expect, it } from 'vitest'
import countries110m from 'world-atlas/countries-110m.json'
import {
  countArcUsage,
  countryBorderLines,
  decodeArc,
  isTopology,
  splitArtificialSegments,
  type Topology,
} from './countryBorders'

describe('decodeArc', () => {
  it('applies delta decoding and the quantization transform', () => {
    const transform = { scale: [0.5, 2] as [number, number], translate: [-10, 5] as [number, number] }
    expect(decodeArc([[4, 1], [2, 1], [-1, 0]], transform)).toEqual([
      [-8, 7],
      [-7, 9],
      [-7.5, 9],
    ])
  })

  it('passes coordinates through without a transform', () => {
    expect(decodeArc([[1, 2], [3, 4]])).toEqual([[1, 2], [3, 4]])
  })
})

describe('arc classification', () => {
  // Two squares sharing arc 1; arc 0 and arc 2 are their outer coasts.
  const topology: Topology = {
    type: 'Topology',
    arcs: [
      [[0, 0], [0, 1], [1, 1]],
      [[1, 1], [1, 0]],
      [[1, 0], [2, 0], [2, 1], [1, 1]],
    ],
    objects: {
      countries: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Polygon', arcs: [[0, 1]] },
          { type: 'MultiPolygon', arcs: [[[2, ~1]]] },
        ],
      },
    },
  }

  it('counts reversed references (~i) against the same arc', () => {
    expect(countArcUsage(topology, 'countries').get(1)).toBe(2)
  })

  it('marks shared arcs as borders and single-use arcs as coast', () => {
    const lines = countryBorderLines(topology)
    expect(lines.filter((l) => l.kind === 'border')).toHaveLength(1)
    expect(lines.find((l) => l.kind === 'border')?.coordinates).toEqual([[1, 1], [1, 0]])
  })
})

describe('splitArtificialSegments', () => {
  it('removes runs along the antimeridian', () => {
    const runs = splitArtificialSegments([
      [170, 60],
      [180, 62],
      [180, 66],
      [175, 67],
    ])
    expect(runs).toEqual([
      [[170, 60], [180, 62]],
      [[180, 66], [175, 67]],
    ])
  })

  it('removes the closing edge at the bottom of Antarctica', () => {
    const runs = splitArtificialSegments([
      [-60, -70],
      [-60, -85.6],
      [60, -85.6],
      [60, -70],
    ])
    expect(runs.every((run) => run.every(([, lat]) => lat > -85 || run.length === 2))).toBe(true)
    expect(runs).toHaveLength(2)
  })
})

describe('world-atlas countries-110m', () => {
  const data: unknown = countries110m

  it('is a topology and yields both borders and coastline', () => {
    expect(isTopology(data)).toBe(true)
    const lines = countryBorderLines(data as Topology)
    const borders = lines.filter((l) => l.kind === 'border').length
    const coasts = lines.filter((l) => l.kind === 'coast').length
    expect(borders).toBeGreaterThan(100)
    expect(coasts).toBeGreaterThan(100)
  })

  it('keeps every coordinate on the globe and drops artificial seams', () => {
    for (const { coordinates } of countryBorderLines(data as Topology)) {
      for (let i = 0; i < coordinates.length; i++) {
        const [lon, lat] = coordinates[i]!
        expect(Math.abs(lon)).toBeLessThanOrEqual(180)
        expect(Math.abs(lat)).toBeLessThanOrEqual(90)
        const prev = coordinates[i - 1]
        if (prev) expect(Math.abs(prev[0]) >= 179.99 && Math.abs(lon) >= 179.99).toBe(false)
      }
    }
  })
})
