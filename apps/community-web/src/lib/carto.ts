/**
 * Inlined into the static export, so changing it needs a rebuild. CARTO watermarks keyless raster
 * tiles; the key is optional and the map seam appends it only when set. Client-visible, never a secret.
 */
export const CARTO_API_KEY: string | undefined = process.env.NEXT_PUBLIC_CARTO_API_KEY
