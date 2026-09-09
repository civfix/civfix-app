/**
 * TabBar (platform-agnostic default) - the bottom tab-bar seam selector (feed-first redesign, P3).
 *
 * The barrel imports `./TabBar`. At BUNDLE time the platform resolvers pick a sibling seam by extension
 * before this file is consulted:
 *   - Metro (native) resolves `./TabBar` -> TabBar.native.tsx (reanimated active-pill slide).
 *   - webpack / Next (web) resolves `./TabBar` -> TabBar.web.tsx (CSS-transition pill; worklet-free),
 *     because next.config prepends `.web.tsx` to resolve.extensions.
 *
 * This extension-less file is only consulted by tooling with NO platform awareness - chiefly `tsc` and
 * plain Node - so it re-exports the web seam (the worklet-free one, safe for Next's SWC pipeline).
 * Importing the explicit `./TabBar.web` specifier (not the bare `./TabBar`) avoids resolving back into
 * this module. Mirrors CompactShell.tsx / SearchHeader.tsx.
 */
export { TabBar } from "./TabBar.web"
