/**
 * The publishable CARTO basemap api key.
 *
 * Reads NEXT_PUBLIC_CARTO_API_KEY, which is INLINED into the static export at build time (changing it
 * needs a rebuild, not a restart). CARTO watermarks keyless raster tiles, so a configured key removes the
 * watermark - but the key is optional by design: the shared @civfix/ui map seam appends it with its own
 * `withCartoKey` only when it is set, so a blank key leaves the basemap exactly as it always was. It is a
 * client-visible value, never a secret. Injected into the shared map through the data seam (providers.tsx).
 */
export const CARTO_API_KEY: string | undefined = process.env.NEXT_PUBLIC_CARTO_API_KEY
