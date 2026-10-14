import React, { useCallback, useEffect, useState } from "react"
import { View, StyleSheet } from "react-native"
import {
  APPEARANCE_PREFERENCES,
  makeThemedStyles,
  setAppearancePreference,
  useAppearancePreference,
  type AppearancePreference,
} from "../theme"
import { useHaptics } from "../capabilities"
import { RadioOptionRow } from "../primitives/RadioOptionRow"
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
  const onPress = useCallback(() => onSelect(code), [onSelect, code])
  return (
    <RadioOptionRow
      layout="flush"
      label={label}
      sub={sub}
      selected={selected}
      pending={pending}
      onPress={onPress}
    />
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
  },
}))
