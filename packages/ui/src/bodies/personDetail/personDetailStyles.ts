import { Platform, StyleSheet } from "react-native"
import { makeThemedStyles, wash } from "../../theme"
import { DETAIL_BACK_SIZE, DETAIL_BACK_RADIUS, detailTitleStyle } from "../../shell/detailHeader"

export const usePersonDetailStyles = makeThemedStyles((t) => ({
  root: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  header: {
    minHeight: 52,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: t.space["4"],
    backgroundColor: t.colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -t.space["3"],
  },
  headerPanel: {
    minHeight: 0,
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: t.space["3"],
    borderBottomColor:
      Platform.OS === "web" ? wash(t.colors.borderStrong, 0.45, t) : t.colors.border,
  },
  headerChip: {
    width: DETAIL_BACK_SIZE,
    height: DETAIL_BACK_SIZE,
    borderRadius: DETAIL_BACK_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  headerPanelTitle: { ...detailTitleStyle(18, t), flex: 1 },
  headerTitleWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 52,
  },
  headerSpacer: { width: 44 },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingBottom: t.space["10"],
  },
  stateFill: {
    flex: 1,
  },

  skeletonName: { marginTop: 10 },
  skeletonHandle: { marginTop: t.space["2"] },
  skeletonBio: { marginTop: 10 },
  skeletonBioLast: { marginTop: 6 },
  skeletonStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: t.space["2"],
    marginTop: t.space["3"],
  },
  skeletonTabs: {
    flexDirection: "row",
    gap: t.space["2"],
    marginTop: t.space["4"],
    marginBottom: t.space["3"],
  },
  hero: {
    alignItems: "center",
    paddingTop: t.space["2"],
    paddingBottom: t.space["1"],
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    maxWidth: "100%",
  },
  name: {
    flexShrink: 1,
    fontFamily: t.fontFamily.displayBold,
    fontSize: 21,
    color: t.colors.text,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  handleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    maxWidth: "100%",
  },
  handle: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.textSubtle,
    textAlign: "center",
  },
  bio: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: t.colors.textMuted,
    marginTop: t.space["2"],
    textAlign: "center",
    maxWidth: 320,
  },
  affiliation: {
    marginTop: t.space["3"],
    marginHorizontal: t.space["4"],
  },
  socialRow: {
    marginTop: t.space["3"],
    marginHorizontal: t.space["4"],
  },

  donate: {
    marginTop: t.space["4"],
    marginHorizontal: t.space["4"],
  },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"] + 2,
    marginTop: t.space["4"],
    marginHorizontal: 2,
  },
  followAction: {
    flex: 1,
  },
  secondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 42,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  secondaryPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  secondaryText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  blockedLabel: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },

  overflowBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  confirmText: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: t.colors.text,
  },

  events: {
    marginTop: t.space["5"],
  },
  eventsLabel: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: t.colors.textSubtle,
    marginBottom: t.space["2"],
  },
  eventsGroupLabel: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: t.colors.textSubtle,
    marginTop: t.space["2"],
    marginBottom: t.space["1"],
  },
  mini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 10,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    marginBottom: t.space["2"],
    ...t.shadows.s1,
  },
  miniPressed: {
    opacity: 0.9,
  },
  dateChip: {
    flexShrink: 0,
    width: 34,
    paddingVertical: t.space["1"],
    borderRadius: 9,
    backgroundColor: t.colors.sun["50"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.sun["100"],
    alignItems: "center",
  },
  dateDay: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["15"],
    lineHeight: 16,
    color: t.colors.sun["700"],
  },
  dateMonth: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 8,
    letterSpacing: 0.5,
    color: t.colors.sun["700"],
    marginTop: 2,
  },
  miniMeta: {
    flex: 1,
    minWidth: 0,
  },
  miniTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13.5,
    color: t.colors.text,
  },
  miniSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  miniSub: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },
  miniSubWhen: {
    flexShrink: 1,
  },
  miniSubDot: {
    marginHorizontal: 5,
  },

  postsLane: {
    marginBottom: t.space["5"],
  },
  postsState: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
    paddingVertical: t.space["2"],
  },
}))
