/**
 * MediaLightbox (platform-agnostic default) - the full-screen media viewer seam selector.
 *
 * MediaLightboxContext imports `./MediaLightbox`. At BUNDLE time the platform resolvers pick a sibling
 * seam by extension before this file is ever consulted:
 *   - Metro (native) resolves `./MediaLightbox` -> MediaLightbox.native.tsx (no keyboard listeners).
 *   - webpack / Next (web) resolves `./MediaLightbox` -> MediaLightbox.web.tsx (adds window keydown nav),
 *     because next.config prepends `.web.tsx` to resolve.extensions.
 *
 * This extension-less file is only consulted by tooling with NO platform awareness - chiefly `tsc`
 * (typecheck + the .d.ts build) and any plain Node resolver. It re-exports the web seam so that tooling
 * gets a concrete, correct implementation + types. Importing the explicit `./MediaLightbox.web` specifier
 * (not the bare `./MediaLightbox`) avoids resolving back into this same module. (Mirrors the MediaPreview
 * seam selector.)
 */
export { MediaLightboxView } from "./MediaLightbox.web"
export type { MediaLightboxViewProps } from "./MediaLightbox.web"
