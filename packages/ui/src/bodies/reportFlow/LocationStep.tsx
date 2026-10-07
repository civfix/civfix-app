import React from "react"
import { View, Pressable } from "react-native"
import { type LatLng } from "@civfix/shared/geocode"
import { makeThemedStyles, useTheme, focusRingProps, MIN_TOUCH_TARGET } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { useReverseLabel, reverseLabelText } from "../../data"
import { useDraftReportStore } from "../../report/draftStore"
import { useT } from "../../i18n"
import { useFlowStyles } from "./flowStyles"

export function CompactLocationField({
  point,
  onOpenPicker,
  onClear,
}: {
  point: LatLng | null
  onOpenPicker: () => void
  onClear?: () => void
}) {
  const styles = useStyles()
  const flowStyles = useFlowStyles()
  const th = useTheme()
  const { t } = useT("map-ui")
  const label = useReverseLabel(point)
  const display = point ? reverseLabelText(label.data, point) : null

  return (
    <View style={styles.compactLoc}>
      <Pressable
        onPress={onOpenPicker}
        accessibilityRole="button"
        accessibilityLabel={t("pickStep.openA11y")}
        {...focusRingProps}
        style={({ pressed }) => [styles.compactLocBtn, pressed ? flowStyles.pressed : null]}
      >
        <Icon icon={iconMap.MapPin} size={18} color={th.colors.brand.bloom} />
        <View style={styles.compactLocMeta}>
          {display ? (
            <Text style={styles.compactLocValue} numberOfLines={2}>
              {display}
            </Text>
          ) : (
            <Text style={styles.compactLocPlaceholder} numberOfLines={1}>
              {t("pickStep.open")}
            </Text>
          )}
        </View>
        <Icon icon={point ? iconMap.ChevronRight : iconMap.Plus} size={16} color={th.colors.textMuted} />
      </Pressable>
      {point && onClear ? (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={t("actions.reset")}
          hitSlop={6}
          {...focusRingProps}
          style={({ pressed }) => [styles.compactLocClear, pressed ? flowStyles.pressed : null]}
        >
          <Icon icon={iconMap.Close} size={13} color={th.colors.textMuted} />
          <Text style={styles.compactLocClearText}>{t("actions.reset")}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export function LocationStep({ onOpenPicker }: { onOpenPicker: () => void }) {
  const flowStyles = useFlowStyles()
  const draft = useDraftReportStore((s) => s.draft)
  const point = draft.lat != null && draft.lng != null ? { lat: draft.lat, lng: draft.lng } : null
  const clearLocation = useDraftReportStore((s) => s.clearLocation)

  return (
    <View style={flowStyles.stepBlock}>
      <CompactLocationField point={point} onOpenPicker={onOpenPicker} onClear={clearLocation} />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  compactLoc: {
    gap: t.space["2"],
  },
  compactLocBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    minHeight: 52,
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["3"],
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  compactLocMeta: {
    flex: 1,
    minWidth: 0,
  },
  compactLocValue: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  compactLocPlaceholder: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    color: t.colors.textSubtle,
  },
  compactLocClear: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: t.space["1"],
    paddingHorizontal: 6,
  },
  compactLocClearText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
  },
}))
