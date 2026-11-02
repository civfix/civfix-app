import { setWorkerUrl } from "maplibre-gl"

// maplibre-gl 6 ships its worker as a separate module and finds it from its own import.meta.url, which a
// bundler rewrites, so the map never loads. The literal `new URL(<specifier>, import.meta.url)` form is the
// one webpack and Turbopack recognise and emit as a hashed same-origin asset.
const BUNDLED_WORKER_URL = new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href

/**
 * Called before every map is constructed rather than at module scope: the package is `sideEffects: false`,
 * so a bare side-effect import of this file could be dropped by the bundler.
 */
export function bindBundledWorker(): void {
  setWorkerUrl(BUNDLED_WORKER_URL)
}
