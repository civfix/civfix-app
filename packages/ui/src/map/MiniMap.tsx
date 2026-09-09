/**
 * MiniMap (platform-agnostic default selector) - UI-unification Stage 4 slice 5B-2.
 *
 * The barrel imports `./MiniMap`. At BUNDLE time the platform resolvers pick a sibling seam by
 * extension before this file is ever consulted:
 *   - Metro (native) resolves `./MiniMap` -> MiniMap.native.tsx (maplibre-react-native).
 *   - webpack / Next (web) resolves `./MiniMap` -> MiniMap.web.tsx (maplibre-gl + the createRoot pin
 *     bridge), because next.config prepends `.web.tsx` to resolve.extensions.
 *
 * This extension-less file is only consulted by tooling with NO platform awareness - chiefly `tsc`
 * (typecheck + the .d.ts build) and any plain Node resolver. It re-exports the web seam so that tooling
 * gets a concrete, correct implementation + types. Re-exporting the explicit `./MiniMap.web` specifier
 * (not the bare `./MiniMap`) avoids resolving back into this same module. (This file does NOT import
 * maplibre itself - it only re-binds the web seam's export - so the shared-source import-guard is met;
 * mirrors the Map / MediaPreview seam selectors.)
 */
export { MiniMap } from "./MiniMap.web"
export type { MiniMapProps } from "./MiniMap.types"
