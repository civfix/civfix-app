import React, { useCallback, useEffect, useMemo, useState } from "react"
import { View, Image, Pressable, ScrollView, StyleSheet } from "react-native"
import type { CleanupDTO, ContentReportReason } from "@civfix/shared"
import { isVerifiedEventAddress } from "@civfix/shared"
import { eventWhenLabel } from "@civfix/shared/datetime"
import { deriveCleanupStatus, nextEventBoundaryMs } from "@civfix/shared/host"
import { radius, focusRingProps, headingLevel, makeThemedStyles, useTheme } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import {
  Avatar,
  MetaDot,
  FollowButton,
  SkeletonBlock,
  SkeletonGroup,
  SkeletonList,
  SkeletonText,
  ReportContentSheet,
  GuestRsvpSheet,
  shareLink,
  useToast,
} from "../primitives"
import { DonateBlock } from "../primitives/DonateBlock"
import {
  useCleanup,
  useJoinCleanup,
  useAuthState,
  useRequireAuth,
  useGetTurnstileToken,
  useEventBoundaryRefresh,
  useNow,
  NOW_TICK_MS,
  useProfile,
  useReportContent,
} from "../data"
import {
  cleanupHostStanding,
  hasHostCapability,
  managesEvent,
  useEventQuestions,
} from "../data/hooks/host"
import { donationLinkFor } from "./donationLink"
import { useNavStore } from "../nav"
import { useHaptics } from "../capabilities"
import { useLocale, useRelativeTime, useT, useViewerTimeZone } from "../i18n"
import { usePageIsActive } from "../shell/pageActive"
import { useScrollHost } from "../shell/ScrollHost"
import { useMapFocus } from "../map"
import { AddressRow } from "./AddressRow"
import { FeedNotice } from "./FeedNotice"
import { EventActionRow, EventActionRows } from "./EventActionRow"
import { LinkedReportCard } from "./LinkedReportCard"
import { LINKED_REPORTS_COUNT_AT } from "./linkReportsModel"
import { EventHoursBlock } from "./EventHoursBlock"
import { EventSlotsBlock } from "./EventSlotsBlock"
import { openHostDashboard } from "./hostDashboardTarget"
import { EventAnnouncementsBlock } from "./host/EventAnnouncementsBlock"
import { RegistrationBlock } from "./host/registration/RegistrationBlock"
import { eventDistanceLabel } from "./eventDistance"
import { hasEventEnded } from "./eventLifecycle"
import { generalSlotBoard } from "./eventSlotsModel"
import { buildComposerEventRef } from "./postComposerModel"
import { usePostComposerStore } from "./postComposerStore"

const HERO_COVER_RATIO = 16 / 9

function EventHero({ cleanup }: { cleanup: CleanupDTO }) {
  const styles = useStyles()
  const cover = cleanup.coverUrl?.trim()
  if (!cover) return null
  return (
    <View style={[styles.hero, styles.heroCover]}>
      <Image
        source={{ uri: cover }}
        style={styles.heroImage}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </View>
  )
}

function HostIdentity({ cleanup, isOrganizer }: { cleanup: CleanupDTO; isOrganizer: boolean }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-detail")
  return (
    <>
      <Avatar
        name={cleanup.organizer.name}
        seed={cleanup.organizer.id}
        photoUrl={cleanup.organizer.avatarUrl ?? null}
        gradient={cleanup.organizer.avatar ?? null}
        size={40}
      />
      <View style={styles.hostMeta}>
        <View style={styles.hostNameRow}>
          <Text style={styles.hostName} numberOfLines={1}>
            {isOrganizer ? t("going.you") : cleanup.organizer.name}
          </Text>
        </View>
        {cleanup.organizer.handle || cleanup.organizer.bio ? (
          <View style={styles.hostSubRow}>
            {cleanup.organizer.handle ? (
              <Text style={styles.hostSub} numberOfLines={1}>
                @{cleanup.organizer.handle}
              </Text>
            ) : null}
            {cleanup.organizer.handle && cleanup.organizer.bio ? (
              <MetaDot color={th.colors.textSubtle} style={styles.hostSubDot} />
            ) : null}
            {cleanup.organizer.bio ? (
              <Text style={[styles.hostSub, styles.hostSubBio]} numberOfLines={1}>
                {cleanup.organizer.bio}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.hostSub}>{t("host.neighbor")}</Text>
        )}
      </View>
    </>
  )
}

function LinkedReportsStrip({
  reports,
  onOpenReport,
}: {
  reports: CleanupDTO["linkedReports"]
  onOpenReport: (report: CleanupDTO["linkedReports"][number]) => void
}) {
  const styles = useStyles()
  const { t } = useT("event-detail")
  return (
    <View style={styles.subsection}>
      <Text style={styles.sectionTitle}>
        {reports.length > LINKED_REPORTS_COUNT_AT
          ? t("linked_reports.heading_count", { count: reports.length })
          : t("linked_reports.heading")}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.linkedStrip}
        style={styles.linkedStripScroll}
      >
        {reports.map((report) => (
          <LinkedReportCard key={report.id} report={report} onPress={() => onOpenReport(report)} />
        ))}
      </ScrollView>
    </View>
  )
}

function EventDetailContent({ cleanup }: { cleanup: CleanupDTO }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-detail")
  const { locale } = useLocale()
  const { weekdays } = useRelativeTime()
  const viewerTimeZone = useViewerTimeZone()
  const { ScrollView } = useScrollHost()
  const requireAuth = useRequireAuth()
  const { user } = useAuthState()
  const getTurnstileToken = useGetTurnstileToken()
  const haptics = useHaptics()
  const join = useJoinCleanup(cleanup.id)

  const going = cleanup.joined
  const capabilityCleanup = cleanupHostStanding(cleanup, user?.id ?? null)
  const myRole = capabilityCleanup?.myRole ?? null
  const isOrganizer = myRole === "organizer"
  const isCohost = myRole === "cohost"
  const canCheckIn = hasHostCapability(capabilityCleanup, "check_in")
  const canViewRoster = hasHostCapability(capabilityCleanup, "view_roster")
  const actsAsHost = managesEvent(capabilityCleanup)
  const onOpenHostDashboard = useCallback(() => {
    openHostDashboard({ eventId: cleanup.id })
  }, [cleanup.id])
  const onOpenCheckin = useCallback(() => {
    useNavStore.getState().push({ kind: "host-checkin", id: cleanup.id, title: cleanup.title })
  }, [cleanup.id, cleanup.title])
  const onOpenMyTicket = useCallback(() => {
    useNavStore.getState().push({ kind: "my-ticket", id: cleanup.id, title: cleanup.title })
  }, [cleanup.id, cleanup.title])
  const hasTicketTypes = cleanup.ticketTypes.length > 0
  const boundaryAt = nextEventBoundaryMs(cleanup, Date.now())
  const now = useNow(boundaryAt === null ? 0 : NOW_TICK_MS, { boundaryAt })
  useEventBoundaryRefresh(cleanup, now, cleanup.id)
  const status = deriveCleanupStatus(cleanup, now)
  const isCancelled = status === "cancelled"
  const isDone = status === "done"
  const isEnded = hasEventEnded(cleanup, now)
  const isLive = !isCancelled && !isDone
  const isUpcoming = isLive && !isEnded
  const donation = useMemo(() => donationLinkFor(cleanup), [cleanup])
  const isRegistered = cleanup.myRegistration?.status === "registered"
  const holdsSeat = isRegistered && cleanup.myRegistration?.waitlistPosition == null
  const next = `/cleanups/${cleanup.id}`

  const isActive = usePageIsActive()
  useEffect(() => {
    if (!isActive) return
    const hasCoords = cleanup.lat != null && cleanup.lng != null
    if (!hasCoords) {
      useMapFocus.getState().clear()
      return
    }
    useMapFocus.getState().setEvent({
      id: cleanup.id,
      lat: cleanup.lat as number,
      lng: cleanup.lng as number,
      eventKind: cleanup.eventKind,
    })
    useNavStore.getState().setSnap(1)
    return () => useMapFocus.getState().clearFor(cleanup.id)
  }, [isActive, cleanup.id, cleanup.lat, cleanup.lng, cleanup.eventKind])

  const organizerProfile = useProfile(isOrganizer ? undefined : cleanup.organizer.id)

  const where = cleanup.address?.trim()
  const hasPoint = cleanup.lat != null && cleanup.lng != null
  const dist = eventDistanceLabel(cleanup.dist)
  const goingCount = cleanup.going

  const onMessageCrew = useCallback(() => {
    requireAuth(
      () =>
        useNavStore.getState().push({
          kind: "thread",
          id: cleanup.id,
          roomKind: "cleanup",
          title: cleanup.title,
        }),
      { next },
    )
  }, [cleanup.id, cleanup.title, requireAuth, next])

  const onRepost = useCallback(() => {
    requireAuth(
      () => {
        usePostComposerStore
          .getState()
          .setAttachedEvent(buildComposerEventRef(cleanup, new Date().toISOString()))
        useNavStore.getState().push({ kind: "composer" })
      },
      { next },
    )
  }, [cleanup, next, requireAuth])

  const toast = useToast()

  const reportContent = useReportContent()
  const [reporting, setReporting] = useState(false)
  const onReport = useCallback(() => {
    requireAuth(
      () => {
        reportContent.reset()
        setReporting(true)
      },
      { next },
    )
  }, [requireAuth, reportContent, next])
  const closeReport = useCallback(() => {
    if (reportContent.isPending) return
    setReporting(false)
  }, [reportContent.isPending])
  const onSubmitReport = useCallback(
    (reason: ContentReportReason, details?: string) => {
      reportContent.mutate(
        { subjectType: "event", subjectId: cleanup.id, reason, ...(details ? { details } : {}) },
        {
          onSuccess: () => {
            setReporting(false)
            toast.show(t("report_sheet.success_toast"), { variant: "success" })
          },
        },
      )
    },
    [reportContent, cleanup.id, toast, t],
  )

  const [guestRsvping, setGuestRsvping] = useState(false)
  const guestQuestions = useEventQuestions(cleanup.id, { enabled: guestRsvping && hasTicketTypes })
  const closeGuestRsvp = useCallback(() => setGuestRsvping(false), [])
  const openGuestRsvp = useCallback(() => setGuestRsvping(true), [])
  const onSignedOutRsvp = getTurnstileToken ? openGuestRsvp : undefined
  const sharePath = `/cleanups/${cleanup.referenceCode ?? cleanup.id}`

  const onShare = useCallback(() => {
    void shareLink({ title: cleanup.title, path: sharePath }).then((result) => {
      if (result !== "copied") return
      toast.show(t("common-share:button.copied"), { variant: "success" })
    })
  }, [cleanup.title, sharePath, toast, t])

  const onOpenOrganizer = useCallback(() => {
    useNavStore
      .getState()
      .push({ kind: "person", id: cleanup.organizer.handle ?? cleanup.organizer.id })
  }, [cleanup.organizer.handle, cleanup.organizer.id])

  const onViewAllMembers = useCallback(() => {
    useNavStore.getState().push({ kind: "members", id: cleanup.id, roomKind: "cleanup" })
  }, [cleanup.id])

  const onLeave = useCallback(() => {
    haptics.impactLight()
    join.mutate(true, {
      onSuccess: () => toast.show(t("actions.leave_toast")),
    })
  }, [haptics, join, t, toast])

  const onOpenReport = useCallback(
    (report: CleanupDTO["linkedReports"][number]) => {
      useNavStore.getState().push({
        kind: "pin",
        id: report.id,
        title: report.title,
        lat: report.lat,
        lng: report.lng,
      })
    },
    [],
  )

  const needsGeneralBoard =
    cleanup.slots.length === 0 && isLive && !isEnded && !actsAsHost && !hasTicketTypes
  const generalTitle = t("event-slots:editor.suggest_general")
  const generalBoard = useMemo(
    () =>
      needsGeneralBoard
        ? generalSlotBoard({ title: generalTitle, joined: going, going: goingCount })
        : null,
    [generalTitle, going, goingCount, needsGeneralBoard],
  )
  const boardSlots = cleanup.slots.length > 0 ? cleanup.slots : generalBoard

  const showLinkedReports = cleanup.eventKind === "cleanup" && cleanup.linkedReports.length > 0
  const showDetails =
    !!cleanup.description || cleanup.bring.length > 0 || showLinkedReports

  const detailsFlush = showDetails ? styles.sectionFlush : null
  const hostFlush = showDetails ? null : styles.sectionFlush
  const showTicket = going && holdsSeat && isLive && (!hasTicketTypes || actsAsHost)
  const showMessageCrew = !isCancelled
  const showLeave = going && !actsAsHost && isLive && !isEnded
  const showReport = !actsAsHost

  const statusText = isCancelled
    ? t("status.cancelled")
    : isDone
      ? t("status.ended")
      : isOrganizer
        ? t("status.hosting")
        : isCohost
          ? t("status.cohosting")
          : null
  const statusColor = isCancelled
    ? th.colors.bloom["700"]
    : isDone
      ? th.colors.textMuted
      : th.colors.moss["700"]

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <EventHero cleanup={cleanup} />

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text
            style={styles.title}
            numberOfLines={2}
            accessibilityRole="header"
            {...headingLevel(2)}
          >
            {cleanup.title}
          </Text>
          <Pressable
            onPress={onShare}
            accessibilityRole="button"
            accessibilityLabel={t("actions.share_a11y")}
            hitSlop={6}
            {...focusRingProps}
            style={({ pressed }) => [styles.titleBtn, pressed ? styles.titleBtnPressed : null]}
          >
            <Icon icon={iconMap.Share} size={17} color={th.colors.text} />
          </Pressable>
          {isCancelled ? null : (
            <Pressable
              onPress={onRepost}
              accessibilityRole="button"
              accessibilityLabel={t("actions.repost_a11y")}
              hitSlop={6}
              {...focusRingProps}
              style={({ pressed }) => [styles.titleBtn, pressed ? styles.titleBtnPressed : null]}
            >
              <Icon icon={iconMap.RefreshCw} size={17} color={th.colors.text} />
            </Pressable>
          )}
        </View>
        {statusText ? (
          <Text style={[styles.status, { color: statusColor }]}>{statusText}</Text>
        ) : null}
        {cleanup.referenceCode ? (
          <Text variant="mono" color={th.colors.textSubtle} style={styles.refCode}>
            {cleanup.referenceCode}
          </Text>
        ) : null}
        <View style={styles.metaRows}>
          <View style={styles.metaRow}>
            <Icon icon={iconMap.Calendar} size={14} color={th.colors.textSubtle} />
            <Text style={styles.metaWhen}>{eventWhenLabel(cleanup, { locale, weekdays, viewerTimeZone })}</Text>
          </View>
          <AddressRow
            address={where ?? null}
            point={hasPoint ? { lat: cleanup.lat as number, lng: cleanup.lng as number } : null}
            focusTarget={{ kind: "cleanup", id: cleanup.id, eventKind: cleanup.eventKind }}
            verified={isVerifiedEventAddress(cleanup.addressSource, cleanup.address)}
            fallbackLabel={cleanup.type === "route" ? t("where.route") : t("where.meeting_point")}
            title={cleanup.title}
            numberOfLines={2}
            trailing={
              dist ? (
                <>
                  <MetaDot color={th.colors.textSubtle} />
                  <Text style={styles.metaDist} numberOfLines={1}>
                    {t("where.distance_away", { dist })}
                  </Text>
                </>
              ) : null
            }
          />
        </View>
      </View>

      {showDetails ? (
        <View style={[styles.section, detailsFlush]}>
          {cleanup.description ? (
            <Text style={styles.description}>{cleanup.description}</Text>
          ) : null}
          {cleanup.bring.length > 0 ? (
            <View style={styles.subsection}>
              <Text style={styles.sectionTitle}>{t("bring.heading")}</Text>
              {cleanup.bring.map((item, i) => (
                <View key={`${item}-${i}`} style={styles.bringRow}>
                  <Icon icon={iconMap.Check} size={14} color={th.colors.moss["700"]} />
                  <Text style={styles.bringText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {showLinkedReports ? (
            <LinkedReportsStrip reports={cleanup.linkedReports} onOpenReport={onOpenReport} />
          ) : null}
        </View>
      ) : null}

      <View style={[styles.section, hostFlush]}>
        <Text style={styles.sectionTitle}>{t("host.heading")}</Text>
        <View style={styles.hostRow}>
          {isOrganizer ? (
            <View style={styles.hostWho}>
              <HostIdentity cleanup={cleanup} isOrganizer />
            </View>
          ) : (
            <>
              <Pressable
                onPress={onOpenOrganizer}
                accessibilityRole="button"
                accessibilityLabel={cleanup.organizer.name}
                {...focusRingProps}
                style={({ pressed }) => [styles.hostWho, pressed ? styles.pressed : null]}
              >
                <HostIdentity cleanup={cleanup} isOrganizer={false} />
              </Pressable>
              <FollowButton
                personId={cleanup.organizer.id}
                isFollowing={organizerProfile.data?.profile.isFollowing ?? false}
                nextPath={next}
                size="sm"
              />
            </>
          )}
        </View>
      </View>

      {donation ? (
        <View style={styles.donate}>
          <DonateBlock url={donation.url} ownerName={donation.ownerName} />
        </View>
      ) : null}

      {isLive && !actsAsHost && hasTicketTypes && (isUpcoming || isRegistered) ? (
        <View style={styles.rsvp}>
          <RegistrationBlock cleanup={cleanup} onGuestRegister={onSignedOutRsvp} />
        </View>
      ) : null}

      {boardSlots ? (
        <View style={styles.section}>
          {generalBoard ? (
            <Text style={styles.slotsNone}>{t("event-slots:block.none_yet")}</Text>
          ) : null}
          <EventSlotsBlock
            key={cleanup.id}
            cleanupId={cleanup.id}
            slots={boardSlots}
            joined={going}
            readonly={isDone || isCancelled || isEnded}
            cancelled={isCancelled}
            timeZone={cleanup.timezone ?? undefined}
            mode={generalBoard ? "general" : hasTicketTypes ? "registration" : "claim"}
            viewer={{ actsAsHost, registered: isRegistered }}
            onViewAll={onViewAllMembers}
            onGuestRsvp={onSignedOutRsvp}
          />
        </View>
      ) : isLive && !isEnded && !actsAsHost ? (
        <View style={styles.section}>
          <Text style={styles.slotsNone}>{t("event-slots:block.none_yet")}</Text>
        </View>
      ) : null}

      {showTicket || showMessageCrew ? (
        <View style={styles.section}>
          <EventActionRows>
            {showTicket ? (
              <EventActionRow
                icon={iconMap.Ticket}
                label={t("host-ticket:mine.view_ticket")}
                onPress={onOpenMyTicket}
              />
            ) : null}
            {showMessageCrew ? (
              <EventActionRow
                icon={iconMap.MessageCircle}
                label={t("actions.message_crew")}
                accessibilityLabel={t("actions.message_crew_a11y")}
                disabled={!going && !actsAsHost}
                hint={
                  going || actsAsHost
                    ? undefined
                    : isEnded
                      ? t("actions.message_crew_hint_ended")
                      : t("actions.message_crew_hint")
                }
                onPress={onMessageCrew}
              />
            ) : null}
          </EventActionRows>
        </View>
      ) : null}

      {!actsAsHost && (canCheckIn || canViewRoster) && (isLive || canViewRoster) ? (
        <View style={styles.section}>
          <EventActionRows>
            <EventActionRow
              icon={isLive && canCheckIn ? iconMap.QrCode : iconMap.Users}
              label={isLive && canCheckIn ? t("host.check_in") : t("host.view_roster")}
              accessibilityLabel={
                isLive && canCheckIn ? t("host.check_in_a11y") : t("host.view_roster_a11y")
              }
              onPress={onOpenCheckin}
            />
          </EventActionRows>
        </View>
      ) : null}

      {actsAsHost ? (
        <View style={styles.section}>
          <EventActionRows>
            <EventActionRow
              icon={iconMap.Building}
              label={t("host.dashboard")}
              accessibilityLabel={t("host.dashboard_a11y")}
              onPress={onOpenHostDashboard}
            />
          </EventActionRows>
        </View>
      ) : null}

      <EventAnnouncementsBlock cleanupId={cleanup.id} />

      {isDone ? (
        <View style={styles.section}>
          <EventHoursBlock
            cleanupId={cleanup.id}
            cleanup={cleanup}
            actsAsHost={actsAsHost}
            joined={going}
          />
        </View>
      ) : null}

      {showLeave || showReport ? (
        <View style={styles.section}>
          <EventActionRows>
            {showLeave ? (
              <EventActionRow
                icon={iconMap.LogOut}
                label={t("actions.leave")}
                hint={t("actions.leave_hint")}
                accessibilityLabel={t("actions.leave_a11y")}
                destructive
                disabled={join.isPending}
                onPress={onLeave}
              />
            ) : null}
            {showReport ? (
              <EventActionRow
                icon={iconMap.Flag}
                label={t("actions.report")}
                accessibilityLabel={t("actions.report_a11y")}
                onPress={onReport}
              />
            ) : null}
          </EventActionRows>
        </View>
      ) : null}

      <ReportContentSheet
        visible={reporting}
        subjectLabel={t("report_sheet.subject")}
        pending={reportContent.isPending}
        error={reportContent.isError ? t("report_sheet.submit_error") : null}
        onSubmit={onSubmitReport}
        onClose={closeReport}
      />

      <GuestRsvpSheet
        visible={guestRsvping}
        cleanupId={cleanup.id}
        nextPath={next}
        onClose={closeGuestRsvp}
        ticketTypes={cleanup.ticketTypes}
        questions={guestQuestions.data}
      />
    </ScrollView>
  )
}

function EventDetailSkeleton() {
  const styles = useStyles()
  const { ScrollView } = useScrollHost()
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SkeletonGroup style={styles.header}>
        <SkeletonText width="76%" height={22} />
        <SkeletonText width="30%" height={12} style={styles.skeletonStatus} />
        <SkeletonGroup style={styles.metaRows}>
          <SkeletonText width="54%" height={12} />
          <SkeletonText width="68%" height={12} />
        </SkeletonGroup>
      </SkeletonGroup>
      <SkeletonGroup style={styles.section}>
        <SkeletonText width="24%" height={11} />
        <SkeletonBlock width="100%" height={56} radius={radius.md} />
        <SkeletonBlock width="100%" height={56} radius={radius.md} />
      </SkeletonGroup>
      <SkeletonGroup style={styles.section}>
        <SkeletonText width="24%" height={11} />
        <SkeletonText width="96%" height={12} />
        <SkeletonText width="82%" height={12} />
      </SkeletonGroup>
      <SkeletonGroup style={styles.section}>
        <SkeletonText width="28%" height={11} />
        <SkeletonList rows={3} kind="person" />
      </SkeletonGroup>
    </ScrollView>
  )
}

export function EventDetailBody({ id }: { id: string }) {
  const styles = useStyles()
  const { t } = useT("event-detail")
  const query = useCleanup(id)

  if (query.isLoading) return <EventDetailSkeleton />
  if (query.isError || !query.data) {
    return (
      <View style={styles.stateFill}>
        <FeedNotice
          plain
          icon="CloudOff"
          title={t("state.unavailable_title")}
          body={t("state.unavailable_body")}
        />
      </View>
    )
  }

  return <EventDetailContent cleanup={query.data} />
}

const useStyles = makeThemedStyles((t) => ({
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
  skeletonStatus: {
    marginTop: t.space["1"],
  },

  hero: {
    marginTop: t.space["1"],
    borderRadius: t.radius.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  heroCover: {
    aspectRatio: HERO_COVER_RATIO,
    backgroundColor: t.colors.bgAlt,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },

  header: {
    marginTop: t.space["4"],
    marginBottom: t.space["4"],
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["24"],
    lineHeight: 28,
    color: t.colors.text,
    letterSpacing: -0.3,
  },
  titleBtn: {
    width: 36,
    height: 36,
    borderRadius: t.radius.pill,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s1,
  },
  titleBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.94 }],
  },
  status: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    marginTop: t.space["1"],
  },
  refCode: {
    fontSize: t.fontSize["12"],
    marginTop: t.space["1"],
  },
  metaRows: {
    gap: t.space["1"],
    marginTop: t.space["3"],
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaWhen: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  metaDist: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },

  donate: {
    marginBottom: t.space["4"],
  },
  rsvp: {
    marginTop: t.space["4"],
    marginBottom: t.space["4"],
  },

  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    paddingVertical: t.space["4"],
    gap: t.space["3"],
  },
  sectionFlush: {
    paddingTop: 0,
  },
  slotsNone: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  sectionTitle: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  subsection: {
    gap: t.space["2"],
  },

  description: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    lineHeight: 21,
    color: t.colors.textMuted,
  },
  bringRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  bringText: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  linkedStripScroll: {
    marginHorizontal: -t.space["1"],
  },
  linkedStrip: {
    flexDirection: "row",
    gap: t.space["3"],
    paddingHorizontal: t.space["1"],
    paddingVertical: 2,
  },

  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  hostWho: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    minWidth: 0,
  },
  hostMeta: {
    flex: 1,
    minWidth: 0,
  },
  hostNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
  },
  hostName: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  hostSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 1,
  },
  hostSub: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  hostSubBio: {
    flexShrink: 1,
  },
  hostSubDot: {
    marginHorizontal: 5,
  },

  pressed: {
    opacity: 0.7,
  },
}))
