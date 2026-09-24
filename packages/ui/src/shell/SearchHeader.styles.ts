import { StyleSheet } from "react-native"
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
    height: t.space["10"],
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
    minWidth: 0,
  },
  signIn: {
    width: t.space["8"],
    height: t.space["8"],
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
    paddingVertical: 10,
  },
  dockedSearch: {
    flex: 1,
    height: t.space["10"],
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.glass.button.border,
    overflow: "hidden",
  },
  dockedSearchContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  dockButton: {
    width: t.space["10"],
    height: t.space["10"],
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.glass.button.border,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  dockIcon: {
    zIndex: 1,
    pointerEvents: "none",
  },
  buttonHovered: {
    opacity: 0.85,
  },
  buttonPressed: {
    opacity: 0.6,
  },
}))
