/**
 * Filter-store persistence storage (platform-agnostic default selector).
 *
 * The store imports `./filterStorage`. At BUNDLE time the platform resolvers pick a sibling seam by
 * extension before this file is consulted:
 *   - Metro (native) resolves `./filterStorage` -> filterStorage.native.ts (MMKV).
 *   - webpack / Next (web) resolves `./filterStorage` -> filterStorage.web.ts (localStorage), because
 *     next.config prepends `.web.ts` to resolve.extensions.
 *
 * This extension-less file is only consulted by tooling with NO platform awareness - chiefly `tsc`
 * (typecheck + the .d.ts build) and any plain Node resolver. It re-exports the WEB seam (the same
 * convention as Map.tsx / SettingsToggle.tsx) so that tooling gets a concrete, correct StateStorage.
 */
export { mapFilterStorage } from "./filterStorage.web"
