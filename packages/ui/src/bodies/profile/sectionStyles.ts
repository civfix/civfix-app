import type { TextStyle } from "react-native"
import { makeThemedStyles, type Theme } from "../../theme"

function eyebrowType(t: Theme): TextStyle {
  return {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: t.colors.textSubtle,
    textTransform: "uppercase",
  }
}

export const useSectionStyles = makeThemedStyles((t) => ({
  eyebrow: {
    ...eyebrowType(t),
    marginTop: t.space["5"],
    marginBottom: t.space["2"],
  },
  eyebrowText: eyebrowType(t),
  subhead: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    marginTop: t.space["4"],
    marginBottom: t.space["2"],
  },
  subheadText: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 12.5,
    letterSpacing: 0.2,
    color: t.colors.textMuted,
  },
  subheadCt: {
    paddingHorizontal: t.space["2"],
    paddingVertical: 1,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  subheadCtText: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    color: t.colors.textSubtle,
  },
  empty: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13.5,
    color: t.colors.textSubtle,
    paddingVertical: t.space["3"],
    paddingHorizontal: 2,
  },
  loadMore: {
    alignSelf: "center",
    marginTop: t.space["3"],
    paddingVertical: t.space["2"],
    paddingHorizontal: t.space["5"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  loadMorePressed: {
    opacity: 0.8,
  },
  loadMoreText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  loadMoreAccentText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["13"],
    color: t.colors.accentText,
  },
  loadMoreError: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13.5,
    color: t.colors.dangerInk,
    paddingVertical: t.space["3"],
    paddingHorizontal: 2,
  },
}))
