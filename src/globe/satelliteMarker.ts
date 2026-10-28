import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ConstantPositionProperty,
  ConstantProperty,
  HorizontalOrigin,
  LabelStyle,
  Material,
  PolylineCollection,
  VerticalOrigin,
  type Entity,
  type Polyline,
  type Viewer,
} from 'cesium'
import type { Vec3 } from '../orbit/propagate'

// Selection is amber (design-system/MASTER.md); each marker's base colour comes
// from its satellite category.
const SELECTED = Color.fromCssColorString('#F59E0B')
const LABEL_BACKGROUND = Color.fromCssColorString('#0B0B10').withAlpha(0.72)
const ICON_SIZE = 32
const ICON_SIZE_SELECTED = 38
// The trail is drawn as segments whose opacity falls off with age.
const TRAIL_SEGMENTS = 15
const TRAIL_MAX_ALPHA = 0.8
const TRAIL_WIDTH = 2
// The prediction is dashed and fainter so it never reads as the travelled path.
const PREDICTION_ALPHA = 0.6
const PREDICTION_WIDTH = 1.5
const PREDICTION_DASH_PX = 10

// Lucide "satellite" glyph on a dark disc so it reads over bright and dark imagery.
// Drawn white so the billboard colour can tint it.
const ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="-4 -4 32 32">
  <circle cx="12" cy="12" r="15" fill="#0B0B10" fill-opacity="0.78" stroke="#ffffff" stroke-opacity="0.9" stroke-width="1.25"/>
  <g fill="none" stroke="#ffffff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M13 7 9 3 5 7l4 4"/><path d="m17 11 4 4-4 4-4-4"/><path d="m8 12 4 4 6-6-4-4Z"/>
    <path d="m16 8 3-3"/><path d="M9 21a6 6 0 0 0-6-6"/>
  </g>
</svg>`)}`

const toCartesian = ({ x, y, z }: Vec3) => new Cartesian3(x * 1000, y * 1000, z * 1000)

/** Opacity of trail segment `index` (0 = oldest): eases in so the tail fades out softly. */
function trailAlpha(index: number): number {
  return TRAIL_MAX_ALPHA * ((index + 1) / TRAIL_SEGMENTS) ** 1.6
}

export interface SatelliteMarker {
  readonly entity: Entity
  /**
   * Moves the marker. `trailEcfKm` is the recent path (oldest first, ending at the
   * marker); `predictionEcfKm` is the predicted path (starting at the marker).
   */
  update(name: string, positionEcfKm: Vec3, trailEcfKm: Vec3[], predictionEcfKm: Vec3[]): void
  setSelected(selected: boolean): void
  /** Current position, or undefined before the first update. */
  position(): Cartesian3 | undefined
  /** Camera destination above the satellite, or undefined before the first update. */
  viewpoint(heightAboveKm: number): Cartesian3 | undefined
  destroy(): void
}

/** `cssColor` is the marker's unselected colour (its category colour). */
export function createSatelliteMarker(viewer: Viewer, id: string, cssColor: string): SatelliteMarker {
  const base = Color.fromCssColorString(cssColor)
  const position = new ConstantPositionProperty()
  const color = new ConstantProperty(base)
  const size = new ConstantProperty(ICON_SIZE)
  const text = new ConstantProperty('')
  let hasPosition = false

  const trail = viewer.scene.primitives.add(new PolylineCollection()) as PolylineCollection
  const segments: Polyline[] = Array.from({ length: TRAIL_SEGMENTS }, (_, i) =>
    trail.add({
      show: false,
      width: TRAIL_WIDTH,
      material: Material.fromType('Color', { color: base.withAlpha(trailAlpha(i)) }),
    }),
  )
  const prediction = trail.add({
    show: false,
    width: PREDICTION_WIDTH,
    material: Material.fromType('PolylineDash', {
      color: base.withAlpha(PREDICTION_ALPHA),
      dashLength: PREDICTION_DASH_PX,
    }),
  })
  const colorPaths = (base: Color) => {
    segments.forEach((segment, i) => {
      segment.material.uniforms.color = base.withAlpha(trailAlpha(i))
    })
    prediction.material.uniforms.color = base.withAlpha(PREDICTION_ALPHA)
  }

  const entity = viewer.entities.add({
    id,
    show: false,
    position,
    billboard: { image: ICON, width: size, height: size, color },
    label: {
      text,
      font: '500 12px "IBM Plex Sans", sans-serif',
      fillColor: color,
      showBackground: true,
      backgroundColor: LABEL_BACKGROUND,
      backgroundPadding: new Cartesian2(6, 3),
      style: LabelStyle.FILL,
      horizontalOrigin: HorizontalOrigin.LEFT,
      verticalOrigin: VerticalOrigin.CENTER,
      pixelOffset: new Cartesian2(22, 0),
    },
  })

  return {
    entity,
    update(name, positionEcfKm, trailEcfKm, predictionEcfKm) {
      // satellite.js works in kilometres; Cesium's fixed frame is in metres.
      position.setValue(toCartesian(positionEcfKm))
      text.setValue(name)

      // Split the path into consecutive segments sharing their end points.
      const points = trailEcfKm.map(toCartesian)
      const perSegment = Math.max(1, Math.ceil((points.length - 1) / TRAIL_SEGMENTS))
      segments.forEach((segment, i) => {
        const slice = points.slice(i * perSegment, (i + 1) * perSegment + 1)
        segment.show = slice.length >= 2
        if (slice.length >= 2) segment.positions = slice
      })

      prediction.show = predictionEcfKm.length >= 2
      if (prediction.show) prediction.positions = predictionEcfKm.map(toCartesian)
      entity.name = name
      entity.show = true
      hasPosition = true
      viewer.scene.requestRender()
    },
    setSelected(selected) {
      color.setValue(selected ? SELECTED : base)
      size.setValue(selected ? ICON_SIZE_SELECTED : ICON_SIZE)
      colorPaths(selected ? SELECTED : base)
      viewer.scene.requestRender()
    },
    position() {
      return hasPosition ? position.getValue(viewer.clock.currentTime) : undefined
    },
    viewpoint(heightAboveKm) {
      const current = this.position()
      if (!current) return undefined
      const carto = Cartographic.fromCartesian(current)
      return Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height + heightAboveKm * 1000)
    },
    destroy() {
      if (viewer.isDestroyed()) return
      viewer.entities.remove(entity)
      viewer.scene.primitives.remove(trail) // also destroys the collection
    },
  }
}
