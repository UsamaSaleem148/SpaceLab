// CesiumJS resolves its workers and static assets relative to CESIUM_BASE_URL.
// This module must be imported before 'cesium' so the value is set first.
declare global {
  interface Window {
    CESIUM_BASE_URL: string
  }
}

window.CESIUM_BASE_URL = `${import.meta.env.BASE_URL}cesium/`

export {}
