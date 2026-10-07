import type { BBox } from "@civfix/shared"
import type { CameraTarget } from "@civfix/ui"

import { safeGet, safeRemove, safeSet } from "@/lib/browser-storage"

/**
 * Seeds the shared Map's `initialCenter` synchronously from the last-settled camera, so a returning
 * visitor's first frame is their metro and the load-time region fetch is the only one (no second fetch
 * after a locate-then-fly). Written on every region settle, so it is "where the map last sat", not just
 * where geolocation put it.
 *
 * The `window` guards exist because the module is evaluated during the Next static-export build. Every
 * storage failure (missing storage, private-mode SecurityError, quota, corrupt JSON, shape or range drift)
 * degrades to a clean miss.
 */

/** Versioned so a future shape bump is a clean miss, not a wrong-shape parse. */
export const CAMERA_SNAPSHOT_KEY = "civfix.map.camera.v1"
const CAMERA_SNAPSHOT_VERSION = 1

/** The version literal also lives in the body to guard a hand-edited or half-migrated value. */
interface SnapshotBody extends CameraTarget {
  v: typeof CAMERA_SNAPSHOT_VERSION
}

function isCameraSnapshot(body: unknown): body is SnapshotBody {
  if (typeof body !== "object" || body === null) return false
  const { v, lat, lng, zoom } = body as Partial<SnapshotBody>
  return (
    v === CAMERA_SNAPSHOT_VERSION &&
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

export function readCameraSnapshot(): CameraTarget | null {
  if (typeof window === "undefined") return null

  const raw = safeGet("local", CAMERA_SNAPSHOT_KEY)
  if (raw === null) return null

  try {
    const body = JSON.parse(raw) as unknown
    if (isCameraSnapshot(body)) return { lat: body.lat, lng: body.lng, zoom: body.zoom }
  } catch {
    // Corrupt JSON falls through to the clear-and-miss below.
  }

  clearCameraSnapshot()
  return null
}

/**
 * The center is the bbox midpoint, matching the shared `useMapViewport` store. A viewport that fails the
 * range check (a transient NaN mid-teardown, an antimeridian-wrapped bbox) is skipped rather than
 * poisoning the next boot.
 */
export function writeCameraSnapshot(viewport: BBox, zoom: number): void {
  if (typeof window === "undefined") return
  const body: SnapshotBody = {
    v: CAMERA_SNAPSHOT_VERSION,
    lat: (viewport.south + viewport.north) / 2,
    lng: (viewport.west + viewport.east) / 2,
    zoom,
  }
  if (!isCameraSnapshot(body)) return
  safeSet("local", CAMERA_SNAPSHOT_KEY, JSON.stringify(body))
}

export function clearCameraSnapshot(): void {
  if (typeof window === "undefined") return
  safeRemove("local", CAMERA_SNAPSHOT_KEY)
}
