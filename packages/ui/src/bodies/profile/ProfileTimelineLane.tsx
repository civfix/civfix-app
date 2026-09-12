import React from "react"
import { StyleSheet, View } from "react-native"
import { makeThemedStyles, space } from "../../theme"

export const PROFILE_TIMELINE_BLEED = space["4"]

export function timelineLaneBleedStyle(bleed: number): { marginHorizontal: number } {
  return { marginHorizontal: -bleed }
}

export interface ProfileTimelineLaneProps {
  children: React.ReactNode
  bleed: number
}

export function ProfileTimelineLane({ children, bleed }: ProfileTimelineLaneProps) {
  const styles = useStyles()
  return <View style={[styles.lane, timelineLaneBleedStyle(bleed)]}>{children}</View>
}

const useStyles = makeThemedStyles((t) => ({
  lane: {
    backgroundColor: t.colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
}))
