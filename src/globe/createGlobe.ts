import './cesiumBase'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import './cesium-overrides.css'
import {
  Cartesian3,
  ClockStep,
  Color,
  Ellipsoid,
  EllipsoidalOccluder,
  EllipsoidTerrainProvider,
  IonImageryProvider,
  Ion,
  Math as CesiumMath,
  SceneTransforms,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  TileMapServiceImageryProvider,
  Viewer,
  buildModuleUrl,
  createWorldImageryAsync,
  defined,
  type Entity,
  type Primitive,
} from 'cesium'
import type { Vec3 } from '../orbit/propagate'
import { BORDERS_GLOBE_COLOR, createBordersPrimitive } from './bordersLayer'
import { createSatelliteMarker, type SatelliteMarker } from './satelliteMarker'

/** Which base imagery the globe ended up with. */
export type ImagerySource = 'ion' | 'offline'

/** Terrain: imagery, sunlight and atmosphere. Borders: dark globe with country outlines. */
export type GlobeMode = 'terrain' | 'borders'

export interface GlobeOptions {
  /** Cesium ion token. Without it the bundled Natural Earth II imagery is used. */
  ionToken?: string
  /** Ion asset for night-side city lights; skipped when undefined. */
  nightAssetId?: number
  /** Skip camera flights (prefers-reduced-motion). */
  reducedMotion: boolean
  /** Called once base imagery is in place. */
  onImageryReady?: (source: ImagerySource) => void
}

export interface SatelliteUpdate {
  id: string
  name: string
  /** Unselected marker and path colour (CSS); used when the marker is created. */
  color: string
  positionEcfKm: Vec3
  /** Recent Earth-fixed path, oldest first, drawn as a fading trail. */
  trailEcfKm: Vec3[]
  /** Predicted Earth-fixed path, starting at the current position, drawn dashed. */
  predictionEcfKm: Vec3[]
}

export interface GlobeController {
  zoomIn(): void
  zoomOut(): void
  resetView(): void
  setMode(mode: GlobeMode): void
  /** Adds the satellite marker on first call, then moves it. */
  updateSatellite(satellite: SatelliteUpdate): void
  removeSatellite(id: string): void
  /** Highlights a satellite (or clears the highlight) without moving the camera. */
  selectSatellite(id: string | null): void
  /** Selects the satellite and flies the camera to a viewpoint above it. */
  focusSatellite(id: string): void
  /** Window position of a satellite, or null if it is behind the Earth or off-screen. */
  screenPosition(id: string): { x: number; y: number } | null
  /** Notified with the selected satellite id, or null when nothing is selected. */
  onSelectionChange(listener: (id: string | null) => void): () => void
  destroy(): void
}

const HOME = { longitude: 15, latitude: 20, height: 20_000_000 }
// Close enough for low Earth orbit, far enough to see the geostationary belt.
const MIN_ZOOM_DISTANCE = 150_000
const MAX_ZOOM_DISTANCE = 120_000_000
const ZOOM_STEP = 0.55
// Height above a satellite when focusing on it: close, with Earth curvature in view.
const FOCUS_HEIGHT_KM = 2_500
const SPACE = Color.fromCssColorString('#0B0B10')
const BORDERS_ATMOSPHERE = { brightness: -0.55, saturation: -0.2 }

export function createGlobe(container: HTMLElement, options: GlobeOptions): GlobeController {
  const { ionToken, nightAssetId, reducedMotion, onImageryReady } = options
  let destroyed = false

  const viewer = new Viewer(container, {
    baseLayer: false,
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    scene3DOnly: true,
    shouldAnimate: true,
    // Render only when something changes; the sun moves slowly enough that one
    // frame per simulated minute keeps lighting current.
    requestRenderMode: true,
    maximumRenderTimeChange: 60,
    msaaSamples: 4,
  })

  // Real wall-clock time drives sun position, day/night terminator and atmosphere.
  viewer.clock.clockStep = ClockStep.SYSTEM_CLOCK

  const { scene, camera } = viewer
  scene.backgroundColor = SPACE
  scene.globe.baseColor = SPACE
  scene.globe.enableLighting = true
  scene.globe.dynamicAtmosphereLighting = true
  scene.globe.dynamicAtmosphereLightingFromSun = true
  scene.globe.showGroundAtmosphere = true
  if (scene.skyAtmosphere) scene.skyAtmosphere.show = true
  if (scene.sun) scene.sun.show = true

  // Everything Borders View changes, captured once so Terrain View restores exactly.
  const terrainView = {
    baseColor: scene.globe.baseColor.clone(),
    enableLighting: scene.globe.enableLighting,
    dynamicAtmosphereLighting: scene.globe.dynamicAtmosphereLighting,
    showGroundAtmosphere: scene.globe.showGroundAtmosphere,
    terrainProvider: scene.terrainProvider,
    sun: scene.sun?.show ?? false,
    moon: scene.moon?.show ?? false,
    atmosphereBrightness: scene.skyAtmosphere?.brightnessShift ?? 0,
    atmosphereSaturation: scene.skyAtmosphere?.saturationShift ?? 0,
  }
  let mode: GlobeMode = 'terrain'
  let borders: Primitive | undefined
  let bordersLoading = false

  const controller = scene.screenSpaceCameraController
  controller.minimumZoomDistance = MIN_ZOOM_DISTANCE
  controller.maximumZoomDistance = MAX_ZOOM_DISTANCE

  // Double-click would lock the camera to an entity; with once-per-second
  // position updates that judders, so focusing is done with an explicit flight.
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

  const markers = new Map<string, SatelliteMarker>()
  const selectionListeners = new Set<(id: string | null) => void>()

  // Single click selection is Viewer's built-in picking; mirror it onto markers.
  const removeSelectionHandler = viewer.selectedEntityChanged.addEventListener((entity?: Entity) => {
    const id = entity && markers.has(entity.id) ? entity.id : null
    for (const [markerId, marker] of markers) marker.setSelected(markerId === id)
    for (const listener of selectionListeners) listener(id)
  })

  // Pointer cursor over satellites, so they read as clickable.
  const hoverHandler = new ScreenSpaceEventHandler(scene.canvas)
  hoverHandler.setInputAction((movement: ScreenSpaceEventHandler.MotionEvent) => {
    const picked: unknown = scene.pick(movement.endPosition)
    const entity = defined(picked) ? (picked as { id?: unknown }).id : undefined
    const overSatellite = typeof entity === 'object' && entity !== null && markers.has((entity as Entity).id)
    scene.canvas.style.cursor = overSatellite ? 'pointer' : ''
  }, ScreenSpaceEventType.MOUSE_MOVE)

  const home = Cartesian3.fromDegrees(HOME.longitude, HOME.latitude, HOME.height)
  if (reducedMotion) {
    camera.setView({ destination: home })
  } else {
    camera.setView({
      destination: Cartesian3.fromDegrees(HOME.longitude - 40, HOME.latitude, HOME.height * 2.2),
    })
    camera.flyTo({ destination: home, duration: 2.8 })
  }

  void loadImagery()

  async function loadImagery(): Promise<void> {
    if (ionToken) {
      Ion.defaultAccessToken = ionToken
      try {
        const provider = await createWorldImageryAsync()
        if (destroyed) return
        viewer.imageryLayers.addImageryProvider(provider)
        syncImageryVisibility()
        onImageryReady?.('ion')
        if (nightAssetId !== undefined) await addNightLights(nightAssetId)
        return
      } catch (error) {
        console.warn('Cesium ion imagery unavailable, using bundled imagery.', error)
      }
    }

    const provider = await TileMapServiceImageryProvider.fromUrl(
      buildModuleUrl('Assets/Textures/NaturalEarthII'),
    )
    if (destroyed) return
    viewer.imageryLayers.addImageryProvider(provider)
    syncImageryVisibility()
    onImageryReady?.('offline')
  }

  /** City lights shown only on the unlit hemisphere. */
  async function addNightLights(assetId: number): Promise<void> {
    try {
      const provider = await IonImageryProvider.fromAssetId(assetId)
      if (destroyed) return
      const layer = viewer.imageryLayers.addImageryProvider(provider)
      layer.dayAlpha = 0
      layer.nightAlpha = 1
      layer.brightness = 1.8
      syncImageryVisibility()
      scene.requestRender()
    } catch (error) {
      // Optional enhancement; the globe is complete without it.
      console.warn('Earth at Night imagery unavailable.', error)
    }
  }

  /** Imagery is Terrain View only; layers that finish loading later follow the current mode. */
  function syncImageryVisibility(): void {
    for (let i = 0; i < viewer.imageryLayers.length; i++) {
      viewer.imageryLayers.get(i).show = mode === 'terrain'
    }
  }

  function applyMode(): void {
    const { globe } = scene
    if (mode === 'borders') {
      globe.baseColor = BORDERS_GLOBE_COLOR
      globe.enableLighting = false
      globe.dynamicAtmosphereLighting = false
      globe.showGroundAtmosphere = false
      if (!(scene.terrainProvider instanceof EllipsoidTerrainProvider)) {
        scene.terrainProvider = new EllipsoidTerrainProvider()
      }
      if (scene.sun) scene.sun.show = false
      if (scene.moon) scene.moon.show = false
      // Unlit, the limb glow is full strength all round; keep it a faint halo.
      if (scene.skyAtmosphere) {
        scene.skyAtmosphere.brightnessShift = BORDERS_ATMOSPHERE.brightness
        scene.skyAtmosphere.saturationShift = BORDERS_ATMOSPHERE.saturation
      }
      loadBorders()
    } else {
      globe.baseColor = terrainView.baseColor
      globe.enableLighting = terrainView.enableLighting
      globe.dynamicAtmosphereLighting = terrainView.dynamicAtmosphereLighting
      globe.showGroundAtmosphere = terrainView.showGroundAtmosphere
      scene.terrainProvider = terrainView.terrainProvider
      if (scene.sun) scene.sun.show = terrainView.sun
      if (scene.moon) scene.moon.show = terrainView.moon
      if (scene.skyAtmosphere) {
        scene.skyAtmosphere.brightnessShift = terrainView.atmosphereBrightness
        scene.skyAtmosphere.saturationShift = terrainView.atmosphereSaturation
      }
    }
    syncImageryVisibility()
    if (borders) borders.show = mode === 'borders'
    scene.requestRender()
  }

  /** Country boundaries are fetched the first time Borders View is shown. */
  function loadBorders(): void {
    if (borders || bordersLoading) return
    bordersLoading = true
    createBordersPrimitive()
      .then((primitive) => {
        if (destroyed) return primitive.destroy()
        borders = scene.primitives.add(primitive) as Primitive
        borders.show = mode === 'borders'
        scene.requestRender()
      })
      .catch((error: unknown) => console.error('Country boundaries could not be loaded.', error))
      .finally(() => {
        bordersLoading = false
      })
  }

  function zoomBy(factor: number): void {
    const position = camera.positionCartographic
    const height = CesiumMath.clamp(position.height * factor, MIN_ZOOM_DISTANCE, MAX_ZOOM_DISTANCE)
    camera.flyTo({
      destination: Cartesian3.fromRadians(position.longitude, position.latitude, height),
      orientation: { heading: camera.heading, pitch: camera.pitch, roll: camera.roll },
      duration: reducedMotion ? 0 : 0.6,
    })
  }

  return {
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(1 / ZOOM_STEP),
    resetView: () => camera.flyTo({ destination: home, duration: reducedMotion ? 0 : 1.5 }),
    setMode: (next) => {
      if (destroyed || next === mode) return
      mode = next
      applyMode()
    },
    updateSatellite: ({ id, name, color, positionEcfKm, trailEcfKm, predictionEcfKm }) => {
      if (destroyed) return
      let marker = markers.get(id)
      if (!marker) {
        marker = createSatelliteMarker(viewer, id, color)
        markers.set(id, marker)
        if (viewer.selectedEntity?.id === id) marker.setSelected(true)
      }
      marker.update(name, positionEcfKm, trailEcfKm, predictionEcfKm)
    },
    removeSatellite: (id) => {
      const marker = markers.get(id)
      if (!marker) return
      if (viewer.selectedEntity === marker.entity) viewer.selectedEntity = undefined
      marker.destroy()
      markers.delete(id)
    },
    selectSatellite: (id) => {
      if (destroyed) return
      const entity = id === null ? undefined : markers.get(id)?.entity
      if (viewer.selectedEntity !== entity) viewer.selectedEntity = entity
    },
    focusSatellite: (id) => {
      const marker = markers.get(id)
      const destination = marker?.viewpoint(FOCUS_HEIGHT_KM)
      if (!marker || !destination) return
      viewer.selectedEntity = marker.entity
      camera.flyTo({ destination, duration: reducedMotion ? 0 : 2 })
    },
    screenPosition: (id) => {
      const position = markers.get(id)?.position()
      if (!position || destroyed) return null
      const occluder = new EllipsoidalOccluder(Ellipsoid.WGS84, camera.positionWC)
      if (!occluder.isPointVisible(position)) return null
      const window = SceneTransforms.worldToWindowCoordinates(scene, position)
      if (!window) return null
      const { clientWidth, clientHeight } = scene.canvas
      if (window.x < 0 || window.y < 0 || window.x > clientWidth || window.y > clientHeight) return null
      return { x: window.x, y: window.y }
    },
    onSelectionChange: (listener) => {
      selectionListeners.add(listener)
      return () => selectionListeners.delete(listener)
    },
    destroy: () => {
      destroyed = true
      selectionListeners.clear()
      removeSelectionHandler()
      hoverHandler.destroy()
      for (const marker of markers.values()) marker.destroy()
      markers.clear()
      if (!viewer.isDestroyed()) viewer.destroy()
    },
  }
}
