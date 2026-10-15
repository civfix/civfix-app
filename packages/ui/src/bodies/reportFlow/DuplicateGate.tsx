import React from "react"
import { Pressable, View } from "react-native"
import { focusRingProps, makeThemedStyles, useTheme, type LayoutMode } from "../../theme"
import { Icon, Text, iconMap } from "../../typography"
import { KeyboardPinnedFooter } from "../../primitives"
import { useScrollHost } from "../../shell/ScrollHost"
import { useT } from "../../i18n"
import { ReportRowView } from "../ReportRow"
import type { NearbyReportRow } from "../linkReportsModel"
import { duplicateDistance } from "./duplicateModel"
import { useFlowStyles } from "./flowStyles"
import { useWizardFooterStyles } from "./FooterButtonContent"

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

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <Text variant="title" style={styles.title} accessibilityRole="header">
            {t("wizard.duplicate.title")}
          </Text>
          <Text style={styles.help}>{t("wizard.duplicate.help", { count: rows.length })}</Text>
        </View>
        <View>
          {rows.map(({ pin, distanceM }, i) => {
            const d = duplicateDistance(distanceM)
            const category = t(`enums:category.${pin.category}`)
            return (
              <ReportRowView
                key={pin.id}
                id={pin.id}
                category={pin.category}
                status={pin.status}
                title={pin.title?.trim() || category}
                lat={pin.lat}
                lng={pin.lng}
                thumbUrl={pin.thumbUrl}
                subtitle={category}
                when={
                  d.key === "close"
                    ? t("wizard.duplicate.distance_close")
                    : t("wizard.duplicate.distance_about", { meters: d.meters })
                }
                note={pin.confirmCount > 0 ? t("report-row:confirm_count", { count: pin.confirmCount }) : null}
                divider={i < rows.length - 1}
              />
            )
          })}
        </View>
      </ScrollView>
      <KeyboardPinnedFooter style={footerStyles.footer}>
        <Pressable
          onPress={onNew}
          accessibilityRole="button"
          accessibilityLabel={t("wizard.duplicate.new")}
          {...focusRingProps}
          style={({ pressed }) => [
            footerStyles.nextBtn,
            footerStyles.nextActive,
            th.shadows.pin,
            pressed ? flowStyles.pressed : null,
          ]}
        >
          <Text style={[footerStyles.nextText, { color: th.colors.onAccent }]}>{t("wizard.duplicate.new")}</Text>
          <View style={footerStyles.nextIcon}>
            <Icon icon={iconMap.ChevronRight} size={16} color={th.colors.onAccent} />
          </View>
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
    gap: t.space["2"],
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
}))
