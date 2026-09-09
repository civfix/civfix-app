import React from "react"
import { StyleSheet, View } from "react-native"
import { theme } from "../theme"
import { HEADER_ICON_BUTTON_TARGET, HeaderIconButton } from "../bodies/HeaderIconButton"
import { HeaderProfileButton } from "../bodies/HeaderProfileButton"
import { openReportFlow } from "../bodies/composerCreateFlow"
import { useT } from "../i18n"
import { MapThemeToggle } from "./MapThemeToggle"
import { GLASS_CONTROL_SIZE } from "./MapControls"

export interface MapHeaderActionsProps {
  topInset?: number
}

export function MapHeaderActions({ topInset = 0 }: MapHeaderActionsProps) {
  const { t } = useT("nav")
  const rowCenterOffset = (GLASS_CONTROL_SIZE - HEADER_ICON_BUTTON_TARGET) / 2
  return (
    <View style={[styles.root, { top: topInset + theme.space["2"] + rowCenterOffset }]}>
      <View style={styles.actions}>
        <MapThemeToggle variant="solid" />
        <HeaderIconButton
          icon="Plus"
          label={t("create.report")}
          onPress={openReportFlow}
          surface="solid"
        />
        <HeaderProfileButton surface="solid" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    right: theme.space["3"],
    zIndex: 1,
    elevation: 1,
    pointerEvents: "box-none",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space["2"],
    pointerEvents: "box-none",
  },
})
