/**
 * announce (platform-agnostic default) - the screen-reader live-region seam selector (WCAG 4.1.3).
 *
 * The barrel imports `./announce`. At BUNDLE time the platform resolvers pick a sibling seam by
 * extension before this file is ever consulted:
 *   - Metro (native) resolves `./announce` -> announce.native.ts (AccessibilityInfo).
 *   - webpack / Next (web) resolves `./announce` -> announce.web.ts (an aria-live <div>),
 *     because next.config prepends `.web.ts` to resolve.extensions.
 *
 * This extension-less file is only consulted by tooling with NO platform awareness - chiefly `tsc`
 * (typecheck + the .d.ts build) and any plain Node resolver. It re-exports the web seam so that tooling
 * gets a concrete, correct implementation + types. Importing the explicit `./announce.web` specifier
 * (not the bare `./announce`) avoids resolving back into this same module. (Mirrors the MediaPreview seam.)
 */
export { announce } from "./announce.web"
