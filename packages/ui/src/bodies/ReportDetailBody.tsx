import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  View,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native"
import type {
  ReportDTO,
  ReportStatus,
  LinkedEventRef,
} from "@civfix/shared"
import { makeThemedStyles, radius, useTheme, focusRingProps, headingLevel, type Theme } from "../theme"
import { Text, Icon, iconMap, type IconName } from "../typography"
import {
  StatusBadge,
  MediaPreview,
  EmptyState,
  SkeletonBlock,
  SkeletonGroup,
  SkeletonList,
  SkeletonText,
  EventCard,
  ReportContentSheet,
  PopoverMenu,
  usePopoverAnchor,
  useToast,
} from "../primitives"
import type { AnchorRect, PopoverMenuItem } from "../primitives"
import { shareLink, absoluteUrl } from "../primitives/share"
import {
  useReport,
  useResolveReport,
  useUnlistReport,
  useRequireAuth,
  useReportContent,
} from "../data"
import { type NodeKind, NODE_GLYPH, nodeColor, kindForStatus, citizenStatusLabel } from "../primitives/report-timeline-labels"
import { timelineEntryRender } from "../primitives/report-timeline-model"
import { clampGallerySelection } from "./reportDetailModel"
import type { ContentReportReason, ContentReportSubject } from "@civfix/shared"
import { usePageIsActive } from "../shell/pageActive"
import { useScrollHost } from "../shell/ScrollHost"
import { useNavStore } from "../nav"
import { useCleanupDraft } from "./cleanupDraftStore"
import { useEventReportLink, useMapFocus } from "../map"
import { useLightbox } from "../lightbox"
import { useT, useRelativeTime } from "../i18n"
import type { TFunction } from "i18next"

interface TimelineNode {
  kind: NodeKind
  when: string
  text: string
  detail?: string
  pending?: boolean
  note?: string
  body?: string
}

function buildTimeline(
  report: ReportDTO,
  t: TFunction,
  rel: (iso: string) => string,
): TimelineNode[] {
  const nodes: TimelineNode[] = []
  nodes.push({
    kind: "submitted",
    when: rel(report.createdAt),
    text: report.mine ? t("timeline.reported_by_you") : t("timeline.reported_by_neighbor"),
  })

  if (report.gov) {
    nodes.push({
      kind: "forwarded",
      when: rel(report.publishedAt ?? report.createdAt),
      text: t("timeline.forwarded_to_city"),
    })
  } else {
    nodes.push({
      kind: "pending",
      when: rel(report.createdAt),
      text: t("timeline.pending_submission"),
      pending: true,
    })
  }

  let prevStatus: ReportStatus | null = null
  report.timeline.forEach((entry, i) => {
    const render = timelineEntryRender(entry, i, prevStatus)
    prevStatus = entry.status
    if (render === "skip") return
    if (render === "hidden") {
      nodes.push({ kind: "hidden", when: rel(entry.at), text: t("timeline.hidden_from_map") })
      return
    }
    if (render === "unhidden") {
      nodes.push({ kind: "unhidden", when: rel(entry.at), text: t("timeline.shown_on_map_again") })
      return
    }
    if (render === "reopened") {
      nodes.push({
        kind: "reopened",
        when: rel(entry.at),
        text: t("timeline.reopened"),
        detail: entry.note ?? undefined,
      })
      return
    }
    if (render === "reply") {
      nodes.push({
        kind: "forwarded",
        when: rel(entry.at),
        text: t("timeline.reply_from_city"),
        detail: entry.note ?? undefined,
        ...(entry.body !== undefined ? { body: entry.body } : {}),
      })
      return
    }
    if (render === "note") {
      nodes.push({
        kind: "note",
        when: rel(entry.at),
        text: t("timeline.update"),
        detail: entry.note ?? undefined,
      })
      return
    }
    nodes.push({
      kind: kindForStatus(entry.status),
      when: rel(entry.at),
      text: citizenStatusLabel(t, entry.status),
      detail: entry.note ?? undefined,
    })
  })

  const linked = [...report.linkedEvents].sort(
    (a, b) => new Date(a.linkedAt).getTime() - new Date(b.linkedAt).getTime(),
  )
  for (const ev of linked) {
    nodes.push({
      kind: "linked",
      when: rel(ev.linkedAt),
      text: t("timeline.linked_to_cleanup", { title: ev.title }),
      detail: t("timeline.linked_to_cleanup_detail", { organizer: ev.organizer.name }),
    })
  }

  return nodes
}

function TimelineRow({ node, last }: { node: TimelineNode; last: boolean }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const [open, setOpen] = useState(false)
  const color = nodeColor(node.kind, th.scheme)
  return (
    <View style={styles.tlRow}>
      <View style={styles.tlRail}>
        <View style={[styles.tlDot, { backgroundColor: color }]}>
          <Icon icon={iconMap[NODE_GLYPH[node.kind]]} size={13} color={th.colors.onAccent} />
        </View>
        {!last ? <View style={styles.tlLine} /> : null}
      </View>
      <View style={styles.tlBody}>
        <Text style={styles.tlWhen}>{node.when}</Text>
        <View style={styles.tlHeadRow}>
          <Text style={styles.tlHead}>{node.text}</Text>
          {node.pending ? (
            <Pressable
              onPress={() => setOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityLabel={t("timeline.pending_a11y")}
              hitSlop={8}
              {...focusRingProps}
              style={styles.tlInfoBtn}
            >
              <Icon icon={iconMap.Info} size={15} color={th.colors.textSubtle} />
            </Pressable>
          ) : null}
        </View>
        {node.detail ? <Text style={styles.tlDetail}>{node.detail}</Text> : null}
        {node.pending && open ? (
          <Text style={styles.tlNote}>{node.note ?? t("timeline.pending_note")}</Text>
        ) : null}
        {node.body ? (
          <>
            <Pressable
              onPress={() => setOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityLabel={
                open ? t("timeline.hide_full_message_a11y") : t("timeline.show_full_message_a11y")
              }
              accessibilityState={{ expanded: open }}
              hitSlop={6}
              {...focusRingProps}
              style={styles.tlReplyToggle}
            >
              <Icon
                icon={iconMap[open ? "ChevronUp" : "ChevronDown"]}
                size={14}
                color={th.colors.textSubtle}
              />
              <Text style={styles.tlReplyToggleText}>
                {open ? t("timeline.hide_message") : t("timeline.show_full_message")}
              </Text>
            </Pressable>
            {open ? <Text style={styles.tlReplyBody}>{node.body}</Text> : null}
          </>
        ) : null}
      </View>
    </View>
  )
}

function ResolveButton({ report }: { report: ReportDTO }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const resolve = useResolveReport(report.id)
  const isResolved = report.status === "resolved"
  const onPress = useCallback(() => {
    resolve.mutate(!isResolved)
  }, [resolve, isResolved])

  return (
    <Pressable
      onPress={onPress}
      disabled={resolve.isPending}
      accessibilityRole="button"
      accessibilityState={{ busy: resolve.isPending }}
      accessibilityLabel={isResolved ? t("actions.reopen_a11y") : t("actions.mark_resolved_a11y")}
      {...focusRingProps}
      style={({ pressed }) => [
        styles.resolveBtn,
        isResolved ? styles.resolveBtnReopen : styles.resolveBtnResolve,
        pressed || resolve.isPending ? styles.pressed : null,
      ]}
    >
      {resolve.isPending ? (
        <ActivityIndicator
          size="small"
          color={isResolved ? th.colors.text : th.colors.moss["700"]}
        />
      ) : (
        <Icon
          icon={isResolved ? iconMap.RefreshCw : iconMap.CheckCircle2}
          size={17}
          color={isResolved ? th.colors.text : th.colors.moss["700"]}
        />
      )}
      <Text
        style={[styles.resolveText, isResolved ? styles.resolveTextReopen : styles.resolveTextResolve]}
        numberOfLines={1}
      >
        {isResolved ? t("actions.reopen") : t("actions.mark_resolved")}
      </Text>
    </Pressable>
  )
}

function ViewChatRow({ report }: { report: ReportDTO }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const members = report.chatMemberCount ?? 0
  const messages = report.chatMessageCount ?? 0
  const unread = report.chatUnread ?? 0
  const onPress = useCallback(() => {
    useNavStore.getState().push({ kind: "thread", id: report.id, roomKind: "report" })
  }, [report.id])

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("chat.view_chat_a11y")}
      {...focusRingProps}
      style={({ pressed }) => [styles.viewChatRow, pressed ? styles.pressed : null]}
    >
      <Icon icon={iconMap.MessageCircle} size={18} color={th.colors.brand.bloom} />
      <View style={styles.viewChatBody}>
        <Text style={styles.viewChatTitle} numberOfLines={1}>
          {t("chat.view_chat")}
        </Text>
        <Text style={styles.viewChatMeta} numberOfLines={1}>
          {t("chat.view_chat_meta", { members, messages })}
        </Text>
      </View>
      {unread > 0 ? <View style={styles.viewChatUnreadDot} /> : null}
      <Icon icon={iconMap.ChevronRight} size={18} color={th.colors.textSubtle} />
    </Pressable>
  )
}

function AddToEventButton({ report }: { report: ReportDTO }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const selectedIds = useEventReportLink((s) => s.selectedIds)
  const selected = selectedIds.includes(report.id)
  const onPress = useCallback(() => {
    useEventReportLink.getState().toggle(report.id)
  }, [report.id])

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={selected ? t("actions.added_a11y") : t("actions.add_to_event_a11y")}
      {...focusRingProps}
      style={({ pressed }) => [
        styles.addEventBtn,
        selected ? styles.addEventBtnOn : styles.addEventBtnIdle,
        pressed ? styles.pressed : null,
      ]}
    >
      <Icon
        icon={selected ? iconMap.Check : iconMap.Plus}
        size={17}
        color={selected ? th.colors.onAccent : th.colors.text}
      />
      <Text style={[styles.addEventText, selected ? styles.addEventTextOn : null]} numberOfLines={1}>
        {selected ? t("actions.added") : t("actions.add_to_event")}
      </Text>
    </Pressable>
  )
}

function ReportLinkedEvents({ events }: { events: LinkedEventRef[] }) {
  const styles = useStyles()
  const { t } = useT("report-detail")
  const onOpenEvent = useCallback((ev: LinkedEventRef) => {
    useNavStore.getState().push({ kind: "cleanup", id: ev.id, title: ev.title, lat: ev.lat, lng: ev.lng })
  }, [])

  if (events.length === 0) return null
  return (
    <View style={styles.linkedSection}>
      <Text style={styles.linkedHead}>{t("linked_events.heading")}</Text>
      <View style={styles.linkedList}>
        {events.map((ev) => (
          <EventCard key={ev.id} cleanup={linkedEventToCleanup(ev)} onPress={() => onOpenEvent(ev)} />
        ))}
      </View>
    </View>
  )
}

function linkedEventToCleanup(ev: LinkedEventRef): import("@civfix/shared").CleanupDTO {
  return {
    id: ev.id,
    title: ev.title,
    type: "site",
    eventKind: ev.eventKind,
    lat: ev.lat,
    lng: ev.lng,
    scheduledAt: ev.scheduledAt,
    status: ev.status,
    organizer: ev.organizer,
    going: ev.going,
    joined: false,
    bring: [],
    address: null,
    description: null,
    linkedReports: [],
  } as unknown as import("@civfix/shared").CleanupDTO
}

type StatusTileKind = "processing" | "rejected" | "held"

const statusTile = (t: Theme): Record<StatusTileKind, { icon: IconName; labelKey: string; color: string }> => ({
  processing: { icon: "Clock", labelKey: "gallery.tile_processing", color: t.colors.textSubtle },
  rejected: { icon: "Ban", labelKey: "gallery.tile_rejected", color: t.colors.brand.bloom },
  held: { icon: "AlertCircle", labelKey: "gallery.tile_held", color: t.colors.brand.sun },
})

function StatusTile({ kind, variant }: { kind: StatusTileKind; variant: "hero" | "thumb" }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const { icon, labelKey, color } = statusTile(th)[kind]
  const label = t(labelKey)
  if (variant === "thumb") {
    return (
      <View style={[styles.thumb, styles.thumbStatus]} accessibilityLabel={label}>
        <Icon icon={iconMap[icon]} size={16} color={color} />
      </View>
    )
  }
  return (
    <View style={styles.statusHero} accessibilityLabel={label}>
      <Icon icon={iconMap[icon]} size={26} color={color} />
      <Text style={styles.statusHeroText}>{label}</Text>
    </View>
  )
}

function ReportGallery({
  report,
  onReportPhoto,
}: {
  report: ReportDTO
  onReportPhoto: (mediaId: string) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const mediaList = report.media
  const pending = report.mediaPending ?? 0
  const ready = mediaList.filter((m) => m.status === "ready")
  const ownerPending = mediaList.filter((m) => m.status === "validating")
  const ownerFailed = mediaList.filter((m) => m.status === "rejected" || m.status === "held")

  const { open } = useLightbox()
  const [selected, setSelected] = useState(0)
  const index = clampGallerySelection(selected, ready.length)
  const active = ready[index]
  const lightboxItems = ready.map((m) => ({
    url: m.url,
    kind: m.kind === "video" ? ("video" as const) : ("image" as const),
    thumbUrl: m.thumbUrl ?? null,
    width: m.width ?? null,
    height: m.height ?? null,
  }))

  const tileCount = ready.length + ownerPending.length + ownerFailed.length + pending

  if (!active) {
    if (ownerPending.length > 0 || pending > 0) {
      const total = ownerPending.length + pending
      return (
        <View style={styles.gallery}>
          <View style={styles.processingBlock} accessibilityLabel={t("gallery.processing_a11y")}>
            <Icon icon={iconMap.Clock} size={26} color={th.colors.textSubtle} />
            <Text style={styles.processingTitle}>{t("gallery.processing_title")}</Text>
            <Text style={styles.processingBody}>{t("gallery.processing_body", { count: total })}</Text>
          </View>
        </View>
      )
    }
    if (ownerFailed.length > 0) {
      const first = ownerFailed[0]!
      return (
        <View style={styles.gallery}>
          <StatusTile kind={first.status === "rejected" ? "rejected" : "held"} variant="hero" />
        </View>
      )
    }
    return null
  }

  return (
    <View style={styles.gallery}>
      <View style={styles.heroWrap}>
        <Pressable
          onPress={() => open(lightboxItems, index)}
          accessibilityRole="button"
          accessibilityLabel={t("gallery.view_fullscreen_a11y")}
          {...focusRingProps}
          style={styles.heroPress}
        >
          <MediaPreview
            key={active.url}
            uri={active.url}
            kind={active.kind}
            posterUri={active.thumbUrl ?? undefined}
            aspectRatio={16 / 10}
            style={styles.heroMedia}
          />
        </Pressable>
        {active.kind === "image" ? (
          <Pressable
            onPress={() => onReportPhoto(active.id)}
            accessibilityRole="button"
            accessibilityLabel={t("gallery.report_photo_a11y")}
            hitSlop={6}
            {...focusRingProps}
            style={({ pressed }) => [styles.photoReportBtn, pressed ? styles.pressed : null]}
          >
            <Icon icon={iconMap.Flag} size={14} color={th.colors.onScrim} />
          </Pressable>
        ) : null}
      </View>

      {tileCount > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
          style={styles.stripScroll}
        >
          {ready.map((m, i) => {
            const isActive = i === index
            const thumbUri = m.thumbUrl ?? m.url
            return (
              <Pressable
                key={m.id}
                onPress={() => setSelected(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={t("gallery.thumb_a11y", {
                  kind: m.kind,
                  index: i + 1,
                  total: ready.length,
                })}
                {...focusRingProps}
                style={[styles.thumb, isActive ? styles.thumbActive : null]}
              >
                <Image source={{ uri: thumbUri }} style={styles.thumbImg} resizeMode="cover" />
                {m.kind === "video" ? (
                  <View style={styles.thumbVideoBadge} pointerEvents="none">
                    <Icon icon={iconMap.Video} size={12} color={th.colors.onScrim} />
                  </View>
                ) : null}
              </Pressable>
            )
          })}
          {ownerPending.map((m) => (
            <StatusTile key={m.id} kind="processing" variant="thumb" />
          ))}
          {ownerFailed.map((m) => (
            <StatusTile
              key={m.id}
              kind={m.status === "rejected" ? "rejected" : "held"}
              variant="thumb"
            />
          ))}
          {Array.from({ length: pending }, (_, i) => (
            <StatusTile key={`pending-${i}`} kind="processing" variant="thumb" />
          ))}
        </ScrollView>
      ) : null}
    </View>
  )
}

interface ReportTarget {
  subjectType: ContentReportSubject
  subjectId: string
  label: string
}

function ReportDetailContent({ report }: { report: ReportDTO }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const { relative } = useRelativeTime()
  const { ScrollView } = useScrollHost()
  const title = report.title?.trim() || t(`enums:category.${report.category}`)
  const timeline = useMemo(() => buildTimeline(report, t, relative), [report, t, relative])
  const linkActive = useEventReportLink((s) => s.active)

  const hostDraftActive = useCleanupDraft((s) => s.active)
  const linkedCount = useCleanupDraft((s) => s.value?.linkedReportIds.length ?? 0)
  const isLinked = useCleanupDraft((s) => s.value?.linkedReportIds.includes(report.id) ?? false)

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

  const requireAuth = useRequireAuth()
  const reportContent = useReportContent()
  const toast = useToast()
  const unlist = useUnlistReport(report.id)
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null)
  const [titleMenuOpen, setTitleMenuOpen] = useState(false)
  const [titleMenuRect, setTitleMenuRect] = useState<AnchorRect | null>(null)
  const { ref: titleMenuAnchorRef, measure: measureTitleMenu } = usePopoverAnchor(setTitleMenuRect)
  const openReport = useCallback(
    (target: ReportTarget) => {
      reportContent.reset()
      setReportTarget(target)
    },
    [reportContent],
  )
  const onReportPhoto = useCallback(
    (mediaId: string) =>
      openReport({ subjectType: "photo", subjectId: mediaId, label: t("subject_label.photo") }),
    [openReport, t],
  )
  const onReportGalleryPhoto = useCallback(
    (mediaId: string) =>
      requireAuth(() => onReportPhoto(mediaId), { next: `/pin/${report.id}` }),
    [onReportPhoto, requireAuth, report.id],
  )
  const closeReport = useCallback(() => {
    if (reportContent.isPending) return
    setReportTarget(null)
  }, [reportContent.isPending])
  const sharePath = `/pin/${report.referenceCode ?? report.id}`
  const pendingMenuActionRef = useRef<(() => void) | null>(null)
  const runAfterMenuDismiss = useCallback((action: () => void) => {
    if (Platform.OS === "ios") {
      pendingMenuActionRef.current = action
      return
    }
    action()
  }, [])
  const onTitleMenuDismiss = useCallback(() => {
    const action = pendingMenuActionRef.current
    pendingMenuActionRef.current = null
    if (action) action()
  }, [])
  const onShare = useCallback(() => {
    runAfterMenuDismiss(() => {
      void shareLink({
        title,
        path: sharePath,
        message: t("common-share:sheet.message", { title, url: absoluteUrl(sharePath) }),
      }).then((result) => {
        if (result === "copied") {
          toast.show(t("common-share:button.copied"), { variant: "success" })
        }
      })
    })
  }, [runAfterMenuDismiss, title, sharePath, t, toast])
  const onHostEvent = useCallback(() => {
    requireAuth(
      () => useNavStore.getState().push({ kind: "create-cleanup", reportId: report.id }),
      { next: "/host" },
    )
  }, [requireAuth, report.id])
  const onSubmitReport = useCallback(
    (reason: ContentReportReason, details?: string) => {
      if (!reportTarget) return
      reportContent.mutate(
        {
          subjectType: reportTarget.subjectType,
          subjectId: reportTarget.subjectId,
          reason,
          ...(details ? { details } : {}),
        },
        {
          onSuccess: () => {
            setReportTarget(null)
            toast.show(t("content_report.submitted_toast"), { variant: "success" })
          },
        },
      )
    },
    [reportTarget, reportContent, toast, t],
  )

  const titleMenuItems: PopoverMenuItem[] = [
    {
      key: "share",
      label: t("common-share:button.label"),
      icon: "Share",
      onPress: onShare,
    },
    {
      key: "host-event",
      label: t("actions.host_event"),
      icon: "Megaphone",
      onPress: onHostEvent,
    },
    ...(report.mine
      ? [
          {
            key: report.visibility === "hidden" ? "relist" : "unlist",
            label:
              report.visibility === "hidden"
                ? t("title_menu.show_on_map_again")
                : t("title_menu.hide_from_map"),
            icon: (report.visibility === "hidden" ? "MapPin" : "Lock") as IconName,
            onPress: () => unlist.mutate(report.visibility !== "hidden"),
          },
        ]
      : []),
    {
      key: "report",
      label: t("title_menu.report_this"),
      icon: "Flag",
      onPress: () =>
        requireAuth(
          () =>
            openReport({
              subjectType: "report",
              subjectId: report.id,
              label: t("subject_label.report"),
            }),
          { next: `/pin/${report.id}` },
        ),
    },
  ]

  return (
    <View style={styles.detailRoot}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {hostDraftActive ? (
        <View style={styles.hostDraftBar}>
          <Pressable
            onPress={() => useNavStore.getState().push({ kind: "create-cleanup" })}
            accessibilityRole="button"
            accessibilityLabel={t("hostDraft.back", { count: linkedCount })}
            {...focusRingProps}
            style={({ pressed }) => [styles.hostDraftBack, pressed ? styles.pressed : null]}
          >
            <Icon icon={iconMap.ArrowLeft} size={16} color={th.colors.text} />
            <Text style={styles.hostDraftBackText} numberOfLines={1}>
              {t("hostDraft.back", { count: linkedCount })}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => useCleanupDraft.getState().toggleLinkedReport(report.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isLinked }}
            accessibilityLabel={isLinked ? t("hostDraft.remove") : t("hostDraft.add")}
            {...focusRingProps}
            style={({ pressed }) => [
              styles.hostDraftToggle,
              isLinked ? styles.hostDraftToggleOn : styles.hostDraftToggleOff,
              pressed ? styles.pressed : null,
            ]}
          >
            <Icon
              icon={isLinked ? iconMap.Check : iconMap.Plus}
              size={15}
              color={isLinked ? th.colors.text : th.colors.onAccent}
            />
            <Text
              style={[
                styles.hostDraftToggleText,
                { color: isLinked ? th.colors.text : th.colors.onAccent },
              ]}
            >
              {isLinked ? t("hostDraft.remove") : t("hostDraft.add")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={2} accessibilityRole="header" {...headingLevel(2)}>
          {title}
        </Text>
        <View style={styles.titleOverflow}>
          <Pressable
            ref={titleMenuAnchorRef}
            onPress={() => {
              measureTitleMenu()
              setTitleMenuOpen(true)
            }}
            accessibilityRole="button"
            accessibilityLabel={t("title_menu.options_a11y")}
            accessibilityState={{ expanded: titleMenuOpen }}
            hitSlop={6}
            {...focusRingProps}
            style={({ pressed }) => [styles.titleOverflowBtn, pressed ? styles.pressed : null]}
          >
            <Icon icon={iconMap.Ellipsis} size={18} color={th.colors.textMuted} />
          </Pressable>
          <PopoverMenu
            visible={titleMenuOpen}
            anchorRect={titleMenuRect}
            onClose={() => setTitleMenuOpen(false)}
            onDismiss={onTitleMenuDismiss}
            items={titleMenuItems}
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
          <Icon icon={iconMap.MapPin} size={14} color={th.colors.textSubtle} />
          <Text style={styles.locText} numberOfLines={2}>
            {report.addr}
          </Text>
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

      {linkActive ? <AddToEventButton report={report} /> : null}

      <ReportGallery report={report} onReportPhoto={onReportGalleryPhoto} />

      {report.description ? <Text style={styles.description}>{report.description}</Text> : null}

      <ReportLinkedEvents events={report.linkedEvents} />

      <ViewChatRow report={report} />

      <Text style={styles.updatesLabel}>{t("updates_label")}</Text>
      <View style={styles.timeline}>
        {timeline.map((node, i) => (
          <TimelineRow key={i} node={node} last={i === timeline.length - 1} />
        ))}
      </View>

      <ReportContentSheet
        visible={reportTarget !== null}
        subjectLabel={reportTarget?.label ?? t("subject_label.content")}
        pending={reportContent.isPending}
        error={reportContent.isError ? t("content_report.error") : null}
        onSubmit={onSubmitReport}
        onClose={closeReport}
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
    aspectRatio: 16 / 10,
    marginTop: t.space["4"],
  },
  skeletonBlocks: {
    gap: t.space["4"],
    marginTop: t.space["5"],
  },

  gallery: {
    marginTop: t.space["4"],
  },
  heroWrap: {
    position: "relative",
  },
  heroMedia: {
    width: "100%",
  },
  heroPress: {
    borderRadius: t.radius.lg,
  },
  photoReportBtn: {
    position: "absolute",
    top: t.space["2"],
    right: t.space["2"],
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.scrimStrong,
  },
  stripScroll: {
    marginTop: t.space["2"],
  },
  strip: {
    flexDirection: "row",
    gap: t.space["2"],
    paddingVertical: 2,
  },
  thumb: {
    width: 64,
    height: 48,
    borderRadius: t.radius.md,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: t.colors.border,
    backgroundColor: t.colors.neutral.paper2,
  },
  thumbActive: {
    borderColor: t.colors.brand.bloom,
  },
  thumbImg: {
    width: "100%",
    height: "100%",
  },
  thumbVideoBadge: {
    position: "absolute",
    right: 3,
    bottom: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.scrimStrong,
  },
  thumbStatus: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
    borderColor: t.colors.border,
  },

  statusHero: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.bgAlt,
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["2"],
  },
  statusHeroText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 13,
    color: t.colors.textMuted,
  },

  processingBlock: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.bgAlt,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["2"],
    paddingHorizontal: t.space["5"],
  },
  processingTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14.5,
    color: t.colors.text,
    textAlign: "center",
  },
  processingBody: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: t.colors.textSubtle,
    textAlign: "center",
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
    fontSize: 12,
    marginTop: t.space["1"],
  },

  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: t.space["2"],
  },
  locText: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    color: t.colors.textMuted,
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
    paddingVertical: 4,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  hiddenBannerText: {
    fontFamily: t.fontFamily.bodySemiBold,
  },
  resolveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 46,
    marginTop: t.space["4"],
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
  },
  resolveBtnResolve: {
    backgroundColor: t.colors.moss["50"],
    borderColor: t.colors.brand.moss,
  },
  resolveBtnReopen: {
    backgroundColor: t.colors.surface,
    borderColor: t.colors.borderStrong,
  },
  resolveText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 15,
  },
  resolveTextResolve: {
    color: t.colors.moss["700"],
  },
  resolveTextReopen: {
    color: t.colors.text,
  },

  addEventBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 46,
    marginTop: t.space["4"],
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
  },
  addEventBtnIdle: {
    backgroundColor: t.colors.surface,
    borderColor: t.colors.borderStrong,
  },
  addEventBtnOn: {
    backgroundColor: t.colors.brand.moss,
    borderColor: t.colors.brand.moss,
  },
  addEventText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 15,
    color: t.colors.text,
  },
  addEventTextOn: {
    color: t.colors.onAccent,
  },

  linkedSection: {
    marginTop: t.space["5"],
  },
  linkedHead: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: t.colors.textSubtle,
    marginBottom: t.space["3"],
  },
  linkedList: {
    gap: t.space["3"],
  },

  description: {
    marginTop: t.space["4"],
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    color: t.colors.textMuted,
  },

  viewChatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    marginTop: t.space["4"],
    paddingVertical: t.space["3"],
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.md,
    backgroundColor: t.colors.bgAlt,
  },
  viewChatBody: { flex: 1, minWidth: 0 },
  viewChatTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 15,
    color: t.colors.text,
  },
  viewChatMeta: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    color: t.colors.textSubtle,
    marginTop: 1,
  },
  viewChatUnreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: t.colors.brand.bloom,
  },

  updatesLabel: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: t.colors.textSubtle,
    marginTop: t.space["5"],
    marginBottom: t.space["3"],
  },
  timeline: {
  },

  tlRow: {
    flexDirection: "row",
  },
  tlRail: {
    width: 26,
    alignItems: "center",
  },
  tlDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  tlLine: {
    flex: 1,
    width: 2,
    backgroundColor: t.colors.borderStrong,
    marginVertical: 1,
    minHeight: 28,
  },
  tlBody: {
    flex: 1,
    paddingLeft: t.space["3"],
    paddingBottom: t.space["4"],
  },
  tlWhen: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },
  tlHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  tlHead: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14.5,
    color: t.colors.text,
  },
  tlDetail: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: t.colors.textMuted,
    marginTop: 3,
  },
  tlNote: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: t.colors.textSubtle,
    backgroundColor: t.colors.bgAlt,
    borderRadius: t.radius.sm,
    padding: t.space["3"],
    marginTop: 6,
  },
  tlInfoBtn: {
    borderRadius: t.radius.pill,
  },
  tlReplyToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  tlReplyToggleText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.textSubtle,
  },
  tlReplyBody: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: t.colors.textMuted,
    backgroundColor: t.colors.bgAlt,
    borderRadius: t.radius.sm,
    padding: t.space["3"],
    marginTop: 6,
  },

  hostDraftBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["2"],
    backgroundColor: t.colors.moss["50"],
    borderRadius: t.radius.md,
    marginBottom: t.space["2"],
  },
  hostDraftBack: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 },
  hostDraftBackText: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 13,
    color: t.colors.text,
  },
  hostDraftToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
  },
  hostDraftToggleOn: {
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  hostDraftToggleOff: { backgroundColor: t.colors.brand.bloom },
  hostDraftToggleText: { fontFamily: t.fontFamily.bodyBold, fontSize: 13 },

  pressed: {
    opacity: 0.85,
  },
}))
