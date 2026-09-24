import type { TextStyle, ViewStyle } from "react-native"
import { inputFocusedStyle, type Theme } from "../../theme"

interface PostComposerStyleParts {
  inputSurfaceFocused: ViewStyle
  addMediaDisc: ViewStyle
  addMediaDisabled: ViewStyle
  postButtonDisabled: ViewStyle
  postButtonText: TextStyle
  postButtonTextDisabled: TextStyle
}

export function postComposerStyleParts(t: Theme): PostComposerStyleParts {
  return {
    inputSurfaceFocused: inputFocusedStyle(t),
    addMediaDisc: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surfaceTint },
    addMediaDisabled: { opacity: 0.52 },
    postButtonDisabled: { backgroundColor: t.colors.surfaceTint },
    postButtonText: { color: t.colors.neutral.card, fontFamily: t.fontFamily.bodyExtraBold, fontSize: t.fontSize["14"], lineHeight: 18 },
    postButtonTextDisabled: { color: t.colors.textSubtle },
  }
}
