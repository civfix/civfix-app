import React, { useCallback } from "react"
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
import { ReportRowView } from "../ReportRow"
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

function ClosestMatch({ row, mode }: { row: NearbyReportRow; mode: LayoutMode }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
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
        styles.hero,
        th.shadows.s1,
        webTransition,
        webHover(state) ? styles.heroHovered : null,
        state.pressed ? styles.heroPressed : null,
      ]}
    >
      <View
        style={[
          styles.heroMedia,
          mode === "expanded" ? styles.heroMediaExpanded : null,
          { backgroundColor: wash(cat, 0.84, th) },
        ]}
      >
        {pin.thumbUrl ? (
          <Image source={{ uri: pin.thumbUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Icon icon={CATEGORY_ICONS[pin.category]} size={40} color={cat} />
        )}
      </View>
      <View style={styles.heroBody}>
        <Text style={styles.eyebrow}>{t("wizard.duplicate.nearest")}</Text>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {text.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.heroMeta}>{text.category}</Text>
          <MetaDot color={th.colors.textSubtle} />
          <Text style={styles.heroMeta} numberOfLines={1}>
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
  mode,
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
  const rowText = useRowText()
  const [closest, ...rest] = rows

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <Text variant="title" style={styles.title} accessibilityRole="header">
            {t("wizard.duplicate.title")}
          </Text>
          <Text style={styles.help}>{t("wizard.duplicate.help", { count: rows.length })}</Text>
        </View>
        {closest ? <ClosestMatch row={closest} mode={mode} /> : null}
        {rest.length > 0 ? (
          <View>
            <Text style={styles.section} accessibilityRole="header">
              {t("wizard.duplicate.also_nearby")}
            </Text>
            {rest.map((row, i) => {
              const text = rowText(row)
              return (
                <ReportRowView
                  key={row.pin.id}
                  id={row.pin.id}
                  category={row.pin.category}
                  status={row.pin.status}
                  title={text.title}
                  lat={row.pin.lat}
                  lng={row.pin.lng}
                  thumbUrl={row.pin.thumbUrl}
                  subtitle={text.category}
                  when={text.distance}
                  note={text.count}
                  divider={i < rest.length - 1}
                  showStatus={false}
                />
              )
            })}
          </View>
        ) : null}
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
  hero: {
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    overflow: "hidden",
  },
  heroHovered: { borderColor: t.colors.borderStrong },
  heroPressed: { opacity: 0.85 },
  heroMedia: {
    aspectRatio: 16 / 9,
    alignItems: "center",
    justifyContent: "center",
  },
  heroMediaExpanded: { aspectRatio: 2 },
  heroBody: {
    padding: t.space["3"],
    gap: t.space["1"],
  },
  eyebrow: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["12"],
    color: t.colors.accentText,
  },
  heroTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: t.space["1"] },
  heroMeta: {
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
  section: {
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
