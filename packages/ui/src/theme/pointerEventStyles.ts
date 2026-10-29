import { StyleSheet } from "react-native"

/**
 * react-native-web deprecates the `pointerEvents` prop in favour of this style key, which native reads
 * too. Only a StyleSheet entry gets react-native-web's box-none and box-only polyfill (rules on the
 * children); an inline style would hand those values to CSS, which has neither.
 */
export const pointerEventStyles = StyleSheet.create({
  auto: { pointerEvents: "auto" },
  none: { pointerEvents: "none" },
  "box-none": { pointerEvents: "box-none" },
  "box-only": { pointerEvents: "box-only" },
})
