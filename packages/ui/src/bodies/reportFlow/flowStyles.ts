import { makeThemedStyles } from "../../theme"

/** The submit outcome column: its actions, the feed-share row and the signed-out hint share one width. */
export const SUBMIT_STATE_MAX_WIDTH = 340

export const useFlowStyles = makeThemedStyles((t) => ({
  stepBlock: { gap: t.space["3"] },
  fieldLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  pressed: { opacity: 0.9 },
}))
