import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type { ReportPinDTO } from "@civfix/contract"
import { categoryColor, focusRingProps, makeThemedStyles, useTheme, webHover, webTransition } from "../../theme"
import { Icon, Text, iconMap } from "../../typography"
import { FramedImage } from "../../primitives"
import { useNavStore } from "../../nav"
import { useT } from "../../i18n"
import { SEARCH_RESULT_CARD_LAYOUT } from "./searchResultsModel"

function PressingRow({ report, last }: { report: ReportPinDTO; last: boolean }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("home-sidebar")
  const category = t(`enums:category.${report.category}`)
  const title = report.title?.trim() || category
  const thumbUrl = report.thumbUrl?.trim() || null
  const count = t("report-row:confirm_count", { count: report.confirmCount })
  return (
    <Pressable
      onPress={() => useNavStore.getState().push({ kind: "pin", id: report.id, lat: report.lat, lng: report.lng })}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${category}, ${count}`}
      {...focusRingProps}
      style={(state) => [
        styles.row,
        last ? null : styles.rowDivider,
        webTransition,
        webHover(state) ? styles.rowHovered : null,
        state.pressed ? styles.rowPressed : null,
      ]}
    >
      {thumbUrl ? (
        <FramedImage source={{ uri: thumbUrl }} style={styles.thumb} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.thumb, styles.pin, { backgroundColor: categoryColor(report.category, th.scheme) }]}>
          <Icon icon={iconMap.MapPin} size={18} color={th.colors.onAccent} />
        </View>
      )}
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.category} numberOfLines={1}>
            {category}
          </Text>
          <Icon icon={iconMap.Users} size={13} color={th.colors.accentText} />
          <Text style={styles.count} numberOfLines={1}>
            {count}
          </Text>
        </View>
      </View>
      <Icon icon={iconMap.ChevronRight} size={16} color={th.colors.textSubtle} />
    </Pressable>
  )
}

/** "Most pressing nearby" as one grouped card of compact rows, so ten reports stay a short block. */
export function PressingList({ reports }: { reports: readonly ReportPinDTO[] }) {
  const styles = useStyles()
  return (
    <View style={styles.group}>
      {reports.map((report, i) => (
        <PressingRow key={report.id} report={report} last={i === reports.length - 1} />
      ))}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  group: {
    borderRadius: SEARCH_RESULT_CARD_LAYOUT.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    overflow: "hidden",
    ...t.shadows.s1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"] + 2,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
  rowHovered: { backgroundColor: t.colors.surfaceTint },
  rowPressed: { backgroundColor: t.colors.bgAlt },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: t.radius.sm,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  pin: { borderRadius: 18 },
  copy: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14.5,
    color: t.colors.text,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: t.space["1"], marginTop: 2 },
  category: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
    marginRight: t.space["1"],
  },
  count: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.accentText,
  },
}))
