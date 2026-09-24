import React, { useCallback } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { ReportCategory, ReportStatus } from "@civfix/shared"
import { makeThemedStyles, useTheme, categoryColor, focusRingProps, webHover, webTransition } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { StatusBadge, MetaDot, FramedImage } from "../primitives"
import { useNavStore } from "../nav"
import { useT } from "../i18n"
import { SEARCH_RESULT_CARD_LAYOUT } from "./searchResultsModel"

export interface ReportRowViewProps {
  id: string
  category: ReportCategory
  status: ReportStatus
  title: string
  lat: number
  lng: number
  thumbUrl?: string | null
  subtitle?: string | null
  when?: string | null
  note?: string | null
  divider?: boolean
  card?: boolean
  onPress?: () => void
}

function ReportPinDot({ category }: { category: ReportCategory }) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <View style={[styles.pin, { backgroundColor: categoryColor(category, th.scheme) }]}>
      <Icon icon={iconMap.MapPin} size={18} color={th.colors.onAccent} />
    </View>
  )
}

export const ReportRowView = React.memo(function ReportRowView({
  id,
  category,
  status,
  title,
  lat,
  lng,
  thumbUrl,
  subtitle,
  when,
  note,
  divider = true,
  card = false,
  onPress,
}: ReportRowViewProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-row")
  const pushDetail = useCallback(() => {
    useNavStore.getState().push({ kind: "pin", id, lat, lng })
  }, [id, lat, lng])

  return (
    <Pressable
      onPress={onPress ?? pushDetail}
      accessibilityRole="button"
      accessibilityLabel={t("a11y.row", { title, status: t(`enums:status.${status}`) })}
      {...focusRingProps}
      style={(state) => [
        styles.row,
        card ? styles.rowCard : divider ? styles.rowDivider : null,
        webTransition,
        webHover(state) ? (card ? styles.rowCardHovered : styles.rowHovered) : null,
        state.pressed ? (card ? styles.rowCardPressed : styles.rowPressed) : null,
      ]}
    >
      {thumbUrl ? (
        <FramedImage
          source={{ uri: thumbUrl }}
          style={styles.thumb}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <ReportPinDot category={category} />
      )}
      <View style={styles.meta}>
        <View style={styles.row1}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <StatusBadge status={status} />
        </View>
        {subtitle ? (
          <Text style={styles.addr} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {when ? (
          <View style={styles.foot}>
            <Text style={styles.when}>{when}</Text>
            {note ? (
              <>
                <MetaDot color={th.colors.textSubtle} style={styles.sepDot} />
                <Text style={styles.note} numberOfLines={1}>
                  {note}
                </Text>
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  )
})

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["3"],
    paddingVertical: t.space["3"] + 1,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  rowPressed: {
    backgroundColor: t.colors.bgAlt,
  },
  rowHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  rowCard: {
    paddingHorizontal: t.space["3"],
    borderRadius: SEARCH_RESULT_CARD_LAYOUT.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    ...t.shadows.s1,
  },
  rowCardPressed: {
    opacity: 0.65,
  },
  rowCardHovered: {
    backgroundColor: t.colors.surfaceTint,
    borderColor: t.colors.borderStrong,
  },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: t.radius.sm,
    flexShrink: 0,
    backgroundColor: t.colors.bgAlt,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  row1: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["2"],
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14.5,
    color: t.colors.text,
  },
  addr: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
    marginTop: 3,
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  when: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },
  sepDot: {
    marginHorizontal: 0,
  },
  note: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },
}))
