import React from "react"
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { useKeyboardHostReserveClaim } from "../shell/keyboardScrollScope"
import { usePageIsActive } from "../shell/pageActive"
import { useKeyboardReserve } from "../shell/useKeyboardReserve"

export interface KeyboardPinnedFooterProps {
  style?: StyleProp<ViewStyle>
  safeAreaBottom?: number
  children: React.ReactNode
}

export function KeyboardPinnedFooter({
  style,
  safeAreaBottom = 0,
  children,
}: KeyboardPinnedFooterProps) {
  const reserve = useKeyboardReserve()
  const pageActive = usePageIsActive()
  const lifts = pageActive && Platform.OS !== "ios"
  useKeyboardHostReserveClaim(lifts)

  const flat = (StyleSheet.flatten(style) || {}) as { paddingBottom?: number }
  const basePad = typeof flat.paddingBottom === "number" ? flat.paddingBottom : 0
  return (
    <View
      style={[
        style,
        reserve > 0 ? { marginBottom: reserve } : { paddingBottom: basePad + safeAreaBottom },
      ]}
    >
      {children}
    </View>
  )
}
