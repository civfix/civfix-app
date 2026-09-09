/**
 * PortraitMapPickStep (platform-agnostic default selector) - issue #61.
 *
 * The barrel imports `./PortraitMapPickStep`. At BUNDLE time the platform resolvers pick a sibling seam by
 * extension before this file is consulted:
 *   - Metro (native) resolves -> PortraitMapPickStep.native.tsx (RN Modal + inline pin-drop map).
 *   - webpack / Next (web) resolves -> PortraitMapPickStep.web.tsx (a react-dom portal so the persistent main
 *     map behind the collapsed sheet receives the taps), because next.config prepends `.web.tsx`.
 *
 * This extension-less file is only consulted by tooling with NO platform awareness (chiefly `tsc`). It
 * re-exports the web seam so tooling gets a concrete implementation + types. Re-exporting the explicit
 * `./PortraitMapPickStep.web` specifier (not the bare path) avoids resolving back into this module. (No
 * web-only import here - it only re-binds the web seam's export - so the shared-source import-guard is met;
 * mirrors the LocationPicker / MiniMap seam selectors.)
 */
export { PortraitMapPickStep } from "./PortraitMapPickStep.web"
export type { PortraitMapPickStepProps } from "./PortraitMapPickStep.types"
