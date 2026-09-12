import React from "react"
import { StyleSheet, View } from "react-native"
import { space } from "../theme"
import { HEADER_CONTROL_SIZE } from "../bodies/headerControls"
import { HeaderProfileButton } from "../bodies/HeaderProfileButton"
import { MapThemeToggle } from "./MapThemeToggle"
import { GLASS_CONTROL_SIZE } from "./MapControls"

export interface MapHeaderActionsProps {
  topInset?: number
}

export function MapHeaderActions({ topInset = 0 }: MapHeaderActionsProps) {
  const rowCenterOffset = (GLASS_CONTROL_SIZE - HEADER_CONTROL_SIZE) / 2
  return (
    <View style={[styles.root, { top: topInset + space["2"] + rowCenterOffset }]}>
      <View style={styles.actions}>
        <MapThemeToggle variant="solid" />
        <HeaderProfileButton surface="solid" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    right: space["3"],
    zIndex: 1,
    elevation: 1,
    pointerEvents: "box-none",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space["2"],
    pointerEvents: "box-none",
  },
})
