import { makeThemedStyles } from "../theme"

export const useListBodyStyles = makeThemedStyles((t) => ({
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: t.space["4"],
    paddingTop: 0,
    paddingBottom: t.space["8"],
  },
  listContentInset: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["8"],
  },
  listEmpty: {
    flexGrow: 1,
    paddingHorizontal: t.space["4"],
  },
  footer: {
    paddingVertical: t.space["4"],
  },
  footerCentered: {
    paddingVertical: t.space["4"],
    alignItems: "center",
  },
}))
