import { Platform, StyleSheet, type TextStyle } from "react-native"
import { tokens } from "@civfix/shared/tokens"
import { makeThemedStyles, space, wash } from "../../theme"
import { alpha } from "../../theme/alpha"
import { DETAIL_BACK_SIZE, DETAIL_BACK_RADIUS, detailTitleStyle } from "../../shell/detailHeader"

export const CONTROL = space["10"]
const CONTROL_RADIUS = CONTROL / 2
const COMPOSER_LINE = 20
const COMPOSER_VPAD = (CONTROL - COMPOSER_LINE - StyleSheet.hairlineWidth * 2) / 2
export const COMPOSER_MAX = 120

export const useConversationStyles = makeThemedStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
  flex: { flex: 1 },
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: t.space["8"],
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: t.colors.bgAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: t.space["4"],
  },
  emptyIconMoss: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: t.colors.moss["50"],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: t.space["4"],
  },
  emptyTitle: { textAlign: "center", marginBottom: t.space["2"] },
  emptyBody: { textAlign: "center", lineHeight: 20, maxWidth: 300 },

  headerHost: {
    backgroundColor: t.colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  headerHostCompact: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 12,
  },
  headerHostExpanded: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    ...(Platform.OS === "web"
      ? { borderBottomWidth: 1, borderBottomColor: wash(t.colors.borderStrong, 0.45, t) }
      : { borderBottomColor: t.colors.borderStrong }),
  },
  convoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  back: {
    width: DETAIL_BACK_SIZE,
    height: DETAIL_BACK_SIZE,
    borderRadius: DETAIL_BACK_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceTint,
  },
  backPressed: {
    opacity: 0.6,
    backgroundColor: t.colors.bgAlt,
  },
  convoTitles: {
    flex: 1,
    minWidth: 0,
  },
  convoTitle: {
    ...detailTitleStyle(16, t),
  },
  convoTitleExpanded: {
    fontSize: 18,
  },
  avatarTap: {
    borderRadius: 19,
  },
  convoSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
    borderRadius: t.radius.xs,
  },
  convoSubPressed: {
    opacity: 0.6,
  },
  convoSub: {
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: t.colors.brand.moss,
  },

  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -t.space["2"],
    flexShrink: 0,
  },

  confirm: {
    marginTop: t.space["3"],
    backgroundColor: t.colors.bgAlt,
    borderRadius: t.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    padding: t.space["3"],
    gap: t.space["2"],
  },
  confirmText: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: t.colors.text,
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: t.space["2"],
  },
  confirmCancel: {
    paddingHorizontal: t.space["4"],
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
  },
  confirmCancelText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 13,
    color: t.colors.textMuted,
  },
  confirmBlock: {
    paddingHorizontal: t.space["4"],
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.brand.bloom,
  },
  confirmBlockText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.onAccent,
  },

  listHost: {
    flex: 1,
    position: "relative",
  },
  list: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"],
    paddingBottom: t.space["3"],
    flexGrow: 1,
  },

  newPill: {
    position: "absolute",
    bottom: t.space["3"],
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"] - 2,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.brand.bloom,
    ...t.shadows.pin,
  },
  newPillText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12,
    color: t.colors.onAccent,
  },

  flashOverlayBubble: {
    borderRadius: 18,
  },
  flashOverlayRounded: {
    borderRadius: t.radius.md,
  },
  flashOverlayCard: {
    borderRadius: t.radius.lg,
  },
  flashOverlayTheirs: {
    backgroundColor: t.colors.brand.bloom,
  },
  flashOverlayMine: {
    backgroundColor: t.colors.onAccent,
  },

  bubbleWrap: {
    maxWidth: "80%",
    marginVertical: 1,
    position: "relative",
  },
  bubbleWrapMine: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  bubbleWrapTheirs: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  bubbleWrapGroupStart: {
    marginTop: 10,
  },
  swipeReplyHint: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  swipeShift: {
    alignSelf: "stretch",
  },
  swipeShiftMine: {
    alignItems: "flex-end",
  },
  swipeShiftTheirs: {
    alignItems: "flex-start",
  },
  who: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    marginLeft: 4,
    marginBottom: 2,
  },
  whoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    maxWidth: "100%",
    marginBottom: 2,
  },
  whoBadged: {
    flexShrink: 1,
    marginBottom: 0,
  },
  bubble: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
  },
  bubbleMine: {
    backgroundColor: t.colors.brand.bloom,
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    borderBottomLeftRadius: 6,
    ...t.shadows.s1,
  },
  bubbleBare: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: t.radius.lg,
  },
  bubbleFailed: {
    backgroundColor: t.colors.bloom["600"],
  },
  bubbleBody: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 19,
  },
  bubbleBodyMine: {
    color: t.colors.onAccent,
  },
  bubbleBodyTheirs: {
    color: t.colors.text,
  },
  mentionToken: {
    fontFamily: t.fontFamily.bodySemiBold,
    color: t.colors.accentText,
  },
  mentionTokenMine: {
    fontFamily: t.fontFamily.bodyBold,
    color: t.colors.onAccent,
  },
  attachments: {
    gap: t.space["1"],
    marginTop: 3,
    maxWidth: 240,
  },
  attachmentsMine: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  attachmentsTheirs: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  attachmentWrap: {
    position: "relative",
    width: 220,
    maxWidth: "100%",
  },
  attachmentTap: {
    borderRadius: t.radius.md,
  },
  attachment: {
    width: "100%",
    height: 165,
  },
  photoReportBtn: {
    position: "absolute",
    top: t.space["1"],
    right: t.space["1"],
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.scrimStrong,
  },
  photoReportBtnHovered: {
    opacity: 0.8,
  },

  typingBubble: {
    paddingVertical: 11,
    paddingHorizontal: 15,
  },
  typingDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 8,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: t.colors.textSubtle,
  },

  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: t.space["1"],
  },
  hoverActionBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },

  tombstoneBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  tombstoneBubbleText: {
    fontFamily: t.fontFamily.bodyRegular,
    fontStyle: "italic",
    fontSize: 13,
    color: t.colors.textSubtle,
  },

  processingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  processingBubbleText: {
    fontFamily: t.fontFamily.bodyRegular,
    fontStyle: "italic",
    fontSize: 13,
    color: t.colors.textSubtle,
  },

  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editedText: {
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: 10,
    color: t.colors.textSubtle,
    marginTop: 3,
    marginHorizontal: 4,
  },
  timeText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 10,
    color: t.colors.textSubtle,
    marginTop: 3,
    marginHorizontal: 4,
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
    marginHorizontal: 4,
  },
  failedText: {
    color: t.colors.bloom["600"],
  },

  sepRow: {
    alignSelf: "center",
    marginVertical: t.space["2"],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: t.radius.sm,
    backgroundColor: alpha(t.colors.textSubtle, 0.12),
  },
  sepText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11,
    color: t.colors.textSubtle,
  },

  offlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: t.space["4"],
    paddingBottom: 4,
  },
  offlineText: {
    flex: 1,
    minWidth: 0,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: t.space["4"],
    paddingBottom: 4,
  },
  errorText: {
    flex: 1,
  },

  composer: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"] - 2,
    paddingBottom: t.space["3"],
    backgroundColor: t.colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
  channelPillBar: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"] - 2,
    paddingBottom: t.space["3"],
    backgroundColor: t.colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    alignItems: "center",
    gap: t.space["2"],
  },
  channelPillCaption: {
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: 12,
    color: t.colors.textSubtle,
    textAlign: "center",
  },
  channelPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "stretch",
    height: 40,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surfaceTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  channelPillText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14,
    color: t.colors.text,
  },
  channelPillJoin: {
    backgroundColor: t.colors.brand.moss,
    borderColor: t.colors.brand.moss,
  },
  channelPillJoinText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14,
    color: t.colors.onAccent,
  },
  joinBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["3"],
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["3"],
    backgroundColor: t.colors.moss["50"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
  joinBannerText: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 },
  joinBannerLabel: { flex: 1 },
  joinBannerBtn: {
    paddingHorizontal: t.space["4"],
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.brand.moss,
  },
  joinBannerBtnText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.onAccent,
  },
  forwardPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: t.space["2"],
    paddingVertical: 3,
    marginBottom: 2,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.moss["50"],
  },
  forwardPillText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11,
    color: t.colors.brand.moss,
  },
  composerField: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: t.space["2"],
  },
  mentionTray: {
    marginBottom: t.space["1"],
  },
  composerThumbs: {
    marginBottom: t.space["2"],
  },
  composerAttachError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: t.space["2"],
  },
  composerNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: t.space["2"],
  },
  iconBtn: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: CONTROL_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDisabled: {
    opacity: 0.4,
  },
  input: {
    flex: 1,
    minHeight: CONTROL,
    maxHeight: COMPOSER_MAX,
    paddingHorizontal: t.space["3"],
    paddingTop: COMPOSER_VPAD,
    paddingBottom: COMPOSER_VPAD,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surfaceTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    lineHeight: COMPOSER_LINE,
    color: t.colors.text,
  },
  inputFocused:
    Platform.OS === "web"
      ? ({ boxShadow: tokens.shadow.ring, borderColor: t.colors.accent } as TextStyle)
      : {},
  sendBtn: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: CONTROL_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnActive: {
    backgroundColor: t.colors.brand.bloom,
    ...t.shadows.pin,
  },
  sendBtnIdle: {
    backgroundColor: t.colors.brand.bloom,
    opacity: 0.4,
  },
  sendBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.92 }],
  },
  pressed: {
    opacity: 0.85,
  },
}))
