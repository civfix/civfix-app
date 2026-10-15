import React from "react"
import { Image, Pressable, StyleSheet, View } from "react-native"
import { categoryColor, focusRingProps, makeThemedStyles, useTheme, wash, webHover, webTransition } from "../../theme"
import { Icon, Text, iconMap } from "../../typography"
import { CATEGORY_ICONS, MetaDot } from "../../primitives"
import { useT } from "../../i18n"
import type { NearbyReportRow } from "../linkReportsModel"
import { duplicateDistance } from "./duplicateModel"

// A banner, not a gallery frame: a second card has to start above the fold on a phone.
const CARD_MEDIA_ASPECT = 2.4

function useMatchText({ pin, distanceM }: NearbyReportRow) {
  const { t } = useT("report-wizard")
  const d = duplicateDistance(distanceM)
  const category = t(`enums:category.${pin.category}`)
  return {
    category,
    title: pin.title?.trim() || category,
    distance:
      d.key === "close"
        ? t("wizard.duplicate.distance_close")
        : t("wizard.duplicate.distance_about", { meters: d.meters }),
    count: pin.confirmCount > 0 ? t("report-row:confirm_count", { count: pin.confirmCount }) : null,
  }
}

/** One match on the Possible duplicate screen. Me too (#162) goes at the right of the body, beside the text. */
export function DuplicateMatchCard({
  row,
  width,
  onOpen,
}: {
  row: NearbyReportRow
  width: number | undefined
  onOpen: (row: NearbyReportRow) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const text = useMatchText(row)
  const { pin } = row
  const cat = categoryColor(pin.category, th.scheme)
  return (
    <Pressable
      onPress={() => onOpen(row)}
      accessibilityRole="button"
      accessibilityLabel={text.title}
      {...focusRingProps}
      style={(state) => [
        styles.card,
        width !== undefined ? { width } : null,
        th.shadows.s1,
        webTransition,
        webHover(state) ? styles.cardHovered : null,
        state.pressed ? styles.cardPressed : null,
      ]}
    >
      <View style={[styles.cardMedia, { backgroundColor: wash(cat, 0.84, th) }]}>
        {pin.thumbUrl ? (
          <Image source={{ uri: pin.thumbUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Icon icon={CATEGORY_ICONS[pin.category]} size={40} color={cat} />
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {text.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.cardMeta}>{text.category}</Text>
          <MetaDot color={th.colors.textSubtle} />
          <Text style={styles.cardMeta} numberOfLines={1}>
            {text.distance}
          </Text>
        </View>
        {text.count ? (
          <View style={styles.countRow}>
            <Icon icon={iconMap.Users} size={14} color={th.colors.textMuted} />
            <Text style={styles.count} numberOfLines={1}>
              {text.count}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  card: {
    width: "100%",
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    overflow: "hidden",
  },
  cardHovered: { borderColor: t.colors.borderStrong },
  cardPressed: { opacity: 0.85 },
  cardMedia: {
    aspectRatio: CARD_MEDIA_ASPECT,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    padding: t.space["3"],
    gap: t.space["1"],
  },
  cardTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: t.space["1"] },
  cardMeta: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  countRow: { flexDirection: "row", alignItems: "center", gap: t.space["1"] },
  count: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
}))
