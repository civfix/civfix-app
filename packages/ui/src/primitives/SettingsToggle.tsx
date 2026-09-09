/**
 * SettingsToggle (platform-agnostic default) - the animation seam selector.
 *
 * The barrel imports `./SettingsToggle`. At BUNDLE time the platform resolvers pick a sibling seam by
 * extension before this file is ever consulted:
 *   - Metro (native) resolves `./SettingsToggle` -> SettingsToggle.native.tsx (reanimated spring).
 *   - webpack / Next (web) resolves `./SettingsToggle` -> SettingsToggle.web.tsx (CSS transition; NO
 *     reanimated), because next.config prepends `.web.tsx` to resolve.extensions.
 *
 * This extension-less file is only consulted by tooling with NO platform awareness - chiefly `tsc`
 * (typecheck + the .d.ts build) and any plain Node resolver. It re-exports the web seam so that tooling
 * gets a concrete, correct implementation + types. Importing the explicit `./SettingsToggle.web`
 * specifier (not the bare `./SettingsToggle`) avoids resolving back into this same module.
 *
 * This is the template for all future animated primitives (worklets behind `.native`, CSS behind `.web`).
 */
export { SettingsToggle } from "./SettingsToggle.web"
export type { SettingsToggleProps } from "./SettingsToggle.types"
