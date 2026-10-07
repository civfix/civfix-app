import { makeThemedStyles, PRESSED_OPACITY_SUBTLE } from "../../theme"

export const useReportDetailSharedStyles = makeThemedStyles((t) => ({
  eyebrow: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: t.colors.textSubtle,
    marginBottom: t.space["3"],
  },
  pressed: {
    opacity: PRESSED_OPACITY_SUBTLE,
  },
}))
