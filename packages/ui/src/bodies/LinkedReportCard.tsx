import React from "react"
import { View, Pressable, Image, StyleSheet } from "react-native"
import {
  type ReportCategory,
  type ReportType,
  type ReportStatus,
} from "@civfix/shared"
import { makeThemedStyles, useTheme, categoryColor, wash, focusRingProps, webCursor, webHover, webTransition } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { CategoryChip, StatusBadge, FramedImage } from "../primitives"
import { useT } from "../i18n"
import { linkedReportHeadline, type LinkedReportHeadline } from "./linkedReportHeadline"

export interface LinkedReportCardData {
  id: string
  category: ReportCategory
  type?: ReportType | null
  title?: string | null
  description?: string | null
  status: ReportStatus | null
  thumbUrl?: string | null
  addr?: string | null
  referenceCode?: string | null
}

export function LinkedReportCard({
  report,
  onPress,
  layout = "strip",
  selectable = false,
  selected = false,
  disabled = false,
  onRemove,
  badge = null,
  headline = "reference",
  subtitle,
  code,
  a11yLabel,
}: {
  report: LinkedReportCardData
  onPress?: () => void
  layout?: "strip" | "list"
  headline?: LinkedReportHeadline
  selectable?: boolean
  selected?: boolean
  disabled?: boolean
  onRemove?: () => void
  badge?: "plus" | "check" | null
  subtitle?: string | null
  code?: string | null
  a11yLabel?: string
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-linked")
  const cat = categoryColor(report.category, th.scheme)
  const categoryLabel = t(`enums:category.${report.category}`)
  const title = report.title?.trim() || categoryLabel
  const typeLabel = report.type
    ? t(`enums:reportType.${report.type}`)
    : categoryLabel
  const listTitle = linkedReportHeadline(report, headline, typeLabel, categoryLabel)
  const listSubtitle =
    subtitle?.trim() || report.addr?.trim() || report.description?.trim() || categoryLabel
  const isList = layout === "list"
  const interactive = !!onPress && !disabled

  const card = (
    <Pressable
      onPress={onPress}
      disabled={!interactive}
      accessibilityRole={selectable ? "checkbox" : "button"}
      accessibilityState={
        selectable ? { checked: selected, disabled } : disabled ? { disabled } : undefined
      }
      accessibilityLabel={a11yLabel ?? t("card.a11yLabel", { title, category: categoryLabel })}
      {...focusRingProps}
      style={(state) => [
        styles.card,
        isList ? styles.cardList : styles.cardStrip,
        webTransition,
        webCursor(!interactive),
        selectable && selected ? styles.cardSelected : null,
        webHover(state) && interactive
          ? selectable && selected
            ? styles.hoveredSelected
            : styles.hovered
          : null,
        state.pressed && interactive ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      {report.thumbUrl ? (
        isList ? (
          <FramedImage
            source={{ uri: report.thumbUrl }}
            style={styles.thumbListImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumb, styles.thumbFramed]}>
            <Image
              source={{ uri: report.thumbUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          </View>
        )
      ) : (
        <View
          style={[
            isList ? styles.thumbList : styles.thumb,
            styles.thumbPlaceholder,
            { backgroundColor: wash(cat, 0.84, th) },
          ]}
        >
          <CategoryChip category={report.category} size={isList ? 26 : 34} />
        </View>
      )}
      <View style={[styles.body, isList ? styles.bodyList : null]}>
        {isList ? (
          <>
            <Text variant="bodyStrong" numberOfLines={1} style={styles.title}>
              {listTitle}
            </Text>
            <Text
              variant="caption"
              color={th.colors.textSubtle}
              numberOfLines={2}
              ellipsizeMode="tail"
              style={styles.catLabel}
            >
              {listSubtitle}
            </Text>
            {code ? (
              <Text variant="mono" color={th.colors.textSubtle} numberOfLines={1} style={styles.code}>
                {code}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <Text variant="bodyStrong" numberOfLines={2} style={styles.title}>
              {title}
            </Text>
            <Text
              variant="caption"
              color={th.colors.textSubtle}
              numberOfLines={1}
              style={styles.catLabel}
            >
              {typeLabel}
            </Text>
          </>
        )}
        {report.status ? (
          <View style={styles.statusRow}>
            <StatusBadge status={report.status} />
          </View>
        ) : null}
      </View>

      {badge ? (
        <View style={[styles.badge, { backgroundColor: cat }]} pointerEvents="none">
          <Icon
            icon={badge === "plus" ? iconMap.Plus : iconMap.Check}
            size={13}
            color={th.colors.onAccent}
          />
        </View>
      ) : null}

      {selectable ? (
        <View style={[styles.check, isList ? styles.checkList : styles.checkStrip, selected ? styles.checkOn : null]}>
          {selected ? <Icon icon={iconMap.Check} size={14} color={th.colors.onAccent} /> : null}
        </View>
      ) : null}
    </Pressable>
  )

  if (onRemove) {
    return (
      <View style={isList ? styles.removeWrapList : styles.removeWrap}>
        {card}
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={t("card.removeA11yLabel", { title })}
          {...focusRingProps}
          style={({ pressed }) => [styles.removeBtn, webCursor(), pressed ? styles.pressed : null]}
        >
          <View style={styles.removeVisual}>
            <Icon icon={iconMap.Close} size={13} color={th.colors.neutral.card} />
          </View>
        </Pressable>
      </View>
    )
  }

  return card
}

const useStyles = makeThemedStyles((t) => ({
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    overflow: "hidden",
    ...t.shadows.s1,
  },
  cardStrip: {
    width: 212,
  },
  cardList: {
    width: "100%",
    flexDirection: "row",
    alignItems: "stretch",
  },
  cardSelected: {
    borderWidth: 1.5,
    borderColor: t.colors.brand.bloom,
    backgroundColor: t.colors.bloom["50"],
  },
  pressed: {
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.55,
  },
  hovered: {
    backgroundColor: t.colors.surfaceTint,
    borderColor: t.colors.borderStrong,
  },
  hoveredSelected: {
    backgroundColor: t.colors.bloom["100"],
  },
  thumb: {
    width: "100%",
    height: 96,
    overflow: "hidden",
    backgroundColor: t.colors.bgAlt,
  },
  thumbFramed: t.imageFrame,
  thumbList: {
    width: 64,
    alignSelf: "stretch",
    minHeight: 64,
    flexShrink: 0,
    overflow: "hidden",
    backgroundColor: t.colors.bgAlt,
  },
  thumbListImage: {
    width: 64,
    alignSelf: "stretch",
    minHeight: 64,
    flexShrink: 0,
    backgroundColor: t.colors.bgAlt,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    padding: t.space["3"],
    gap: 4,
  },
  bodyList: {
    flex: 1,
    minWidth: 0,
    paddingVertical: t.space["2"] + 2,
  },
  title: {
    fontSize: 13.5,
    lineHeight: 17,
    color: t.colors.text,
  },
  catLabel: {
    fontFamily: t.fontFamily.bodyRegular,
  },
  code: {
    fontSize: t.fontSize["12"],
  },
  statusRow: {
    marginTop: 2,
    flexDirection: "row",
  },

  badge: {
    position: "absolute",
    top: t.space["2"],
    right: t.space["2"],
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: t.colors.surface,
    ...t.shadows.s1,
  },

  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surface,
  },
  checkStrip: {
    position: "absolute",
    top: t.space["2"],
    right: t.space["2"],
  },
  checkList: {
    alignSelf: "center",
    marginRight: t.space["3"],
  },
  checkOn: {
    backgroundColor: t.colors.brand.bloom,
    borderColor: t.colors.brand.bloom,
  },

  removeWrap: {
    position: "relative",
  },
  removeWrapList: {
    position: "relative",
    width: "100%",
  },
  removeBtn: {
    position: "absolute",
    top: -16,
    right: -16,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  removeVisual: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.text,
    borderWidth: 2,
    borderColor: t.colors.surface,
    ...t.shadows.s1,
  },
}))
