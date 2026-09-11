import React from "react"
import { View, Pressable, StyleSheet } from "react-native"
import { focusRingProps, makeThemedStyles, useTheme, webCursor, webTransition } from "../theme"
import { Text } from "../typography"
import { Avatar } from "../primitives/Avatar"
import type { AuthorAsOption } from "./authorAsModel"
export { authorAsSelection } from "./authorAsModel"
export type { AuthorAsOption } from "./authorAsModel"

export interface AuthorAsChipsProps {
  organizations: readonly AuthorAsOption[]
  value: string | null
  onChange: (organizationId: string | null) => void
  label: string
  personalLabel: string
  chipA11y: (name: string) => string
  groupA11y: string
  disabled?: boolean
}

function Chip({
  label,
  logoName,
  logoSeed,
  logoUrl,
  active,
  a11yLabel,
  disabled,
  onPress,
}: {
  label: string
  logoName?: string
  logoSeed?: string
  logoUrl?: string | null
  active: boolean
  a11yLabel: string
  disabled?: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: active, disabled: !!disabled }}
      aria-checked={active}
      accessibilityLabel={a11yLabel}
      {...focusRingProps}
      style={(state) => [
        styles.chip,
        active ? styles.chipActive : null,
        webTransition,
        webCursor(!!disabled),
        state.pressed ? styles.chipPressed : null,
      ]}
    >
      {logoName ? (
        <Avatar
          name={logoName}
          seed={logoSeed ?? logoName}
          photoUrl={logoUrl ?? null}
          size={16}
          style={styles.chipLogo}
          decorative
        />
      ) : null}
      <Text numberOfLines={1} style={[styles.chipText, active ? styles.chipTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  )
}

export function AuthorAsChips({
  organizations,
  value,
  onChange,
  label,
  personalLabel,
  chipA11y,
  groupA11y,
  disabled,
}: AuthorAsChipsProps) {
  const styles = useStyles()
  const th = useTheme()
  if (organizations.length === 0) return null
  return (
    <View style={styles.wrap}>
      <Text style={styles.label} color={th.colors.textSubtle}>
        {label}
      </Text>
      <View style={styles.row} accessibilityRole="radiogroup" aria-label={groupA11y}>
        <Chip
          label={personalLabel}
          active={value === null}
          a11yLabel={chipA11y(personalLabel)}
          disabled={disabled}
          onPress={() => onChange(null)}
        />
        {organizations.map((org) => (
          <Chip
            key={org.id}
            label={org.name}
            logoName={org.name}
            logoSeed={org.id}
            logoUrl={org.logoUrl ?? null}
            active={value === org.id}
            a11yLabel={chipA11y(org.name)}
            disabled={disabled}
            onPress={() => onChange(org.id)}
          />
        ))}
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  wrap: {
    gap: 6,
  },
  label: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 30,
    maxWidth: "100%",
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  chipActive: {
    borderColor: t.colors.accent,
    backgroundColor: t.colors.sky["50"],
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipLogo: {
    borderRadius: t.radius.xs,
  },
  chipText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  chipTextActive: {
    color: t.colors.accentText,
  },
}))
