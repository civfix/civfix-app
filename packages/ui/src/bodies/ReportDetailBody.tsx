import React, { useEffect, useMemo } from "react"
import { View, Pressable } from "react-native"
import type { ReportDTO } from "@civfix/shared"
import { isVerifiedReportAddress } from "@civfix/shared"
import { makeThemedStyles, radius, useTheme, focusRingProps, headingLevel } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import {
  StatusBadge,
  EmptyState,
  SkeletonBlock,
  SkeletonGroup,
  SkeletonList,
  SkeletonText,
  ReportContentSheet,
  PopoverMenu,
} from "../primitives"
import { useReport } from "../data"
import { AddressRow } from "./AddressRow"
import { usePageIsActive } from "../shell/pageActive"
import { useScrollHost } from "../shell/ScrollHost"
import { useNavStore } from "../nav"
import { useMapFocus } from "../map"
import { useT, useRelativeTime } from "../i18n"
import { TimelineRow } from "./reportDetail/TimelineRow"
import { buildTimeline } from "./reportDetail/timelineModel"
import { ResolveButton } from "./reportDetail/ResolveButton"
import { ViewChatRow } from "./reportDetail/ViewChatRow"
import { ReportLinkedEvents } from "./reportDetail/ReportLinkedEvents"
import { ReportGallery } from "./reportDetail/ReportGallery"
import { HostDraftBar } from "./reportDetail/HostDraftBar"
import { GALLERY_ASPECT_RATIO } from "./reportDetail/galleryStyles"
import { useReportDetailSharedStyles } from "./reportDetail/sharedStyles"
import { useReportContentSheet } from "./reportDetail/useReportContentSheet"
import { useReportTitleMenu } from "./reportDetail/useReportTitleMenu"

function ReportDetailContent({ report }: { report: ReportDTO }) {
  const styles = useStyles()
  const shared = useReportDetailSharedStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const { relative } = useRelativeTime()
  const { ScrollView } = useScrollHost()
  const title = report.title?.trim() || t(`enums:category.${report.category}`)
  const timeline = useMemo(() => buildTimeline(report, t, relative), [report, t, relative])

  const isActive = usePageIsActive()
  useEffect(() => {
    if (!isActive) return
    useMapFocus.getState().setReport({
      id: report.id,
      lat: report.lat,
      lng: report.lng,
      category: report.category,
    })
    useNavStore.getState().setSnap(1)
    return () => useMapFocus.getState().clearFor(report.id)
  }, [isActive, report.id, report.lat, report.lng, report.category])

  const contentSheet = useReportContentSheet(report.id)
  const titleMenu = useReportTitleMenu(report, title, contentSheet.open)

  return (
    <View style={styles.detailRoot}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <HostDraftBar reportId={report.id} />

      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={2} accessibilityRole="header" {...headingLevel(2)}>
          {title}
        </Text>
        <View style={styles.titleOverflow}>
          <Pressable
            ref={titleMenu.titleMenuAnchorRef}
            onPress={titleMenu.openTitleMenu}
            accessibilityRole="button"
            accessibilityLabel={t("title_menu.options_a11y")}
            accessibilityState={{ expanded: titleMenu.titleMenuOpen }}
            hitSlop={6}
            {...focusRingProps}
            style={({ pressed }) => [styles.titleOverflowBtn, pressed ? shared.pressed : null]}
          >
            <Icon icon={iconMap.Ellipsis} size={18} color={th.colors.textMuted} />
          </Pressable>
          <PopoverMenu
            visible={titleMenu.titleMenuOpen}
            anchorRect={titleMenu.titleMenuRect}
            onClose={titleMenu.closeTitleMenu}
            items={titleMenu.titleMenuItems}
          />
        </View>
      </View>

      {report.referenceCode ? (
        <Text variant="mono" color={th.colors.textSubtle} style={styles.refCode}>
          {report.referenceCode}
        </Text>
      ) : null}

      {report.addr ? (
        <View style={styles.locRow}>
          <AddressRow
            address={report.addr}
            point={{ lat: report.lat, lng: report.lng }}
            focusTarget={{ kind: "report", id: report.id, category: report.category }}
            precision={report.addrPrecision ?? null}
            verified={isVerifiedReportAddress(report.addrSource, report.addrPrecision, report.addr)}
            title={title}
            numberOfLines={2}
          />
        </View>
      ) : null}

      <View style={styles.statusRow}>
        <StatusBadge status={report.status} large />
      </View>

      {report.mine && report.visibility === "hidden" ? (
        <View style={styles.hiddenBanner} accessibilityRole="text">
          <Icon icon={iconMap.Lock} size={13} color={th.colors.textMuted} />
          <Text variant="caption" color={th.colors.textMuted} style={styles.hiddenBannerText}>
            {t("hidden_banner")}
          </Text>
        </View>
      ) : null}

      {report.mine ? <ResolveButton report={report} /> : null}

      <ReportGallery report={report} onReportPhoto={contentSheet.onReportGalleryPhoto} />

      {report.description ? <Text style={styles.description}>{report.description}</Text> : null}

      <ReportLinkedEvents events={report.linkedEvents} />

      <ViewChatRow report={report} />

      <Text style={[shared.eyebrow, styles.updatesGap]}>{t("updates_label")}</Text>
      <View>
        {timeline.map((node, i) => (
          <TimelineRow key={i} node={node} last={i === timeline.length - 1} />
        ))}
      </View>

      <ReportContentSheet
        visible={contentSheet.target !== null}
        subjectLabel={contentSheet.target?.label ?? t("subject_label.content")}
        pending={contentSheet.pending}
        error={contentSheet.failed ? t("content_report.error") : null}
        onSubmit={contentSheet.submit}
        onClose={contentSheet.close}
      />
    </ScrollView>
    </View>
  )
}

function ReportDetailSkeleton() {
  const styles = useStyles()
  const { ScrollView } = useScrollHost()
  return (
    <View style={styles.detailRoot}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SkeletonGroup style={styles.skeletonHead}>
          <SkeletonText width="82%" height={20} />
          <SkeletonText width="34%" height={12} />
          <SkeletonText width="58%" height={12} />
        </SkeletonGroup>
        <SkeletonBlock
          width="100%"
          height="auto"
          radius={radius.lg}
          style={styles.skeletonHero}
        />
        <SkeletonGroup style={styles.skeletonBlocks}>
          <SkeletonBlock width="100%" height={56} radius={radius.lg} />
          <SkeletonList rows={3} kind="notification" />
        </SkeletonGroup>
      </ScrollView>
    </View>
  )
}

export function ReportDetailBody({ id }: { id: string }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const query = useReport(id)

  if (query.isLoading) return <ReportDetailSkeleton />
  if (query.isError || !query.data) {
    return (
      <View style={styles.stateFill}>
        <EmptyState
          variant="detail"
          tone="neutral"
          icon={iconMap.CloudOff}
          iconColor={th.colors.textSubtle}
          iconSize={30}
          title={t("loading_error.title")}
          body={t("loading_error.body")}
        />
      </View>
    )
  }

  return <ReportDetailContent report={query.data} />
}

const useStyles = makeThemedStyles((t) => ({
  detailRoot: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingBottom: t.space["10"],
  },
  stateFill: {
    flex: 1,
  },
  skeletonHead: {
    gap: t.space["3"],
    paddingTop: t.space["4"],
  },
  skeletonHero: {
    aspectRatio: GALLERY_ASPECT_RATIO,
    marginTop: t.space["4"],
  },
  skeletonBlocks: {
    gap: t.space["4"],
    marginTop: t.space["5"],
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["2"],
    marginTop: t.space["2"],
  },
  title: {
    flex: 1,
    fontFamily: t.fontFamily.displayBold,
    fontSize: 22,
    lineHeight: 26,
    color: t.colors.text,
    letterSpacing: -0.3,
  },
  titleOverflow: {
    marginTop: 2,
  },
  titleOverflowBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  refCode: {
    fontSize: t.fontSize["12"],
    marginTop: t.space["1"],
  },

  locRow: {
    marginTop: t.space["2"],
  },

  statusRow: {
    alignSelf: "flex-start",
    marginTop: t.space["3"],
  },
  hiddenBanner: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: t.space["2"],
    paddingHorizontal: t.space["2"],
    paddingVertical: t.space["1"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  hiddenBannerText: {
    fontFamily: t.fontFamily.bodySemiBold,
  },

  description: {
    marginTop: t.space["4"],
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    lineHeight: 21,
    color: t.colors.textMuted,
  },

  updatesGap: {
    marginTop: t.space["5"],
  },
}))
