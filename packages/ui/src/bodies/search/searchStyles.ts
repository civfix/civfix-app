import { Platform, StyleSheet } from "react-native"
import { makeThemedStyles, wash, hitSlopToTarget, MIN_TOUCH_TARGET, inputFocusedStyle } from "../../theme"
import { HEADER_CONTROL_SIZE } from "../../primitives/headerControls"
import { tabRootTitleStyle } from "../../shell/detailHeader"
import { SEARCH_RESULT_CARD_LAYOUT } from "./searchResultsModel"

const FIELD_CLEAR_SIZE = 22
export const FIELD_CLEAR_HIT_SLOP = {
  top: hitSlopToTarget(FIELD_CLEAR_SIZE),
  bottom: hitSlopToTarget(FIELD_CLEAR_SIZE),
  left: hitSlopToTarget(FIELD_CLEAR_SIZE),
  right: hitSlopToTarget(FIELD_CLEAR_SIZE),
}

export const useSearchStyles = makeThemedStyles((t) => ({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
  },
  expandedRoot: { flex: 1 },
  expandedHead: {
    paddingHorizontal: t.space["4"],
    paddingTop: 14,
    paddingBottom: t.space["3"],
    gap: t.space["3"],
    ...(Platform.OS === "web"
      ? { borderBottomWidth: 1, borderBottomColor: wash(t.colors.borderStrong, 0.45, t) }
      : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border }),
  },
  tabRootRow: { flexDirection: "row", alignItems: "center", minHeight: MIN_TOUCH_TARGET },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 12,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surface,
    ...(Platform.OS === "web"
      ? { borderWidth: 1, borderColor: wash(t.colors.borderStrong, 0.45, t) }
      : { borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border }),
  },
  fieldFocused: inputFocusedStyle(t),
  fieldInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  fieldClear: {
    width: FIELD_CLEAR_SIZE,
    height: FIELD_CLEAR_SIZE,
    borderRadius: FIELD_CLEAR_SIZE / 2,
    backgroundColor: t.colors.bgAlt,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  fieldClearPressed: { backgroundColor: t.colors.border },

  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: t.space["5"],
    minHeight: HEADER_CONTROL_SIZE,
  },
  title: {
    color: t.colors.text,
    fontFamily: t.fontFamily.displayBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1.1,
  },
  titleTabRoot: tabRootTitleStyle(t),
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: t.space["2"],
  },
  sectionTitle: {
    color: t.colors.text,
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["20"],
    lineHeight: 25,
    letterSpacing: -0.35,
  },
  clear: { minHeight: MIN_TOUCH_TARGET, justifyContent: "center", borderRadius: t.radius.xs },
  clearLabel: {
    color: t.colors.accentText,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    lineHeight: 19,
  },
  linkHovered: { textDecorationLine: "underline" },
  recents: {
    borderTopColor: t.colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  recentRow: {
    alignItems: "center",
    borderBottomColor: t.colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: t.space["3"],
    minHeight: MIN_TOUCH_TARGET,
  },
  recentRowHovered: { backgroundColor: t.colors.bgAlt },
  recentIcon: {
    alignItems: "center",
    backgroundColor: t.colors.bgAlt,
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  recentLabel: {
    color: t.colors.text,
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["15"],
    lineHeight: 20,
  },
  emptyRecents: {
    color: t.colors.textMuted,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    lineHeight: 20,
    marginBottom: t.space["2"],
  },
  laterTitle: { marginTop: t.space["5"], marginBottom: t.space["3"] },
  surfaceBreak: { height: t.space["5"] },
  railTitle: { marginBottom: t.space["3"] },
  leaderboardSub: {
    color: t.colors.textMuted,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    lineHeight: 18,
    marginTop: -t.space["1"],
    marginBottom: t.space["2"],
  },
  leaderboardEmpty: {
    backgroundColor: t.colors.surface,
    borderColor: t.colors.border,
    borderRadius: SEARCH_RESULT_CARD_LAYOUT.radius,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: t.space["4"],
  },
  personRail: { marginHorizontal: -t.space["4"] },
  personRailContent: {
    gap: t.space["3"],
    paddingHorizontal: t.space["4"],
  },
  personCard: {
    alignItems: "center",
    backgroundColor: t.colors.surface,
    borderColor: t.colors.border,
    borderRadius: SEARCH_RESULT_CARD_LAYOUT.radius,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["3"],
    width: 140,
    ...t.shadows.s1,
  },
  personCardExpanded: { width: 116 },
  personTap: {
    alignItems: "center",
    alignSelf: "stretch",
    marginBottom: t.space["2"],
    borderRadius: t.radius.md,
  },
  personCardHovered: {
    backgroundColor: t.colors.surfaceTint,
    borderColor: t.colors.borderStrong,
  },
  personName: {
    color: t.colors.text,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    lineHeight: 19,
    marginTop: t.space["2"],
    maxWidth: "100%",
  },
  personHandle: {
    color: t.colors.textSubtle,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 1,
    maxWidth: "100%",
  },
  suggestGroup: { gap: SEARCH_RESULT_CARD_LAYOUT.gap },
  pressed: { opacity: 0.64 },
  bottomPad: { height: t.space["8"] },
}))
