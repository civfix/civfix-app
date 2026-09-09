/**
 * LocationPicker (platform-agnostic default selector) - UI-unification Stage 4 slice 5B-2.
 *
 * The barrel imports `./LocationPicker`. At BUNDLE time the platform resolvers pick a sibling seam by
 * extension before this file is ever consulted:
 *   - Metro (native) resolves `./LocationPicker` -> LocationPicker.native.tsx (maplibre-react-native).
 *   - webpack / Next (web) resolves `./LocationPicker` -> LocationPicker.web.tsx (maplibre-gl), because
 *     next.config prepends `.web.tsx` to resolve.extensions.
 *
 * This extension-less file is only consulted by tooling with NO platform awareness - chiefly `tsc`
 * (typecheck + the .d.ts build) and any plain Node resolver. It re-exports the web seam so that tooling
 * gets a concrete, correct implementation + types. Re-exporting the explicit `./LocationPicker.web`
 * specifier (not the bare `./LocationPicker`) avoids resolving back into this same module. (No maplibre
 * import here - it only re-binds the web seam's export - so the import-guard is met; mirrors Map.)
 */
export { LocationPicker } from "./LocationPicker.web"
export type { LocationPickerProps } from "./LocationPicker.types"
