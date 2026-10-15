import React, { useCallback, useState } from "react"
import { Image, Pressable, StyleSheet, View } from "react-native"
import {
  categoryColor,
  focusRingProps,
  makeThemedStyles,
  useTheme,
  wash,
  webHover,
  webTransition,
  type LayoutMode,
} from "../../theme"
import { Icon, Text, iconMap } from "../../typography"
import { CATEGORY_ICONS, KeyboardPinnedFooter, MetaDot } from "../../primitives"
import { useNavStore } from "../../nav"
import { useScrollHost } from "../../shell/ScrollHost"
import { useT } from "../../i18n"
import type { NearbyReportRow } from "../linkReportsModel"
import { duplicateDistance } from "./duplicateModel"
import { useFlowStyles } from "./flowStyles"
import { useWizardFooterStyles } from "./FooterButtonContent"

function useRowText() {
  const { t } = useT("report-wizard")
  return useCallback(
    ({ pin, distanceM }: NearbyReportRow) => {
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
    },
    [t],
  )
}

// A banner, not a gallery frame: a second card has to start above the fold on a phone.
const CARD_MEDIA_ASPECT = 2.4
// Below this a list row is too narrow for two cards side by side (two phone-width cards plus the gap).
const TWO_COLUMNS_FROM = 640

function MatchCard({ row, width }: { row: NearbyReportRow; width: number | undefined }) {
  const styles = useStyles()
  const th = useTheme()
  const text = useRowText()(row)
  const { pin } = row
  const cat = categoryColor(pin.category, th.scheme)
  const open = () => useNavStore.getState().push({ kind: "pin", id: pin.id, lat: pin.lat, lng: pin.lng })
  return (
    <Pressable
      onPress={open}
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
      {/* Me too (#162) goes at the right of this body, beside the text column. */}
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

export function DuplicateGate({
  rows,
  onNew,
}: {
  rows: NearbyReportRow[]
  mode: LayoutMode
  onNew: () => void
}) {
  const styles = useStyles()
  const flowStyles = useFlowStyles()
  const footerStyles = useWizardFooterStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
  const { ScrollView } = useScrollHost()
  const [listWidth, setListWidth] = useState(0)
  const cardWidth =
    listWidth >= TWO_COLUMNS_FROM ? (listWidth - th.space["3"]) / 2 : undefined

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <Text variant="title" style={styles.title} accessibilityRole="header">
            {t("wizard.duplicate.title")}
          </Text>
          <Text style={styles.help}>{t("wizard.duplicate.help", { count: rows.length })}</Text>
        </View>
        <View style={styles.list} onLayout={(e) => setListWidth(e.nativeEvent.layout.width)}>
          {rows.map((row) => (
            <MatchCard key={row.pin.id} row={row} width={cardWidth} />
          ))}
        </View>
      </ScrollView>
      <KeyboardPinnedFooter style={footerStyles.footer}>
        <Pressable
          onPress={onNew}
          accessibilityRole="button"
          accessibilityLabel={t("wizard.duplicate.new")}
          {...focusRingProps}
          style={({ pressed }) => [footerStyles.nextBtn, styles.newBtn, pressed ? flowStyles.pressed : null]}
        >
          <Icon icon={iconMap.Plus} size={16} color={th.colors.text} />
          <Text style={[footerStyles.nextText, styles.newText]}>{t("wizard.duplicate.new")}</Text>
        </Pressable>
      </KeyboardPinnedFooter>
    </>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["8"],
    gap: t.space["4"],
  },
  head: { gap: t.space["1"], paddingTop: t.space["2"] },
  title: {
    fontFamily: t.fontFamily.bodyExtraBold,
    lineHeight: t.fontSize["20"] * t.lineHeight.snug,
  },
  help: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    lineHeight: 18,
    color: t.colors.textMuted,
  },
  list: { flexDirection: "row", flexWrap: "wrap", gap: t.space["3"] },
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
  countRow: { flexDirection: "row", alignItems: "center", gap: t.space["1"], marginTop: 2 },
  count: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  newBtn: {
    gap: t.space["2"],
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  newText: { color: t.colors.text },
}))
