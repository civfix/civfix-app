/**
 * Sidebar-width persistence storage (platform-agnostic default selector).
 *
 * The store imports `./sidebarStorage`. At BUNDLE time the platform resolvers pick a sibling seam by
 * extension before this file is consulted:
 *   - Metro (native) resolves `./sidebarStorage` -> sidebarStorage.native.ts (MMKV).
 *   - webpack / Next (web) resolves `./sidebarStorage` -> sidebarStorage.web.ts (cookies), because
 *     next.config prepends `.web.ts` to resolve.extensions.
 *
 * This extension-less file is only consulted by tooling with NO platform awareness - chiefly `tsc`
 * (typecheck + the .d.ts build) and any plain Node resolver. It re-exports the WEB seam (the same
 * convention as filterStorage.ts / Map.tsx) so tooling gets a concrete, correct StateStorage.
 */
export { sidebarStorage } from "./sidebarStorage.web"
