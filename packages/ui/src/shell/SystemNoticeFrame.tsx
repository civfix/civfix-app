import React, { useCallback, useMemo, useState } from "react"
import { StyleSheet, View, type LayoutChangeEvent } from "react-native"
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context"
import { SystemNoticeBanner } from "./SystemNoticeBanner"
import { useVisibleSystemNotice } from "./SystemNoticeBanner.shared"
import { SystemNoticeFrameContext } from "./systemNoticeFrameContext"

/**
 * The phone root's frame: the system notice at the top, then the app below it, pushed down by its height.
 * While the notice shows it owns the status-bar inset, so the screens read a top inset of 0 and nothing pads
 * for the status bar twice. The frame context keeps the device's insets for surfaces that cover the whole
 * window (FullWindowModal), and the height the notice took for layouts sized from the window
 * (useShellWindowHeight). A layer that must cover the notice (the force-update screen) mounts outside it.
 */
export function SystemNoticeFrame({ children }: { children: React.ReactNode }) {
  const notice = useVisibleSystemNotice()
  const insets = useSafeAreaInsets()
  const [barHeight, setBarHeight] = useState(0)
  const onBarLayout = useCallback((e: LayoutChangeEvent) => setBarHeight(e.nativeEvent.layout.height), [])
  const takenTop = notice ? barHeight : 0
  const below = useMemo(() => (notice ? { ...insets, top: 0 } : insets), [notice, insets])
  const frame = useMemo(() => ({ windowInsets: insets, takenTop }), [insets, takenTop])
  return (
    <View style={styles.frame}>
      <SystemNoticeBanner onLayout={onBarLayout} />
      <SystemNoticeFrameContext.Provider value={frame}>
        <SafeAreaInsetsContext.Provider value={below}>
          <View style={styles.content}>{children}</View>
        </SafeAreaInsetsContext.Provider>
      </SystemNoticeFrameContext.Provider>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { flex: 1, flexDirection: "column" },
  content: { flex: 1 },
})
