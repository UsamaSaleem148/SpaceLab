import {
  ArcType,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  GeometryInstance,
  PolylineColorAppearance,
  PolylineGeometry,
  Primitive,
} from 'cesium'
import countriesUrl from 'world-atlas/countries-110m.json?url'
import { countryBorderLines, isTopology, type BorderKind } from '../geo/countryBorders'

// Borders View palette: a deep navy sphere with thin, low-contrast blue lines,
// in the spirit of globe.gl-style minimal globes. Built from the accent blue.
export const BORDERS_GLOBE_COLOR = Color.fromCssColorString('#0B1A2C')
const LINE_STYLE: Record<BorderKind | 'graticule', { color: Color; width: number }> = {
  border: { color: Color.fromCssColorString('#60A5FA').withAlpha(0.55), width: 1 },
  coast: { color: Color.fromCssColorString('#60A5FA').withAlpha(0.38), width: 1 },
  graticule: { color: Color.fromCssColorString('#94A3B8').withAlpha(0.08), width: 1 },
}
const GRATICULE_STEP_DEG = 30

/** Loads Natural Earth 1:110m country boundaries (world-atlas) as one batched primitive. */
export async function createBordersPrimitive(): Promise<Primitive> {
  const response = await fetch(countriesUrl)
  if (!response.ok) throw new Error(`Country boundaries failed to load (HTTP ${response.status}).`)
  const topology: unknown = await response.json()
  if (!isTopology(topology)) throw new Error('Country boundaries file is not TopoJSON.')

  const instances: GeometryInstance[] = []
  const add = (degrees: number[], style: (typeof LINE_STYLE)[keyof typeof LINE_STYLE], arcType: ArcType) => {
    instances.push(
      new GeometryInstance({
        geometry: new PolylineGeometry({
          positions: Cartesian3.fromDegreesArray(degrees),
          width: style.width,
          arcType,
          vertexFormat: PolylineColorAppearance.VERTEX_FORMAT,
        }),
        attributes: { color: ColorGeometryInstanceAttribute.fromColor(style.color) },
      }),
    )
  }

  for (let lon = -180; lon < 180; lon += GRATICULE_STEP_DEG) {
    add([lon, -80, lon, 0, lon, 80], LINE_STYLE.graticule, ArcType.GEODESIC)
  }
  for (let lat = -60; lat <= 60; lat += GRATICULE_STEP_DEG) {
    const ring: number[] = []
    for (let lon = -180; lon <= 180; lon += 10) ring.push(lon, lat)
    add(ring, LINE_STYLE.graticule, ArcType.RHUMB)
  }

  for (const line of countryBorderLines(topology)) {
    add(line.coordinates.flat(), LINE_STYLE[line.kind], ArcType.GEODESIC)
  }

  return new Primitive({
    geometryInstances: instances,
    appearance: new PolylineColorAppearance({ translucent: true }),
    // ~700 short lines build quickly; synchronous creation also avoids waiting on
    // worker results that request-render mode would not otherwise redraw for.
    asynchronous: false,
    show: false,
  })
}
