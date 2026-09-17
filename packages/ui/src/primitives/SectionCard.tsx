import React from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { headingLevel, makeThemedStyles } from "../theme"
import { Text } from "../typography"

export type SectionCardVariant = "padded" | "list"

export interface SectionCardProps {
  label?: string
  trailing?: React.ReactNode
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
  variant?: SectionCardVariant
  dividerInset?: number
  listHeader?: React.ReactNode
}

export function SectionCard({
  label,
  trailing,
  children,
  style,
  testID,
  variant = "padded",
  dividerInset,
  listHeader,
}: SectionCardProps) {
  const styles = useStyles()
  const list = variant === "list"
  const rows = list ? React.Children.toArray(children).filter(Boolean) : null
  const rowDivider = dividerInset ? [styles.divider, { marginLeft: dividerInset }] : styles.divider
  return (
    <View style={style} testID={testID}>
      {label || trailing ? (
        <View style={styles.header}>
          {label ? (
            <Text
              style={styles.eyebrow}
              numberOfLines={1}
              accessibilityRole="header"
              {...headingLevel(2)}
            >
              {label}
            </Text>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        </View>
      ) : null}
      <View style={[styles.card, list ? styles.cardList : null]}>
        {rows ? (
          <>
            {listHeader ? (
              <>
                {listHeader}
                <View style={styles.divider} />
              </>
            ) : null}
            {rows.map((row, index) => (
              <React.Fragment key={index}>
                {index > 0 ? <View style={rowDivider} /> : null}
                {row}
              </React.Fragment>
            ))}
          </>
        ) : (
          children
        )}
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["2"],
    minHeight: 16,
    marginBottom: t.space["2"],
  },
  headerSpacer: {
    flex: 1,
  },
  eyebrow: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    letterSpacing: 0.6,
    color: t.colors.textSubtle,
    textTransform: "uppercase",
    marginLeft: t.space["1"],
  },
  trailing: {
    flexShrink: 0,
    alignItems: "flex-end",
  },
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    paddingVertical: t.space["4"],
    paddingHorizontal: t.space["4"],
    ...t.shadows.s1,
  },
  cardList: {
    paddingVertical: t.space["2"],
    paddingHorizontal: 0,
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
  },
}))
