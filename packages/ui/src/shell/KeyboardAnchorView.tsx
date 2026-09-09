/**
 * KeyboardAnchorView - default selector (tooling-only).
 *
 * The bundlers pick the `.web` / `.native` sibling by extension before this file is consulted; it exists
 * only for platform-unaware tooling (tsc, the .d.ts build, plain Node). Re-export the explicit `.web`
 * specifier so it never resolves back into itself. See section 7 of the UI authoring guide.
 */
export { KeyboardAnchorView } from "./KeyboardAnchorView.web"
export type { KeyboardAnchorViewProps } from "./KeyboardAnchorView.types"
