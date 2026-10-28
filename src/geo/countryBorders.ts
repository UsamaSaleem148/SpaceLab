/**
 * Turns a world-atlas TopoJSON topology (Natural Earth countries) into line
 * strings for drawing. Each TopoJSON arc is drawn once: arcs shared by two
 * countries are land borders, arcs used by one country are coastline.
 */

export type BorderKind = 'border' | 'coast'

export interface BorderLine {
  kind: BorderKind
  /** [longitude, latitude] in degrees. */
  coordinates: [number, number][]
}

interface Transform {
  scale: [number, number]
  translate: [number, number]
}

interface TopoGeometry {
  type: string
  arcs?: unknown
}

export interface Topology {
  type: 'Topology'
  transform?: Transform
  arcs: number[][][]
  objects: Record<string, { type: string; geometries?: TopoGeometry[] }>
}

/** Decodes one arc: quantized, delta-encoded positions when a transform is present. */
export function decodeArc(arc: number[][], transform?: Transform): [number, number][] {
  if (!transform) return arc.map(([x = 0, y = 0]) => [x, y])
  const [sx, sy] = transform.scale
  const [tx, ty] = transform.translate
  let x = 0
  let y = 0
  return arc.map(([dx = 0, dy = 0]) => {
    x += dx
    y += dy
    return [x * sx + tx, y * sy + ty]
  })
}

/** How many polygon rings in the object reference each arc (negative index = reversed arc). */
export function countArcUsage(topology: Topology, objectName: string): Map<number, number> {
  const counts = new Map<number, number>()
  const addRing = (ring: unknown) => {
    if (!Array.isArray(ring)) return
    for (const ref of ring) {
      if (typeof ref !== 'number') continue
      const index = ref < 0 ? ~ref : ref
      counts.set(index, (counts.get(index) ?? 0) + 1)
    }
  }

  for (const geometry of topology.objects[objectName]?.geometries ?? []) {
    if (!Array.isArray(geometry.arcs)) continue
    if (geometry.type === 'Polygon') geometry.arcs.forEach(addRing)
    if (geometry.type === 'MultiPolygon') {
      for (const polygon of geometry.arcs) if (Array.isArray(polygon)) polygon.forEach(addRing)
    }
  }
  return counts
}

const ANTIMERIDIAN = 179.99
const SOUTH_CLOSURE = -84

/**
 * True for segments that exist only because the source data is cut: along the
 * ±180° meridian, or along the bottom edge that closes Antarctica.
 */
function isArtificialSegment([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): boolean {
  const onAntimeridian = Math.abs(lon1) >= ANTIMERIDIAN && Math.abs(lon2) >= ANTIMERIDIAN
  const onSouthClosure = lat1 <= SOUTH_CLOSURE && lat2 <= SOUTH_CLOSURE
  return onAntimeridian || onSouthClosure
}

/** Splits a line wherever it runs along an artificial segment. */
export function splitArtificialSegments(points: [number, number][]): [number, number][][] {
  const runs: [number, number][][] = []
  let current: [number, number][] = []
  for (let i = 0; i < points.length; i++) {
    const point = points[i]!
    const previous = points[i - 1]
    if (previous && isArtificialSegment(previous, point)) {
      if (current.length > 1) runs.push(current)
      current = []
    }
    current.push(point)
  }
  if (current.length > 1) runs.push(current)
  return runs
}

export function countryBorderLines(topology: Topology, objectName = 'countries'): BorderLine[] {
  const usage = countArcUsage(topology, objectName)
  const lines: BorderLine[] = []
  for (const [index, count] of usage) {
    const arc = topology.arcs[index]
    if (!arc) continue
    const kind: BorderKind = count > 1 ? 'border' : 'coast'
    for (const coordinates of splitArtificialSegments(decodeArc(arc, topology.transform))) {
      lines.push({ kind, coordinates })
    }
  }
  return lines
}

export function isTopology(value: unknown): value is Topology {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<Topology>
  return candidate.type === 'Topology' && Array.isArray(candidate.arcs) && typeof candidate.objects === 'object'
}
