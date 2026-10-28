/** Cesium ion access token from .env.local, or undefined when not configured. */
export const cesiumIonToken: string | undefined =
  import.meta.env.VITE_CESIUM_ION_TOKEN?.trim() || undefined

/**
 * Optional ion asset for night-side city lights (Earth at Night is 3812). Only
 * requested when set, because the asset must first be added to the ion account.
 */
export const cesiumNightAssetId: number | undefined = (() => {
  const id = Number(import.meta.env.VITE_CESIUM_NIGHT_ASSET_ID?.trim())
  return Number.isInteger(id) && id > 0 ? id : undefined
})()
