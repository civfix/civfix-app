import type { AccessibilityState } from "react-native"

export interface A11yStateProps {
  accessibilityState: AccessibilityState
  "aria-busy"?: boolean
  "aria-checked"?: boolean | "mixed"
  "aria-disabled"?: boolean
  "aria-expanded"?: boolean
  "aria-selected"?: boolean
}

/**
 * Spread on any control whose state a screen reader must hear. react-native-web 0.21 ignores
 * `accessibilityState`, so a radio, checkbox or disclosure declared through it alone reaches the DOM with
 * no `aria-checked` / `aria-expanded`; it only renders the ARIA props. Native reads both forms, so one
 * declaration keeps the platforms in step. A state left undefined emits no ARIA prop.
 */
export function a11yState(state: AccessibilityState): A11yStateProps {
  const props: A11yStateProps = { accessibilityState: state }
  if (state.busy !== undefined) props["aria-busy"] = state.busy
  if (state.checked !== undefined) props["aria-checked"] = state.checked
  if (state.disabled !== undefined) props["aria-disabled"] = state.disabled
  if (state.expanded !== undefined) props["aria-expanded"] = state.expanded
  if (state.selected !== undefined) props["aria-selected"] = state.selected
  return props
}
