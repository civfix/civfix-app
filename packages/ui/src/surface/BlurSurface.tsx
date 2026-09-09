/**
 * BlurSurface (platform-agnostic default).
 *
 * The barrel imports `./BlurSurface`. At BUNDLE time the platform resolvers pick a sibling seam by
 * extension before this file is ever consulted:
 *   - Metro (native) resolves `./BlurSurface` -> BlurSurface.native.tsx (expo-blur).
 *   - webpack / Next (web) resolves `./BlurSurface` -> BlurSurface.web.tsx (CSS backdrop-filter),
 *     because next.config prepends `.web.tsx` to resolve.extensions.
 *
 * This extension-less file is only consulted by tooling that has NO platform awareness - chiefly
 * `tsc` (typecheck + the .d.ts build) and any plain Node resolver. It re-exports the web seam so that
 * tooling gets a concrete, correct implementation + types. Importing the explicit `./BlurSurface.web`
 * specifier (not the bare `./BlurSurface`) avoids resolving back into this same module.
 */
export { BlurSurface } from "./BlurSurface.web"
