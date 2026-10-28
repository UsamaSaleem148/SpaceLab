import { describe, expect, it } from 'vitest'
import { intersects, isMarkerObscured, markerBounds } from './overlap'

// Desktop panel position (top-right, 320px wide) at 1440px.
const panel = { left: 1096, top: 72, right: 1416, bottom: 360 }

describe('marker overlap', () => {
  it('includes the label to the right of the marker', () => {
    expect(markerBounds({ x: 100, y: 100 })).toEqual({ left: 78, top: 78, right: 280, bottom: 122 })
  })

  it('detects rectangle intersection', () => {
    expect(intersects({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 5, top: 5, right: 15, bottom: 15 })).toBe(true)
    expect(intersects({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 10, top: 0, right: 20, bottom: 10 })).toBe(false)
  })

  it('flags a marker under the panel, or whose label runs under it', () => {
    expect(isMarkerObscured({ x: 1200, y: 200 }, [panel])).toBe(true)
    expect(isMarkerObscured({ x: 1000, y: 295 }, [panel])).toBe(true)
  })

  it('does not flag markers clear of the panel', () => {
    expect(isMarkerObscured({ x: 720, y: 450 }, [panel])).toBe(false)
    expect(isMarkerObscured({ x: 1200, y: 600 }, [panel])).toBe(false)
  })
})
