/**
 * App-promo dismissal storage (platform-agnostic default selector).
 *
 * The store imports `./appPromoStorage`. At BUNDLE time the platform resolvers pick a sibling seam by
 * extension before this file is consulted:
 *   - Metro (native) resolves `./appPromoStorage` -> appPromoStorage.native.ts (MMKV).
 *   - webpack / Next (web) resolves `./appPromoStorage` -> appPromoStorage.web.ts (localStorage),
 *     because next.config prepends `.web.ts` to resolve.extensions.
 *
 * This extension-less file is only consulted by tooling with NO platform awareness - chiefly `tsc`
 * (typecheck + the .d.ts build) and any plain Node resolver (vitest). It re-exports the WEB seam (the
 * same convention as sidebarStorage.ts / filterStorage.ts) so tooling gets a concrete, correct
 * StateStorage.
 */
export { appPromoStorage } from "./appPromoStorage.web"
