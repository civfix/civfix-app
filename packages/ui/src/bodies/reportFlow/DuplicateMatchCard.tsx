import React, { useState } from "react"
import { Image, Pressable, StyleSheet, View } from "react-native"
import { categoryColor, focusRingProps, makeThemedStyles, useTheme, wash, webTransition } from "../../theme"
import { Icon, Text } from "../../typography"
import { CATEGORY_ICONS, MetaDot } from "../../primitives"
import { useT } from "../../i18n"
import type { NearbyReportRow } from "../linkReportsModel"
import { duplicateDistance } from "./duplicateModel"
import { MeTooChip, MeTooRow } from "../reportDetail/MeTooButton"

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

/** One match on the Possible duplicate screen; Me too and the count share a footer under the text. */
export function DuplicateMatchCard({
  row,
  width,
  onOpen,
  onMeToo,
  meTooBusy = false,
  meTooDisabled = false,
}: {
  row: NearbyReportRow
  width: number | undefined
  onOpen: (row: NearbyReportRow) => void
  /** Absent for a guest, who gets no Me too. */
  onMeToo?: (row: NearbyReportRow) => void
  meTooBusy?: boolean
  meTooDisabled?: boolean
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
  const text = useMatchText(row)
  const { pin } = row
  const cat = categoryColor(pin.category, th.scheme)
  // Me too is a sibling of the open target, never inside it: react-native-web renders Pressable as a
  // `<button>`, and a nested button is invalid DOM. The card chrome lives on the wrapper so hover still
  // outlines the whole card.
  const [hovered, setHovered] = useState(false)
  return (
    <View
      style={[
        styles.card,
        width !== undefined ? { width } : null,
        th.shadows.s1,
        webTransition,
        hovered ? styles.cardHovered : null,
      ]}
    >
      <Pressable
        onPress={() => onOpen(row)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="button"
        {...focusRingProps}
        style={(state) => [styles.open, state.pressed ? styles.cardPressed : null]}
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
        </View>
      </Pressable>
      {onMeToo || text.count ? (
        <View style={styles.footer}>
          <MeTooRow
            chip={
              onMeToo ? (
                <MeTooChip
                  label={t("wizard.duplicate.me_too")}
                  accessibilityLabel={t("wizard.duplicate.me_too_a11y")}
                  pressed={false}
                  busy={meTooBusy}
                  disabled={meTooDisabled}
                  onPress={() => onMeToo(row)}
                />
              ) : null
            }
            count={text.count}
          />
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  card: {
    width: "100%",
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  open: { borderRadius: t.radius.lg },
  cardHovered: { borderColor: t.colors.borderStrong },
  cardPressed: { opacity: 0.85 },
  cardMedia: {
    aspectRatio: CARD_MEDIA_ASPECT,
    borderTopLeftRadius: t.radius.lg,
    borderTopRightRadius: t.radius.lg,
    overflow: "hidden",
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
  footer: {
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
}))
