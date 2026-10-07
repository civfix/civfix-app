import { StyleSheet } from "react-native"
import { makeThemedStyles } from "../../theme"
import { DETAIL_BACK_SIZE, DETAIL_BACK_RADIUS, detailTitleStyle } from "../../shell/detailHeader"
import { pillButton } from "./styleParts"

export const useConvoHeaderStyles = makeThemedStyles((t) => ({
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
    fontSize: t.fontSize["18"],
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
    fontSize: t.fontSize["13"],
    lineHeight: 18,
    color: t.colors.text,
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: t.space["2"],
  },
  confirmCancel: pillButton(t),
  confirmCancelText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  confirmBlock: {
    ...pillButton(t),
    backgroundColor: t.colors.brand.bloom,
  },
  confirmBlockText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["13"],
    color: t.colors.onAccent,
  },
  pressed: {
    opacity: 0.85,
  },
}))
