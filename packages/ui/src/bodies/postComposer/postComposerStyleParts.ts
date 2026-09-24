import { Platform, type TextStyle, type ViewStyle } from "react-native"
import { tokens } from "@civfix/shared/tokens"
import type { Theme } from "../../theme"

interface PostComposerStyleParts {
  inputSurfaceFocused: ViewStyle
  addMediaDisc: ViewStyle
  addMediaDisabled: ViewStyle
  postButtonDisabled: ViewStyle
  postButtonText: TextStyle
  postButtonTextDisabled: TextStyle
}

/** The field focus, add-media disc and Post button looks the full-screen and the inline feed composer share. */
export function postComposerStyleParts(t: Theme): PostComposerStyleParts {
  return {
    inputSurfaceFocused:
      Platform.OS === "web"
        ? ({ boxShadow: tokens.shadow.ring, borderColor: t.colors.accent } as ViewStyle)
        : { borderColor: t.colors.accent },
    addMediaDisc: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surfaceTint },
    addMediaDisabled: { opacity: 0.52 },
    postButtonDisabled: { backgroundColor: t.colors.surfaceTint },
    postButtonText: { color: t.colors.neutral.card, fontFamily: t.fontFamily.bodyExtraBold, fontSize: t.fontSize["14"], lineHeight: 18 },
    postButtonTextDisabled: { color: t.colors.textSubtle },
  }
}
