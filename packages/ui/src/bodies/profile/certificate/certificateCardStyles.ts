import { StyleSheet } from "react-native"
import { makeThemedStyles, MIN_TOUCH_TARGET } from "../../../theme"

const CONFIRM_BTN_HEIGHT = 34
export const CONFIRM_BTN_HIT_SLOP = {
  top: (MIN_TOUCH_TARGET - CONFIRM_BTN_HEIGHT) / 2,
  bottom: (MIN_TOUCH_TARGET - CONFIRM_BTN_HEIGHT) / 2,
}
// The link renders about 25pt tall (12.5px label, 4px padding); 10pt of slop each way reaches 44.
export const REVOKE_LINK_HIT_SLOP = { top: 10, bottom: 10, left: 8, right: 8 }

export const useCertificateCardStyles = makeThemedStyles((t) => ({
  wrap: {
    marginTop: t.space["4"],
    gap: t.space["2"],
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  blurb: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: t.colors.textSubtle,
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["2"],
    height: 44,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  pillDisabled: {
    opacity: 0.5,
  },
  pillText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  pressedDim: {
    opacity: 0.85,
  },

  hint: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    color: t.colors.textSubtle,
  },
  errorLine: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    color: t.colors.bloom["700"],
  },

  issued: {
    padding: t.space["3"],
    gap: t.space["2"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.moss["50"],
    borderWidth: 1.5,
    borderColor: t.colors.moss["100"],
  },
  issuedHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  issuedTitle: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.moss["700"],
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  code: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.mono,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
  },
  copyBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  summaryDot: {
    marginHorizontal: 5,
  },
  summaryText: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  openBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    backgroundColor: "transparent",
  },
  openText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["13"],
    color: t.colors.moss["700"],
  },
  fallbackBlock: {
    gap: t.space["1"],
  },
  fallbackLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: t.colors.textMuted,
  },
  fallbackUrl: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.mono,
    fontSize: 11,
    color: t.colors.textSubtle,
  },
  expiry: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 11.5,
    lineHeight: 16,
    color: t.colors.textSubtle,
  },
  expiryCountdown: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },
  expirySoon: {
    color: t.colors.bloom["700"],
  },
  verifyAt: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },

  revokeLink: {
    alignSelf: "flex-start",
    paddingVertical: t.space["1"],
  },
  revokeLinkText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 12.5,
    color: t.colors.textSubtle,
  },
  confirm: {
    gap: t.space["2"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  confirmBody: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: t.colors.textMuted,
  },
  confirmActions: {
    flexDirection: "row",
    gap: t.space["2"],
  },
  confirmKeep: {
    height: CONFIRM_BTN_HEIGHT,
    paddingHorizontal: t.space["4"],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  confirmKeepText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["13"],
    color: t.colors.text,
  },
  confirmRevoke: {
    height: CONFIRM_BTN_HEIGHT,
    paddingHorizontal: t.space["4"],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bloom["50"],
    borderWidth: 1.5,
    borderColor: t.colors.bloom["100"],
  },
  confirmRevokeText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["13"],
    color: t.colors.accentText,
  },
}))
