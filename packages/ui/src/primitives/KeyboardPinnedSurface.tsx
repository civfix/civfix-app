import React from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { KeyboardHostReserveScope } from "../shell/keyboardScrollScope"

export interface KeyboardPinnedSurfaceProps {
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}

export function KeyboardPinnedSurface({ style, children }: KeyboardPinnedSurfaceProps) {
  return (
    <KeyboardHostReserveScope>
      <View style={[styles.surface, style]}>{children}</View>
    </KeyboardHostReserveScope>
  )
}

const styles = StyleSheet.create({
  surface: { flex: 1, flexDirection: "column" },
})
