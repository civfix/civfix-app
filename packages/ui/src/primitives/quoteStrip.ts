import type { ViewStyle } from "react-native"

export const QUOTE_ACCENT_LINE: ViewStyle = {
  width: 3,
  alignSelf: "stretch",
  borderRadius: 1.5,
}

export function excerptOf(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}
