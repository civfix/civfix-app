import React from "react"
import { View } from "react-native"
import { makeThemedStyles, useTheme } from "../../theme"
import { Text } from "../../typography"
import { clusterBubbleAppearance, type ClusterTone } from "./appearance"

export const ClusterBubble = React.memo(function ClusterBubble({
  count,
  size = 40,
  tone = "reports",
}: {
  count: number
  size?: number
  tone?: ClusterTone
}) {
  const styles = useStyles()
  const t = useTheme()
  const { fill, label } = clusterBubbleAppearance(tone, t.scheme, t.colors.onAccent)
  return (
    <View
      style={[
        styles.cluster,
        t.shadows.s2,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fill,
        },
      ]}
    >
      <Text variant="bodyStrong" color={label}>
        {count > 999 ? "999+" : String(count)}
      </Text>
    </View>
  )
})

const useStyles = makeThemedStyles((t) => ({
  cluster: {
    borderWidth: 2,
    borderColor: t.colors.onAccent,
    alignItems: "center",
    justifyContent: "center",
  },
}))
