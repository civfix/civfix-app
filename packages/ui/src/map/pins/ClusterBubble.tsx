import React from "react"
import { View } from "react-native"
import { makeThemedStyles, useTheme } from "../../theme"
import { Text } from "../../typography"
import { clusterBubbleFill, type ClusterTone } from "./appearance"

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
  return (
    <View
      style={[
        styles.cluster,
        t.shadows.s2,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: clusterBubbleFill(tone, t.scheme),
        },
      ]}
    >
      <Text variant="bodyStrong" color={t.colors.onAccent}>
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
