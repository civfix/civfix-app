import { makeThemedStyles } from "../../../theme"

export const BARS_HEIGHT = 96

const BAR_TRACK_HEIGHT = 10

export const useAnalyticsStyles = makeThemedStyles((t) => ({
  block: {
    gap: t.space["2"],
  },
  eventRow: {
    gap: 2,
    paddingVertical: t.space["1"],
    paddingHorizontal: t.space["1"],
    borderRadius: t.radius.sm,
  },
  eventRowHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  eventRowHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["2"],
  },
  eventRowLabel: {
    flexShrink: 1,
  },
  funnelRow: {
    gap: 2,
  },
  funnelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["2"],
  },
  funnelLabel: {
    flexShrink: 1,
  },
  barTrack: {
    height: BAR_TRACK_HEIGHT,
    width: "100%",
    borderRadius: t.radius.sm,
    overflow: "hidden",
    backgroundColor: t.colors.bgAlt,
  },
  barFill: {
    height: "100%",
    borderRadius: t.radius.sm,
  },
  ringRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["4"],
  },
  ringMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ringValue: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["18"],
    color: t.colors.text,
    fontVariant: ["tabular-nums"],
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["2"],
  },
  comparisonLabel: {
    flex: 1,
    minWidth: 0,
  },
  privacy: {
    marginTop: t.space["2"],
  },
}))
