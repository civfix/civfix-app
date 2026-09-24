import React from "react"
import { StyleSheet, View } from "react-native"
import { StatusBar } from "expo-status-bar"
import { launchTheme } from "@/boot/launchTheme"

export function BootBackdrop() {
  return (
    <>
      <StatusBar style="dark" />
      <View style={styles.gate} />
    </>
  )
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    backgroundColor: launchTheme.colors.bg,
  },
})
