import React from "react"
import { View, Pressable } from "react-native"
import { makeThemedStyles, useTheme, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"

export interface GroupWizardHeaderProps {
  title: string
  backLabel: string
  onBack: () => void
  trailing?: React.ReactNode
}

const BACK_ICON_SIZE = 20

export function GroupWizardHeader({ title, backLabel, onBack, trailing }: GroupWizardHeaderProps) {
  const styles = useGroupWizardHeaderStyles()
  const th = useTheme()
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        hitSlop={8}
        {...focusRingProps}
        style={({ pressed }) => [styles.backBtn, pressed ? styles.backPressed : null]}
      >
        <Icon icon={iconMap.ArrowLeft} size={BACK_ICON_SIZE} color={th.colors.text} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {trailing}
    </View>
  )
}

export const useGroupWizardHeaderStyles = makeThemedStyles((t) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["2"],
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -t.space["2"],
  },
  backPressed: {
    opacity: 0.6,
    backgroundColor: t.colors.bgAlt,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
  },
}))
