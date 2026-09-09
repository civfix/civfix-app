/**
 * CompactShell (platform-agnostic default, stage 3C-1) - the bottom-sheet seam selector.
 *
 * The barrel imports `./CompactShell`. At BUNDLE time the platform resolvers pick a sibling seam by
 * extension before this file is consulted:
 *   - Metro (native) resolves `./CompactShell` -> CompactShell.native.tsx (@gorhom/bottom-sheet: the
 *     historic HomeSheet port - reanimated expand-outward glass, expo-blur, tap-cycle grab handle).
 *   - webpack / Next (web) resolves `./CompactShell` -> CompactShell.web.tsx (a worklet-free transform
 *     sheet: PanResponder drag + a CSS height/expand-outward transition; NO reanimated/gorhom/expo-blur),
 *     because next.config prepends `.web.tsx` to resolve.extensions.
 *
 * This extension-less file is only consulted by tooling with NO platform awareness - chiefly `tsc`
 * (typecheck + the .d.ts build) and any plain Node resolver. It re-exports the web seam (the worklet-free
 * one, safe for Next's SWC pipeline) so that tooling gets a concrete, correct implementation + types.
 * Importing the explicit `./CompactShell.web` specifier (not the bare `./CompactShell`) avoids resolving
 * back into this same module. Mirrors BlurSurface.tsx / SettingsToggle.tsx.
 */
export { CompactShell } from "./CompactShell.web"
export type { CompactShellProps } from "./CompactShell.types"
