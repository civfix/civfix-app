import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { Icon, Text, iconMap } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { makeThemedStyles, useTheme } from "@/theme"

const BACK_ICON_SIZE = 20

export interface RouteHeaderProps {
  title: string
  onBack: () => void
}

export function RouteHeader({ title, onBack }: RouteHeaderProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("nav")

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("a11y.back")}
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
      >
        <Icon icon={iconMap.ArrowLeft} size={BACK_ICON_SIZE} color={th.colors.text} />
      </Pressable>
      <View pointerEvents="none" style={styles.titleWrap}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  header: {
    minHeight: 60,
    paddingHorizontal: t.space["4"],
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
    position: "relative",
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  titleWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  title: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 17,
    lineHeight: 22,
    color: t.colors.text,
  },
  headerSpacer: { flex: 1 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.94 }] },
}))
