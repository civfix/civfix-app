/**
 * Public barrel for the MediaLightbox seam - a cross-platform full-screen media viewer ("lightbox").
 *
 * A host wraps its tree in <MediaLightboxProvider> once near the root; any descendant body opens the
 * viewer with `useLightbox().open(items, startIndex)`. The platform-split overlay (.web/.native) and
 * the internal seam selector are NOT re-exported here - call sites only need the provider + the hook.
 */
export { MediaLightboxProvider, useLightbox } from "./MediaLightboxContext"
export type { LightboxItem, MediaLightboxContextValue } from "./MediaLightbox.types"
