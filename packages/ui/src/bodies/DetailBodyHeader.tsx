import React from "react"
import { Platform, Pressable, StyleSheet, View } from "react-native"
import { focusRingProps, headingLevel, makeThemedStyles, wash, useLayoutMode, useTheme, MIN_TOUCH_TARGET } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import {
  DETAIL_BACK_SIZE,
  DETAIL_BACK_RADIUS,
  DETAIL_BACK_ICON_SIZE,
  detailTitleStyle,
} from "../shell/detailHeader"

const COMPACT_BACK_ICON_SIZE = 21
const BACK_HIT_SLOP = 6

/**
 * How the compact (portrait) title renders. `heading`: the level-1 page heading, free to wrap. `label`:
 * one line, inset clear of the back button, and not announced as a heading.
 */
export type DetailBodyCompactTitle = "heading" | "label"

export interface DetailBodyHeaderProps {
  title: string
  backLabel: string
  onBack: () => void
  compactTitle: DetailBodyCompactTitle
}

export function DetailBodyHeader({ title, backLabel, onBack, compactTitle }: DetailBodyHeaderProps) {
  const styles = useStyles()
  const th = useTheme()
  const expanded = useLayoutMode() === "expanded"

  if (expanded) {
    return (
      <View style={[styles.header, styles.headerPanel]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={BACK_HIT_SLOP}
          {...focusRingProps}
          style={styles.headerChip}
        >
          <Icon icon={iconMap.ArrowLeft} size={DETAIL_BACK_ICON_SIZE} color={th.colors.text} />
        </Pressable>
        <Text style={styles.headerPanelTitle} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        hitSlop={BACK_HIT_SLOP}
        {...focusRingProps}
        style={styles.headerButton}
      >
        <Icon icon={iconMap.ArrowLeft} size={COMPACT_BACK_ICON_SIZE} color={th.colors.text} />
      </Pressable>
      {compactTitle === "heading" ? (
        <View pointerEvents="none" style={styles.headerTitleWrap}>
          <Text variant="heading" accessibilityRole="header" {...headingLevel(1)}>
            {title}
          </Text>
        </View>
      ) : (
        <View pointerEvents="none" style={[styles.headerTitleWrap, styles.headerTitleWrapInset]}>
          <Text variant="heading" numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
      <View style={styles.headerSpacer} />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  header: {
    minHeight: 52,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: t.space["4"],
    backgroundColor: t.colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  headerButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -t.space["3"],
  },
  headerPanel: {
    minHeight: 0,
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: t.space["3"],
    borderBottomColor:
      Platform.OS === "web" ? wash(t.colors.borderStrong, 0.45, t) : t.colors.border,
  },
  headerChip: {
    width: DETAIL_BACK_SIZE,
    height: DETAIL_BACK_SIZE,
    borderRadius: DETAIL_BACK_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  headerPanelTitle: { ...detailTitleStyle(18, t), flex: 1 },
  headerTitleWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  headerTitleWrapInset: {
    paddingHorizontal: 52,
  },
  headerSpacer: { width: MIN_TOUCH_TARGET },
}))
