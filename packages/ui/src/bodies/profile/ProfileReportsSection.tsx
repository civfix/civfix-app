/**
 * The "Your reports" section of the own profile: the three most recent reports plus a "See all" row.
 * Extracted from ProfileView (which also rendered every string here in raw English).
 */
import React from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { ReportDTO } from "@civfix/shared"
import { categoryColor, makeThemedStyles, useTheme, focusRingProps } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { StatusBadge } from "../../primitives"
import { useT } from "../../i18n"
import { SectionEyebrow } from "./SectionHeadings"
import { useSectionStyles } from "./sectionStyles"

/** What ProfileView's host feeds the reports section. */
export interface ProfileReports {
  items: ReportDTO[]
  isLoading: boolean
  isError: boolean
  onOpen: (report: ReportDTO) => void
  onSeeAll: () => void
}

function ProfileReportRow({ report, onPress }: { report: ReportDTO; onPress: () => void }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("profile-view")
  const title = report.title?.trim() || report.description?.trim() || t("reports.row_untitled")
  const location = report.addr?.trim() || t("reports.row_location_pending")
  const color = categoryColor(report.category, th.scheme)

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("reports.row_a11y", {
        title,
        status: t(`enums:status.${report.status}`),
      })}
      {...focusRingProps}
      style={({ pressed }) => [styles.reportRow, pressed ? styles.reportRowPressed : null]}
    >
      <View style={[styles.reportIcon, { backgroundColor: `${color}1F` }]}>
        <Icon icon={iconMap.MapPin} size={17} color={color} />
      </View>
      <View style={styles.reportMeta}>
        <Text style={styles.reportTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.reportLocation} numberOfLines={1}>{location}</Text>
      </View>
      <StatusBadge status={report.status} />
    </Pressable>
  )
}

export function ProfileReportsSection({
  reports,
  totalCount,
}: {
  reports: ProfileReports
  totalCount: number
}) {
  const styles = useStyles()
  const sectionStyles = useSectionStyles()
  const th = useTheme()
  const { t } = useT("profile-view")
  return (
    <View style={styles.reportsSection}>
      <SectionEyebrow>{t("reports.section")}</SectionEyebrow>
      {reports.isLoading ? (
        <Text style={sectionStyles.empty}>{t("reports.loading")}</Text>
      ) : reports.isError ? (
        <Text style={sectionStyles.empty}>{t("reports.error")}</Text>
      ) : reports.items.length === 0 ? (
        <Text style={sectionStyles.empty}>{t("reports.empty")}</Text>
      ) : (
        <View style={styles.reportList}>
          {reports.items.map((report) => (
            <ProfileReportRow
              key={report.id}
              report={report}
              onPress={() => reports.onOpen(report)}
            />
          ))}
          <Pressable
            onPress={reports.onSeeAll}
            accessibilityRole="button"
            accessibilityLabel={t("reports.see_all_a11y")}
            {...focusRingProps}
            style={({ pressed }) => [styles.seeAllReports, pressed ? styles.reportRowPressed : null]}
          >
            <Text style={styles.seeAllReportsText}>{t("reports.see_all", { count: totalCount })}</Text>
            <Icon icon={iconMap.ChevronRight} size={15} color={th.colors.brand.bloom} />
          </Pressable>
        </View>
      )}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  reportsSection: {
    marginTop: t.space["1"],
  },
  reportList: {
    overflow: "hidden",
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s1,
  },
  reportRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["2"] + 2,
    paddingHorizontal: t.space["3"],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  reportRowPressed: {
    opacity: 0.82,
  },
  reportIcon: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  reportMeta: {
    flex: 1,
    minWidth: 0,
  },
  reportTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13.5,
    color: t.colors.text,
  },
  reportLocation: {
    marginTop: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },
  seeAllReports: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: t.space["3"],
  },
  seeAllReportsText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 12.5,
    color: t.colors.accentText,
  },
}))
