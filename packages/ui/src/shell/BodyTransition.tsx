/**
 * BodyTransition (platform-agnostic default, issue #60) - the body-region transition seam selector.
 *
 * ExpandedShell imports `./BodyTransition`. At BUNDLE time the platform resolvers pick a sibling seam by
 * extension before this file is consulted:
 *   - Metro (native) resolves `./BodyTransition` -> BodyTransition.native.tsx (the RN-Animated entrance seam; the
 *     iOS push/pop + fade-tab animation is desktop-web-only, so native keeps its own feel).
 *   - webpack / Next (web) resolves `./BodyTransition` -> BodyTransition.web.tsx (the worklet-free CSS-
 *     transition slide/cross-fade), because next.config prepends `.web.tsx` to resolve.extensions.
 *
 * This extension-less file is only consulted by tooling with NO platform awareness - chiefly `tsc`
 * (typecheck + the .d.ts build) and any plain Node resolver. It re-exports the web seam (the worklet-free
 * one, safe for Next's SWC pipeline) so that tooling gets a concrete, correct implementation + types.
 * Importing the explicit `./BodyTransition.web` specifier (not the bare `./BodyTransition`) avoids
 * resolving back into this same module. Mirrors CompactShell.tsx / SearchHeader.tsx / BlurSurface.tsx.
 */
export { BodyTransition } from "./BodyTransition.web"
export type {
  BodyTransitionProps,
  BodyTransitionDirection,
} from "./BodyTransition.types"
