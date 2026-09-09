import { makeThemedStyles } from "../../theme"

export const useEditorStyles = makeThemedStyles((t) => ({
  note: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textSubtle,
  },
  hint: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textSubtle,
  },
  hintError: {
    color: t.colors.bloom["700"],
  },
  hintOk: {
    color: t.colors.moss["700"],
  },
  field: {
    gap: t.space["1"],
  },
  fieldLabel: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 12.5,
    color: t.colors.textMuted,
  },
}))
