/**
 * Map (platform-agnostic default selector).
 *
 * The barrel imports `./Map`. At BUNDLE time the platform resolvers pick a sibling seam by extension
 * before this file is ever consulted:
 *   - Metro (native) resolves `./Map` -> Map.native.tsx (maplibre-react-native + react-native-svg).
 *   - webpack / Next (web) resolves `./Map` -> Map.web.tsx (maplibre-gl + react-dom/client), because
 *     next.config prepends `.web.tsx` to resolve.extensions.
 *
 * This extension-less file is only consulted by tooling with NO platform awareness - chiefly `tsc`
 * (typecheck + the .d.ts build) and any plain Node resolver. It re-exports the web seam so that tooling
 * gets a concrete, correct implementation + types. Re-exporting the explicit `./Map.web` specifier (not
 * the bare `./Map`) avoids resolving back into this same module. (This file does NOT import maplibre-gl
 * itself - it only re-binds the web seam's export - so the shared-source import-guard is satisfied.)
 */
export { Map } from "./Map.web"
