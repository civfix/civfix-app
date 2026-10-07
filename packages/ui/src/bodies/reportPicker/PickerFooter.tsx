import React, { useContext } from "react"
import { StyleSheet, View } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import { MAX_LINKED_REPORTS } from "@civfix/shared"
import { makeThemedStyles, useTheme } from "../../theme"
import { Text, TextLink } from "../../typography"
import { PrimaryButton } from "../../primitives"
import { useT } from "../../i18n"
import { footerRemovedKey, type PickerAction, type PickerMode, type SelectionDiff } from "./reportPickerModel"

export function PickerFooter({
  mode,
  expanded,
  error,
  diff,
  atLimit,
  action,
  busy,
  onClear,
  onCommit,
}: {
  mode: PickerMode
  expanded: boolean
  error: string | null
  diff: SelectionDiff
  atLimit: boolean
  action: PickerAction
  busy: boolean
  onClear: () => void
  onCommit: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const insets = useContext(SafeAreaInsetsContext)
  const { t } = useT("report-picker")
  const summary =
    diff.selected > 0 ? t("footer_selected", { count: diff.selected }) : t("footer_none")
  const removedText =
    diff.removed > 0 ? t(footerRemovedKey(mode), { count: diff.removed }) : null

  return (
    <View style={[styles.footer, { paddingBottom: (expanded ? 0 : (insets?.bottom ?? 0)) + th.space["3"] }]}>
      {error ? (
        <Text variant="caption" color={th.colors.bloom["600"]} numberOfLines={2} style={styles.footerError}>
          {error}
        </Text>
      ) : null}
      <View style={styles.footerRow}>
        <View style={styles.footerMeta}>
          <Text style={styles.footerSummary} numberOfLines={1}>
            {summary}
            {removedText ? ` · ${removedText}` : ""}
          </Text>
          {atLimit ? (
            <Text style={styles.footerLimit} numberOfLines={2}>
              {t("limit_reached", { max: MAX_LINKED_REPORTS })}
            </Text>
          ) : diff.selected > 0 ? (
            <TextLink
              variant="label"
              standalone
              accessibilityLabel={t("footer_clear_a11y")}
              onPress={onClear}
            >
              {t("footer_clear")}
            </TextLink>
          ) : null}
        </View>
        <PrimaryButton
          label={t(action.key, { count: action.count })}
          onPress={onCommit}
          loading={busy}
          disabled={!action.enabled}
        />
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  footer: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"],
    gap: t.space["2"],
    backgroundColor: t.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  footerError: {
    fontFamily: t.fontFamily.bodySemiBold,
  },
  footerMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  footerSummary: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.text,
  },
  footerLimit: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.accentText,
  },
}))
