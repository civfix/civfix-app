import React from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { headingLevel, makeThemedStyles } from "../theme"
import { Text } from "../typography"

export interface SectionCardProps {
  label?: string
  trailing?: React.ReactNode
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
}

export function SectionCard({ label, trailing, children, style, testID }: SectionCardProps) {
  const styles = useStyles()
  return (
    <View style={style} testID={testID}>
      {label || trailing ? (
        <View style={styles.header}>
          {label ? (
            <Text style={styles.eyebrow} accessibilityRole="header" {...headingLevel(2)}>
              {label}
            </Text>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        </View>
      ) : null}
      <View style={styles.card}>{children}</View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    marginBottom: t.space["2"],
  },
  headerSpacer: {
    flex: 1,
  },
  eyebrow: {
    flex: 1,
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: t.colors.textSubtle,
    textTransform: "uppercase",
    marginLeft: t.space["1"],
  },
  trailing: {
    flexShrink: 0,
  },
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    padding: t.space["4"],
    ...t.shadows.s1,
  },
}))
