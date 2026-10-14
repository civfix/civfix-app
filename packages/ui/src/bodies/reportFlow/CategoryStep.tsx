import React from "react"
import { View, Pressable, StyleSheet } from "react-native"
import { makeThemedStyles, useTheme, categoryColor, wash, focusRingProps } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { PinSvg, glyphForCategory } from "../../map"
import { REPORT_TYPES, type ReportTypeOption } from "../../report/reportTypes"
import { useDraftReportStore } from "../../report/draftStore"
import { useT } from "../../i18n"
import { useFlowStyles } from "./flowStyles"

const SELECTED_WASH = 0.92

// The "other" glyph circle stands in for a category pin, so both share one footprint.
const TYPE_MARK_SIZE = 30

function ReportTypeRow({ type, selected, onPress }: { type: ReportTypeOption; selected: boolean; onPress: () => void }) {
  const styles = useStyles()
  const flowStyles = useFlowStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
  const color = categoryColor(type.category, th.scheme)
  const label = t(`enums:reportType.${type.id}`)
  const sub = t(`types.${type.id}.sub`)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={t("types.row_a11y", { label, sub })}
      {...focusRingProps}
      style={({ pressed }) => [
        styles.typeRow,
        selected ? { borderColor: color, backgroundColor: wash(color, SELECTED_WASH, th) } : null,
        pressed ? flowStyles.pressed : null,
      ]}
    >
      {type.glyph ? (
        <View style={styles.glyphCircle}>
          <Icon icon={iconMap.Plus} size={18} color={th.colors.textMuted} />
        </View>
      ) : (
        <PinSvg fill={color} glyph={glyphForCategory(type.category)} size={TYPE_MARK_SIZE} />
      )}
      <View style={styles.typeMeta}>
        <Text style={styles.typeTitle}>{label}</Text>
        <Text style={styles.typeSub}>{sub}</Text>
      </View>
      <View style={[styles.check, selected ? { backgroundColor: color, borderColor: color } : null]}>
        {selected ? <Icon icon={iconMap.Check} size={15} color={th.colors.onAccent} /> : null}
      </View>
    </Pressable>
  )
}

export function CategoryStep() {
  const styles = useStyles()
  const flowStyles = useFlowStyles()
  const { t } = useT("report-wizard")
  const reportTypeId = useDraftReportStore((s) => s.draft.reportTypeId)
  const setCategory = useDraftReportStore((s) => s.setCategory)
  return (
    <View style={flowStyles.stepBlock}>
      <View style={styles.typeList} accessibilityRole="radiogroup" accessibilityLabel={t("wizard.category.title")}>
        {REPORT_TYPES.map((type) => (
          <ReportTypeRow
            key={type.id}
            type={type}
            selected={reportTypeId === type.id}
            onPress={() => setCategory(type.category, type.glyph ? "" : t(`enums:reportType.${type.id}`), type.id)}
          />
        ))}
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  typeList: { gap: 10 },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    width: "100%",
    padding: 14,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s1,
  },
  glyphCircle: {
    width: TYPE_MARK_SIZE,
    height: TYPE_MARK_SIZE,
    borderRadius: TYPE_MARK_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.neutral.paper2,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  typeMeta: { flex: 1, minWidth: 0 },
  typeTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  typeSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
    marginTop: 2,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
}))
