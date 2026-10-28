export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

// Marker icon is up to 38px, centred on the point; its label sits to the right.
const MARKER_HALF = 22
const LABEL_EXTENT = 180

/** Screen box covered by a satellite marker and its label when centred on `point`. */
export function markerBounds(point: { x: number; y: number }): Rect {
  return {
    left: point.x - MARKER_HALF,
    top: point.y - MARKER_HALF,
    right: point.x + LABEL_EXTENT,
    bottom: point.y + MARKER_HALF,
  }
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

/** True when the marker (or its label) at `point` sits under any of `panels`. */
export function isMarkerObscured(point: { x: number; y: number }, panels: Rect[]): boolean {
  const bounds = markerBounds(point)
  return panels.some((panel) => intersects(bounds, panel))
}
