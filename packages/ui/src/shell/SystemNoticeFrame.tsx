import React, { useMemo } from "react"
import { StyleSheet, View } from "react-native"
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context"
import { SystemNoticeBanner } from "./SystemNoticeBanner"
import { useVisibleSystemNotice } from "./SystemNoticeBanner.shared"

/**
 * The phone root's frame: the system notice at the top, then the app below it, pushed down by its height.
 * While the notice shows it owns the status-bar inset, so the screens read a top inset of 0 and nothing pads
 * for the status bar twice. A layer that must cover the notice (the force-update screen) mounts outside it.
 */
export function SystemNoticeFrame({ children }: { children: React.ReactNode }) {
  const notice = useVisibleSystemNotice()
  const insets = useSafeAreaInsets()
  const below = useMemo(() => (notice ? { ...insets, top: 0 } : insets), [notice, insets])
  return (
    <View style={styles.frame}>
      <SystemNoticeBanner />
      <SafeAreaInsetsContext.Provider value={below}>
        <View style={styles.content}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { flex: 1, flexDirection: "column" },
  content: { flex: 1 },
})
