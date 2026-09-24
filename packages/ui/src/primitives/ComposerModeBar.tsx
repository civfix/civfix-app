import React from "react"
import { View, Pressable } from "react-native"
import { makeThemedStyles, useTheme, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { QUOTE_ACCENT_LINE } from "./quoteStrip"

export interface ComposerModeBarProps {
  mode: "edit" | "reply"
  title: string
  excerpt: string
  accentColor?: string
  onCancel: () => void
}

export function ComposerModeBar({ mode, title, excerpt, accentColor, onCancel }: ComposerModeBarProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  const accent = accentColor ?? th.colors.accent
  return (
    <View style={styles.root}>
      <View style={[styles.accentLine, { backgroundColor: accent }]} />
      <Icon icon={mode === "edit" ? iconMap.Pencil : iconMap.CornerUpLeft} size={15} color={accent} />
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.excerpt} numberOfLines={1}>
          {excerpt}
        </Text>
      </View>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={t(mode === "edit" ? "composer.cancel_edit" : "composer.cancel_reply")}
        hitSlop={8}
        {...focusRingProps}
        style={({ pressed }) => [styles.cancelBtn, pressed ? styles.cancelBtnPressed : null]}
      >
        <Icon icon={iconMap.Close} size={16} color={th.colors.textMuted} />
      </Pressable>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    marginBottom: t.space["2"],
    paddingHorizontal: t.space["2"],
    paddingVertical: t.space["1"],
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surfaceTint,
  },
  accentLine: QUOTE_ACCENT_LINE,
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.text,
  },
  excerpt: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
    marginTop: 1,
  },
  cancelBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnPressed: {
    opacity: 0.6,
    backgroundColor: t.colors.bgAlt,
  },
}))
