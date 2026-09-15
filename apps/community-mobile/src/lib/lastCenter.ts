import { isRememberedCenter, type RememberedCenter } from "@civfix/ui"
import { storage } from "@/lib/mmkv"
import { LAST_MAP_CENTER_KEY } from "@/lib/mmkv-keys"

const LAST_MAP_CENTER_VERSION = 1

interface StoredCenter extends RememberedCenter {
  v: typeof LAST_MAP_CENTER_VERSION
}

function isStoredCenter(body: unknown): body is StoredCenter {
  if (!isRememberedCenter(body)) return false
  return (body as Partial<StoredCenter>).v === LAST_MAP_CENTER_VERSION
}

function clearLastCenter(): void {
  try {
    storage.delete(LAST_MAP_CENTER_KEY)
  } catch {}
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
  } catch {}
  clearLastCenter()
  return null
}

export function writeLastCenter(center: RememberedCenter): void {
  const body: StoredCenter = { v: LAST_MAP_CENTER_VERSION, ...center }
  if (!isStoredCenter(body)) return
  try {
    storage.set(LAST_MAP_CENTER_KEY, JSON.stringify(body))
  } catch {}
}
