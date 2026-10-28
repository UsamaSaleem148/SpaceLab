import { useEffect, useRef } from 'react'
import type { GlobeController, ImagerySource } from '../globe/createGlobe'
import { cesiumIonToken, cesiumNightAssetId } from '../config'

interface GlobeViewProps {
  onReady: (controller: GlobeController | null) => void
  onImageryReady: (source: ImagerySource) => void
  onError: (message: string) => void
}

/**
 * Mounts the Cesium globe into a full-viewport container. Cesium itself is
 * lazy-loaded so the UI shell renders while the ~4 MB library downloads.
 */
export function GlobeView({ onReady, onImageryReady, onError }: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let controller: GlobeController | undefined
    let cancelled = false

    import('../globe/createGlobe')
      .then(({ createGlobe }) => {
        const container = containerRef.current
        if (cancelled || !container) return
        controller = createGlobe(container, {
          ionToken: cesiumIonToken,
          nightAssetId: cesiumNightAssetId,
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          onImageryReady,
        })
        onReady(controller)
      })
      .catch((error: unknown) => {
        console.error(error)
        if (!cancelled) onError('The 3D globe could not start. WebGL may be unavailable in this browser.')
      })

    return () => {
      cancelled = true
      controller?.destroy()
      onReady(null)
    }
  }, [onReady, onImageryReady, onError])

  return <div ref={containerRef} className="absolute inset-0" aria-label="3D Earth globe" role="application" />
}
