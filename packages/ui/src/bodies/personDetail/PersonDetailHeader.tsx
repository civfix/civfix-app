import React from "react"
import { View, Pressable } from "react-native"
import { useTheme, focusRingProps, useLayoutMode } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { useT } from "../../i18n"
import { DETAIL_BACK_ICON_SIZE } from "../../shell/detailHeader"
import { usePersonDetailStyles } from "./personDetailStyles"

export function PersonDetailHeader({ title, onBack }: { title: string | undefined; onBack: () => void }) {
  const styles = usePersonDetailStyles()
  const th = useTheme()
  const { t: tNav } = useT("nav")
  const layoutMode = useLayoutMode()

  if (layoutMode === "expanded") {
    return (
      <View style={[styles.header, styles.headerPanel]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={tNav("a11y.back")}
          hitSlop={6}
          {...focusRingProps}
          style={styles.headerChip}
        >
          <Icon icon={iconMap.ArrowLeft} size={DETAIL_BACK_ICON_SIZE} color={th.colors.text} />
        </Pressable>
        <Text style={styles.headerPanelTitle} numberOfLines={1} accessibilityRole="header">
          {title ?? tNav("title.person")}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={tNav("a11y.back")}
        hitSlop={6}
        {...focusRingProps}
        style={styles.headerButton}
      >
        <Icon icon={iconMap.ArrowLeft} size={21} color={th.colors.text} />
      </Pressable>
      <View pointerEvents="none" style={styles.headerTitleWrap}>
        <Text variant="heading" numberOfLines={1}>
          {title ?? tNav("title.person")}
        </Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  )
}
