import { Platform, StyleSheet } from "react-native"
import { makeThemedStyles, wash } from "../../theme"
import { pillButton } from "./styleParts"

export const useTranscriptStyles = makeThemedStyles((t) => {
  const statusRow = {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: t.space["4"],
    paddingBottom: t.space["1"],
  } as const
  return {
    root: { flex: 1, backgroundColor: t.colors.bg },
    flex: { flex: 1 },
    center: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: t.space["8"],
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: t.colors.bgAlt,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: t.space["4"],
    },
    emptyIconMoss: {
      backgroundColor: t.colors.moss["50"],
    },
    emptyTitle: { textAlign: "center", marginBottom: t.space["2"] },
    emptyBody: { textAlign: "center", lineHeight: 20, maxWidth: 300 },

    headerHost: {
      backgroundColor: t.colors.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    headerHostCompact: {
      paddingHorizontal: 14,
      paddingTop: 6,
      paddingBottom: t.space["3"],
    },
    headerHostExpanded: {
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: t.space["3"],
      ...(Platform.OS === "web"
        ? { borderBottomWidth: 1, borderBottomColor: wash(t.colors.borderStrong, 0.45, t) }
        : { borderBottomColor: t.colors.borderStrong }),
    },

    listHost: {
      flex: 1,
      position: "relative",
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: t.space["4"],
      paddingTop: t.space["3"],
      paddingBottom: t.space["3"],
      flexGrow: 1,
    },

    newPill: {
      position: "absolute",
      bottom: t.space["3"],
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: t.space["1"],
      paddingHorizontal: t.space["3"],
      paddingVertical: t.space["2"] - 2,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.brand.bloom,
      ...t.shadows.pin,
    },
    newPillText: {
      fontFamily: t.fontFamily.bodySemiBold,
      fontSize: t.fontSize["12"],
      color: t.colors.onAccent,
    },

    offlineRow: statusRow,
    offlineText: {
      flex: 1,
      minWidth: 0,
    },
    errorRow: statusRow,
    errorText: {
      flex: 1,
    },

    joinBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.space["3"],
      paddingHorizontal: t.space["4"],
      paddingVertical: t.space["3"],
      backgroundColor: t.colors.moss["50"],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    joinBannerText: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 },
    joinBannerLabel: { flex: 1 },
    joinBannerBtn: {
      ...pillButton(t),
      backgroundColor: t.colors.brand.moss,
    },
    joinBannerBtnText: {
      fontFamily: t.fontFamily.bodyBold,
      fontSize: t.fontSize["13"],
      color: t.colors.onAccent,
    },
    pressed: {
      opacity: 0.85,
    },
  }
})
