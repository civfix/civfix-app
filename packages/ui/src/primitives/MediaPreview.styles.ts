import { StyleSheet } from "react-native"
import { makeThemedStyles } from "../theme"

export const useMediaPreviewStyles = makeThemedStyles((t) => ({
  frame: {
    width: "100%",
    borderRadius: t.radius.lg,
    overflow: "hidden",
    backgroundColor: t.colors.neutral.paper2,
  },
  framed: t.imageFrame,
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  fallbackText: {
    fontFamily: t.fontFamily.bodySemiBold,
  },
  videoTag: {
    position: "absolute",
    top: t.space["2"],
    left: t.space["2"],
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: t.space["2"],
    paddingVertical: 3,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.scrimStrong,
    pointerEvents: "none",
  },
  videoTagText: {
    fontFamily: t.fontFamily.bodySemiBold,
  },
}))
