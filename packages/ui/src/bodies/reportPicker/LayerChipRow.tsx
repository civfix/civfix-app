import React from "react"
import { Pressable, ScrollView, View } from "react-native"
import type { ReportCategory } from "@civfix/shared"
import {
  PRESSED_OPACITY_SUBTLE,
  categoryColor,
  focusRingProps,
  makeThemedStyles,
  useTheme,
  wash,
  webCursorPointer,
  webHover,
  webTransition,
} from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { FILTER_CHIP_HEIGHT, FILTER_CHIP_MIN_TOUCH_TARGET } from "../../primitives"
import { CATEGORY_ICONS } from "../../primitives/categoryIcons"
import { useT } from "../../i18n"
import { PICKER_CATEGORIES } from "./reportPickerFilterStore"

const CHIP_HIT_SLOP = (FILTER_CHIP_MIN_TOUCH_TARGET - FILTER_CHIP_HEIGHT) / 2

export interface LayerChipRowProps {
  enabled: ReadonlySet<ReportCategory>
  counts: Partial<Record<ReportCategory, number>>
  nearbyOnly: boolean
  onToggle: (category: ReportCategory) => void
  onAll: () => void
  onClear: () => void
  onNearbyOnly: (on: boolean) => void
}

function LayerChip({
  category,
  selected,
  count,
  onPress,
}: {
  category: ReportCategory
  selected: boolean
  count: number
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-picker")
  const { t: tEnums } = useT("enums")
  const color = categoryColor(category, th.scheme)
  const Glyph = CATEGORY_ICONS[category]
  const label = tEnums(`category.${category}`)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={t("layer_a11y", { category: label, count })}
      hitSlop={CHIP_HIT_SLOP}
      {...focusRingProps}
      style={(state) => [
        styles.chip,
        webCursorPointer,
        webTransition,
        selected ? { backgroundColor: wash(color, 0.82, th), borderColor: color } : styles.chipOff,
        !selected && webHover(state) ? styles.chipHovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <Glyph size={14} color={selected ? color : th.colors.textSubtle} />
      <Text numberOfLines={1} style={[styles.label, selected ? styles.labelOn : null]}>
        {label}
      </Text>
      {count > 0 ? (
        <Text style={[styles.count, selected ? styles.labelOn : null]}>{count}</Text>
      ) : null}
    </Pressable>
  )
}

function PlainChip({
  label,
  a11yLabel,
  selected,
  icon,
  onPress,
}: {
  label: string
  a11yLabel: string
  selected: boolean
  icon?: keyof typeof iconMap
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={a11yLabel}
      hitSlop={CHIP_HIT_SLOP}
      {...focusRingProps}
      style={(state) => [
        styles.chip,
        webCursorPointer,
        webTransition,
        selected ? styles.plainOn : styles.chipOff,
        !selected && webHover(state) ? styles.chipHovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      {icon ? (
        <Icon icon={iconMap[icon]} size={14} color={selected ? th.colors.selectedInk : th.colors.textSubtle} />
      ) : null}
      <Text numberOfLines={1} style={[styles.label, selected ? styles.plainLabelOn : null]}>
        {label}
      </Text>
    </Pressable>
  )
}

export function LayerChipRow({
  enabled,
  counts,
  nearbyOnly,
  onToggle,
  onAll,
  onClear,
  onNearbyOnly,
}: LayerChipRowProps) {
  const styles = useStyles()
  const { t } = useT("report-picker")
  const allOn = enabled.size === PICKER_CATEGORIES.length
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      <PlainChip
        label={allOn ? t("layers_clear") : t("layers_all")}
        a11yLabel={allOn ? t("layers_clear_a11y") : t("layers_all_a11y")}
        selected={allOn}
        onPress={allOn ? onClear : onAll}
      />
      {PICKER_CATEGORIES.map((category) => (
        <LayerChip
          key={category}
          category={category}
          selected={enabled.has(category)}
          count={counts[category] ?? 0}
          onPress={() => onToggle(category)}
        />
      ))}
      <View style={styles.divider} />
      <PlainChip
        label={t("nearby_only")}
        a11yLabel={t("nearby_only_a11y")}
        selected={nearbyOnly}
        icon="Navigation"
        onPress={() => onNearbyOnly(!nearbyOnly)}
      />
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroller: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"] + 2,
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: FILTER_CHIP_HEIGHT,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  chipOff: {
    backgroundColor: t.colors.bgAlt,
  },
  chipHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  plainOn: {
    backgroundColor: t.colors.selectedFill,
    borderColor: t.colors.selectedFill,
  },
  pressed: {
    opacity: PRESSED_OPACITY_SUBTLE,
  },
  label: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  labelOn: {
    color: t.colors.text,
  },
  plainLabelOn: {
    color: t.colors.selectedInk,
  },
  count: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  divider: {
    width: 1,
    height: FILTER_CHIP_HEIGHT - t.space["3"],
    backgroundColor: t.colors.border,
    marginHorizontal: t.space["1"],
  },
}))
