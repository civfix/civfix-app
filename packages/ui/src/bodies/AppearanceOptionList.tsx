import React, { useCallback, useEffect, useState } from "react"
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native"
import {
  APPEARANCE_PREFERENCES,
  makeThemedStyles,
  setAppearancePreference,
  useAppearancePreference,
  useTheme,
  focusRingProps,
  type AppearancePreference,
} from "../theme"
import { useHaptics } from "../capabilities"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import {
  appearanceCommit,
  appearancePressTarget,
  appearanceRowState,
  scheduleAfterPaint,
  type AppearancePending,
} from "./appearanceSelection"

const AppearanceRow = React.memo(function AppearanceRow({
  code,
  label,
  sub,
  selected,
  pending,
  onSelect,
}: {
  code: AppearancePreference
  label: string
  sub?: string
  selected: boolean
  pending: boolean
  onSelect: (code: AppearancePreference) => void
}) {
  const styles = useStyles()
  const t = useTheme()
  const onPress = useCallback(() => onSelect(code), [onSelect, code])
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, busy: pending }}
      aria-checked={selected}
      aria-busy={pending}
      accessibilityLabel={label}
      {...focusRingProps}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      <View style={styles.rowText}>
        <View style={styles.rowLabelLine}>
          <Text
            style={[styles.rowLabel, selected ? styles.rowLabelSelected : null]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
        {sub ? (
          <Text style={styles.rowSub} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={styles.trailing}>
        {pending ? (
          <ActivityIndicator size="small" color={t.colors.brand.bloom} />
        ) : selected ? (
          <Icon icon={iconMap.Check} size={18} color={t.colors.brand.bloom} />
        ) : null}
      </View>
    </Pressable>
  )
})

export function AppearanceOptionList() {
  const styles = useStyles()
  const preference = useAppearancePreference()
  const haptics = useHaptics()
  const { t } = useT("appearance-settings")
  const [pending, setPending] = useState<AppearancePending | null>(null)

  const onSelect = useCallback(
    (code: AppearancePreference) => {
      const next = appearancePressTarget(code, pending, preference)
      if (next === pending) return
      haptics.selection()
      setPending(next)
    },
    [haptics, pending, preference],
  )

  useEffect(() => {
    const commit = appearanceCommit(pending, preference)
    if (commit.kind === "idle") return
    if (commit.kind === "clear") {
      setPending(null)
      return
    }
    return scheduleAfterPaint(() => setAppearancePreference(commit.preference))
  }, [pending, preference])

  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {APPEARANCE_PREFERENCES.map((code, index) => {
        const row = appearanceRowState(code, pending, preference)
        return (
          <React.Fragment key={code}>
            {index === 0 ? null : <View style={styles.divider} />}
            <AppearanceRow
              code={code}
              label={t(`option.${code}`)}
              sub={code === "system" ? t("option.system_sub") : undefined}
              selected={row.selected}
              pending={row.pending}
              onSelect={onSelect}
            />
          </React.Fragment>
        )
      })}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  list: {
    alignSelf: "stretch",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: t.space["1"],
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowText: {
    flex: 1,
  },
  rowLabelLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  rowLabel: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
    flexShrink: 1,
  },
  rowLabelSelected: {
    fontFamily: t.fontFamily.bodyBold,
  },
  rowSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
    marginTop: 2,
  },
  trailing: {
    width: 24,
    height: 24,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
  },
}))
