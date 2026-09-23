import React from "react"
import { View } from "react-native"
import type { EventKind } from "@civfix/shared"
import { makeThemedStyles, useTheme } from "../../theme"
import { Text } from "../../typography"
import { EventPin } from "./EventPin"
import { inkOnFill } from "./appearance"

const COUNT_SIZE = 18

export const BlendPin = React.memo(function BlendPin({
  count,
  active = false,
  eventKind = "cleanup",
}: {
  count: number
  active?: boolean
  eventKind?: EventKind
}) {
  const styles = useStyles()
  const t = useTheme()
  return (
    <View>
      <EventPin active={active} eventKind={eventKind} />
      <View style={[styles.count, t.shadows.s2]}>
        <Text variant="caption" color={inkOnFill(t.colors.brand.bloom, t.scheme, t.colors.onAccent)}>
          {count > 99 ? "99+" : String(count)}
        </Text>
      </View>
    </View>
  )
})

const useStyles = makeThemedStyles((t) => ({
  count: {
    position: "absolute",
    top: -3,
    right: -6,
    minWidth: COUNT_SIZE,
    height: COUNT_SIZE,
    paddingHorizontal: 4,
    borderRadius: COUNT_SIZE / 2,
    backgroundColor: t.colors.brand.bloom,
    borderWidth: 1.5,
    borderColor: t.colors.onAccent,
    alignItems: "center",
    justifyContent: "center",
  },
}))
