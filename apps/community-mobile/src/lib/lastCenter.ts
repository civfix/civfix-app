import type { RememberedCenter } from "@civfix/ui"
import { storage } from "@/lib/mmkv"
import { LAST_MAP_CENTER_KEY } from "@/lib/mmkv-keys"

const LAST_MAP_CENTER_VERSION = 1

interface StoredCenter extends RememberedCenter {
  v: typeof LAST_MAP_CENTER_VERSION
}

function isStoredCenter(body: unknown): body is StoredCenter {
  if (typeof body !== "object" || body === null) return false
  const { v, lat, lng, zoom } = body as Partial<StoredCenter>
  return (
    v === LAST_MAP_CENTER_VERSION &&
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    Math.abs(lng) <= 180 &&
    typeof zoom === "number" &&
    Number.isFinite(zoom) &&
    zoom >= 0 &&
    zoom <= 24
  )
}

export function readLastCenter(): RememberedCenter | null {
  let raw: string | undefined
  try {
    raw = storage.getString(LAST_MAP_CENTER_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const body = JSON.parse(raw) as unknown
    if (isStoredCenter(body)) return { lat: body.lat, lng: body.lng, zoom: body.zoom }
  } catch {
    // Corrupt value: fall through to the clear below.
  }
  clearLastCenter()
  return null
}

export function writeLastCenter(center: { lat: number; lng: number; zoom?: number }): void {
  const body: StoredCenter = {
    v: LAST_MAP_CENTER_VERSION,
    lat: center.lat,
    lng: center.lng,
    zoom: center.zoom ?? 0,
  }
  if (center.zoom == null || !isStoredCenter(body)) return
  try {
    storage.set(LAST_MAP_CENTER_KEY, JSON.stringify(body))
  } catch {
    // Storage unavailable: the snapshot is an optimization, not state.
  }
}

export function clearLastCenter(): void {
  try {
    storage.delete(LAST_MAP_CENTER_KEY)
  } catch {
    // Storage unavailable: nothing to do.
  }
}
