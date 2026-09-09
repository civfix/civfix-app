import type { BBox } from "@civfix/shared"

/**
 * The home map's LAST-SETTLED camera, persisted in localStorage so the next boot can seed the shared
 * Map's `initialCenter` synchronously and render the user's metro on the very first frame.
 *
 * Why: without a seed the map boots at the neutral statewide default (zoom 4), `map.on("load")` fires a
 * region fetch for a continental bbox, and only when the async location resolve lands does the camera
 * fly to the user - whose moveend fires region fetch #2. Every cold load therefore fetched (and
 * repainted) the map twice. Booting AT the last-settled camera makes the load-time fetch the only one
 * for every returning visitor; only a genuine first visit (no snapshot yet) still takes the one
 * locate-then-fly camera flight.
 *
 * The write happens on EVERY region settle (home-map.tsx `onRegionChange`), so the snapshot is simply
 * "where the map last sat" - the standard maps-app boot camera - not just where geolocation put it.
 *
 * Mirrors lib/auth-snapshot.ts: versioned key, `window` guards (the module is evaluated during the
 * Next.js static-export build), and every failure mode - missing storage, private-mode SecurityError,
 * quota, corrupt JSON, shape/range drift - degrades to a clean miss. Never throws.
 */

/** Storage key. Version is in the key so a future shape bump is a clean miss, not a wrong-shape parse. */
export const CAMERA_SNAPSHOT_KEY = "civfix.map.camera.v1"
const CAMERA_SNAPSHOT_VERSION = 1

/** A boot camera: where to put the map's first frame. Matches the shared Map's `initialCenter` shape. */
export interface CameraSnapshot {
  lat: number
  lng: number
  zoom: number
}

/** Persisted body. The version literal also lives here to guard a hand-edited or half-migrated value. */
interface SnapshotBody extends CameraSnapshot {
  v: typeof CAMERA_SNAPSHOT_VERSION
}

/** Range-check a candidate: finite, on-globe, and a zoom maplibre can actually hold. */
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

/**
 * Read the last-settled camera, or null when absent/unreadable. Any failure - no window, missing key,
 * bad JSON, version/shape/range mismatch, or a SecurityError from a privacy-mode localStorage - clears
 * the key (best effort) and returns null. Never throws.
 */
export function readCameraSnapshot(): CameraSnapshot | null {
  if (typeof window === "undefined") return null

  let raw: string | null
  try {
    raw = window.localStorage.getItem(CAMERA_SNAPSHOT_KEY)
  } catch {
    // SecurityError (storage disabled / partitioned). Nothing to clear; treat as a miss.
    return null
  }
  if (raw === null) return null

  try {
    const body = JSON.parse(raw) as unknown
    if (isCameraSnapshot(body)) return { lat: body.lat, lng: body.lng, zoom: body.zoom }
  } catch {
    // Corrupt JSON: fall through to clear + miss.
  }

  clearCameraSnapshot()
  return null
}

/**
 * Best-effort persist of a settled viewport's center + zoom. The center is the bbox midpoint - the
 * same derivation the shared `useMapViewport` store uses for its own `center`. A viewport that fails
 * the range check (a transient NaN mid-teardown, an antimeridian-wrapped bbox) is skipped rather than
 * poisoning the next boot; quota / private-mode write failures are ignored (the snapshot is an
 * optimization, not state).
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
  try {
    window.localStorage.setItem(CAMERA_SNAPSHOT_KEY, JSON.stringify(body))
  } catch {
    // Quota exceeded or storage unavailable (private mode).
  }
}

/** Best-effort removal of the persisted camera. */
export function clearCameraSnapshot(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(CAMERA_SNAPSHOT_KEY)
  } catch {
    // Storage unavailable: nothing to do.
  }
}
