import { StyleSheet } from "react-native"
import { makeThemedStyles } from "../../theme"
import { alpha } from "../../theme/alpha"

export const useBubbleStyles = makeThemedStyles((t) => {
  const mutedPill = {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: t.space["2"],
    borderRadius: 18,
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  } as const
  const mutedPillText = {
    fontFamily: t.fontFamily.bodyRegular,
    fontStyle: "italic",
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
  } as const
  const metaText = {
    fontSize: 10,
    color: t.colors.textSubtle,
    marginTop: 3,
    marginHorizontal: t.space["1"],
  } as const
  return {
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
      marginLeft: t.space["1"],
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
      borderBottomRightRadius: t.radius.xs,
    },
    bubbleTheirs: {
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderBottomLeftRadius: t.radius.xs,
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
      fontSize: t.fontSize["14"],
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
      gap: t.space["1"],
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

    mutedPill,
    mutedPillText,

    metaLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.space["1"],
    },
    editedText: {
      fontFamily: t.fontFamily.bodyMedium,
      ...metaText,
    },
    timeText: {
      fontFamily: t.fontFamily.bodySemiBold,
      ...metaText,
    },
    statusLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.space["1"],
      marginTop: 3,
      marginHorizontal: t.space["1"],
    },
    failedText: {
      color: t.colors.bloom["600"],
    },

    sepRow: {
      alignSelf: "center",
      marginVertical: t.space["2"],
      paddingHorizontal: 10,
      paddingVertical: t.space["1"],
      borderRadius: t.radius.sm,
      backgroundColor: alpha(t.colors.textSubtle, 0.12),
    },
    sepText: {
      fontFamily: t.fontFamily.bodySemiBold,
      fontSize: 11,
      color: t.colors.textSubtle,
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
    pressed: {
      opacity: 0.85,
    },
  }
})
