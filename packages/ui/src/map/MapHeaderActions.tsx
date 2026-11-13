import { StyleSheet, View } from "react-native"
import { space } from "../theme"
import { HEADER_CONTROL_SIZE } from "../primitives/headerControls"
import { HeaderProfileButton } from "../bodies/HeaderProfileButton"
import { GLASS_CONTROL_SIZE } from "./mapControlMetrics"
import { NotificationsButton } from "../bodies/NotificationsButton"

export interface MapHeaderActionsProps {
  topInset?: number
}

export function MapHeaderActions({ topInset = 0 }: MapHeaderActionsProps) {
  const rowCenterOffset = (GLASS_CONTROL_SIZE - HEADER_CONTROL_SIZE) / 2
  return (
    <View style={[styles.root, { top: topInset + space["2"] + rowCenterOffset }]}>
      <View style={styles.actions}>
        <NotificationsButton variant="solid" />
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
