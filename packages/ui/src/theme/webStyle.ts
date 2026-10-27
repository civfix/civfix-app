import type { CSSProperties } from "react"
import type { TextStyle } from "react-native"

/** CSS react-native-web hands straight to the DOM that RN's style types omit or narrow. */
type WebOnlyKey =
  | "backdropFilter"
  | "WebkitBackdropFilter"
  | "backgroundImage"
  | "cursor"
  | "outlineStyle"
  | "overflowWrap"
  | "position"
  | "touchAction"
  | "transition"

export type WebOnlyStyle = Pick<CSSProperties, WebOnlyKey>

/** An RN style whose web-only keys take their CSS types: `cursor: "grab"`, `position: "fixed"`. */
export type WebStyle = Omit<TextStyle, WebOnlyKey> & WebOnlyStyle

/**
 * Widens a style carrying web-only CSS into an RN style. RN's types describe only what native renders,
 * while react-native-web forwards these keys to CSS untouched, so this is the one assertion between them.
 */
export function webStyle(style: WebStyle): TextStyle {
  return style as TextStyle
}
