import React from "react"
import { View, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import { makeThemedStyles, space, useTheme, focusRingProps, webCursor, headingLevel } from "../theme"
import { Text, Icon, iconMap, type IconName } from "../typography"
import { SettingsToggle } from "./SettingsToggle"

export const SETTINGS_ROW_MIN_HEIGHT = 56
const ICON_TILE = 32
const ROW_PAD_H = 13
const ROW_GAP = space["3"]
const DIVIDER_INSET = ROW_PAD_H + ICON_TILE + ROW_GAP

export interface SettingsToggleBinding {
  value: boolean
  onValueChange: (next: boolean) => void
}

export interface SettingsRowProps {
  label: string
  icon?: IconName
  sub?: string
  value?: string
  onPress?: () => void
  toggle?: SettingsToggleBinding
  variant?: "default" | "destructive"
  disabled?: boolean
  chevron?: boolean
  accessibilityLabel?: string
}

export interface SettingsSectionProps {
  label?: string
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function SettingsSection({ label, children, style }: SettingsSectionProps) {
  const styles = useStyles()
  const rows = React.Children.toArray(children).filter(Boolean)
  return (
    <View style={style}>
      {label ? (
        <Text style={styles.eyebrow} accessibilityRole="header" {...headingLevel(2)}>
          {label}
        </Text>
      ) : null}
      <View style={styles.card}>
        {rows.map((row, index) => (
          <React.Fragment key={index}>
            {index > 0 ? <View style={styles.divider} /> : null}
            {row}
          </React.Fragment>
        ))}
      </View>
    </View>
  )
}

function RowContent({
  label,
  icon,
  sub,
  destructive,
}: {
  label: string
  icon?: IconName
  sub?: string
  destructive: boolean
}) {
  const styles = useStyles()
  const t = useTheme()
  return (
    <>
      {icon ? (
        <View style={[styles.iconTile, destructive ? styles.iconTileDestructive : null]}>
          <Icon
            icon={iconMap[icon]}
            size={16}
            color={destructive ? t.colors.dangerInk : t.colors.textMuted}
          />
        </View>
      ) : null}
      <View style={styles.meta}>
        <Text style={[styles.label, destructive ? styles.labelDestructive : null]} numberOfLines={2}>
          {label}
        </Text>
        {sub ? (
          <Text style={styles.sub} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
    </>
  )
}

export function SettingsRow({
  label,
  icon,
  sub,
  value,
  onPress,
  toggle,
  variant = "default",
  disabled = false,
  chevron,
  accessibilityLabel,
}: SettingsRowProps) {
  const styles = useStyles()
  const t = useTheme()
  const destructive = variant === "destructive"
  const showChevron = chevron ?? !destructive

  if (toggle) {
    return (
      <View style={styles.row}>
        <Pressable
          onPress={() => toggle.onValueChange(!toggle.value)}
          focusable={false}
          {...({ tabIndex: -1 } as object)}
          {...focusRingProps}
          style={[styles.toggleTextCol, webCursor()]}
        >
          <RowContent label={label} icon={icon} sub={sub} destructive={false} />
        </Pressable>
        <SettingsToggle
          value={toggle.value}
          onValueChange={toggle.onValueChange}
          onColor={t.colors.brand.bloom}
          accessibilityLabel={accessibilityLabel ?? label}
        />
      </View>
    )
  }

  if (!onPress) {
    return (
      <View style={[styles.row, disabled ? styles.rowDisabled : null]}>
        <RowContent label={label} icon={icon} sub={sub} destructive={destructive} />
        {value ? (
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
    )
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      {...focusRingProps}
      style={({ pressed }) => [
        styles.row,
        webCursor(disabled),
        disabled ? styles.rowDisabled : null,
        pressed && !disabled ? styles.rowPressed : null,
      ]}
    >
      <RowContent label={label} icon={icon} sub={sub} destructive={destructive} />
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {showChevron ? (
        <Icon icon={iconMap.ChevronRight} size={18} color={t.colors.textSubtle} />
      ) : null}
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  eyebrow: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: t.colors.textSubtle,
    textTransform: "uppercase",
    marginBottom: t.space["2"],
    marginLeft: t.space["1"],
  },
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    overflow: "hidden",
    ...t.shadows.s1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
    marginLeft: DIVIDER_INSET,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: ROW_GAP,
    minHeight: SETTINGS_ROW_MIN_HEIGHT,
    paddingVertical: 12,
    paddingHorizontal: ROW_PAD_H,
  },
  rowPressed: {
    backgroundColor: t.colors.bgAlt,
  },
  rowDisabled: {
    opacity: 0.6,
  },
  toggleTextCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: ROW_GAP,
    minHeight: SETTINGS_ROW_MIN_HEIGHT - 24,
    marginRight: t.space["3"],
  },
  iconTile: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: t.radius.md,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  iconTileDestructive: {
    backgroundColor: t.colors.dangerWash,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14.5,
    color: t.colors.text,
  },
  labelDestructive: {
    color: t.colors.dangerInk,
  },
  sub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textSubtle,
    marginTop: 1,
  },
  value: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    color: t.colors.textSubtle,
    flexShrink: 0,
    maxWidth: 140,
  },
}))
