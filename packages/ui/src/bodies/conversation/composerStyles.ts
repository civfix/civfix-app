import { Platform, StyleSheet, type TextStyle } from "react-native"
import { tokens } from "@civfix/shared/tokens"
import { makeThemedStyles } from "../../theme"
import { COMPOSER_MAX, CONTROL } from "./styleParts"

const CONTROL_RADIUS = CONTROL / 2
const COMPOSER_LINE = 20
const COMPOSER_VPAD = (CONTROL - COMPOSER_LINE - StyleSheet.hairlineWidth * 2) / 2

export const useComposerStyles = makeThemedStyles((t) => {
  const composerBar = {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"] - 2,
    paddingBottom: t.space["3"],
    backgroundColor: t.colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  } as const
  const inlineRow = {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: t.space["2"],
  } as const
  const roundControl = {
    width: CONTROL,
    height: CONTROL,
    borderRadius: CONTROL_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  } as const
  return {
    composer: composerBar,
    channelPillBar: {
      ...composerBar,
      alignItems: "center",
      gap: t.space["2"],
    },
    channelPillCaption: {
      fontFamily: t.fontFamily.bodyMedium,
      fontSize: t.fontSize["12"],
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
      fontSize: t.fontSize["14"],
      color: t.colors.text,
    },
    channelPillJoin: {
      backgroundColor: t.colors.brand.moss,
      borderColor: t.colors.brand.moss,
    },
    channelPillJoinText: {
      fontFamily: t.fontFamily.bodyBold,
      fontSize: t.fontSize["14"],
      color: t.colors.onAccent,
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
    composerAttachError: inlineRow,
    composerNotice: inlineRow,
    iconBtn: roundControl,
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
    sendBtn: roundControl,
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
  }
})
