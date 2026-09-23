import { makeThemedStyles } from "../theme"

export const useSearchHeaderStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: t.glass.sheet.input,
  },
  input: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
    padding: 0,
  },
  signIn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.glass.sheet.input,
  },

  dockedRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  homeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.accent,
  },
  clear: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.glass.sheet.input,
  },
  buttonHovered: {
    opacity: 0.85,
  },
  buttonPressed: {
    opacity: 0.6,
  },
}))
