import React, { useCallback, useEffect, useState } from "react"
import { View, Pressable, ScrollView, StyleSheet } from "react-native"
import type { CleanupDTO, ContentReportReason } from "@civfix/shared"
import { eventChip, dowLabel, timeLabel } from "@civfix/shared/datetime"
import { theme, focusRingProps, headingLevel, makeThemedStyles, useTheme } from "../theme"
import { Text, Icon, iconMap, TextLink } from "../typography"
import {
  Avatar,
  MetaDot,
  RsvpPill,
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
  useCleanupAttendees,
  useJoinCleanup,
  useAuthState,
  useRequireAuth,
  useGetTurnstileToken,
  useProfile,
  useReportContent,
} from "../data"
import {
  cleanupHostStanding,
  hasHostCapability,
  managesEvent,
  useEventQuestions,
} from "../data/hooks/host"
import { useOrgDonationPage } from "../data/hooks/donations"
import { useNavStore } from "../nav"
import { useHaptics } from "../capabilities"
import { useLocale, useRelativeTime, useT } from "../i18n"
import { usePageIsActive } from "../shell/pageActive"
import { useScrollHost } from "../shell/ScrollHost"
import { MiniMap, useMapFocus } from "../map"
import { FeedNotice } from "./FeedNotice"
import { EventActionRow, EventActionRows } from "./EventActionRow"
import { LinkedReportCard } from "./LinkedReportCard"
import { EventHoursBlock } from "./EventHoursBlock"
import { EventSlotsBlock } from "./EventSlotsBlock"
import { EventGuestsBlock } from "./EventGuestsBlock"
import { openHostDashboard } from "./hostDashboardTarget"
import { EventRosterBlock } from "./host/EventRosterBlock"
import { RegistrationBlock } from "./host/registration/RegistrationBlock"
import { eventDistanceLabel } from "./eventDistance"
import { buildComposerEventRef } from "./postComposerModel"
import { usePostComposerStore } from "./postComposerStore"

const GOING_AVATAR_CAP = 4

const HERO_HEIGHT = 160

function EventHero({ cleanup }: { cleanup: CleanupDTO }) {
  const styles = useStyles()
  const th = useTheme()
  const hasCoords = cleanup.lat != null && cleanup.lng != null

  if (hasCoords) {
    return (
      <View style={styles.hero}>
        <MiniMap lat={cleanup.lat as number} lng={cleanup.lng as number} height={HERO_HEIGHT} />
      </View>
    )
  }

  return (
    <View style={[styles.hero, styles.heroBlank]}>
      <Icon icon={iconMap.Calendar} size={28} color={th.colors.textSubtle} />
    </View>
  )
}

function GoingRow({ cleanup, goingCount }: { cleanup: CleanupDTO; goingCount: number }) {
  const styles = useStyles()
  const { t } = useT("event-detail")
  const { data } = useCleanupAttendees(cleanup.id)
  const { user } = useAuthState()
  const [expanded, setExpanded] = useState(false)

  const attendees = data?.attendees ?? []
  const stack = attendees.length > 0 ? attendees.slice(0, GOING_AVATAR_CAP) : [cleanup.organizer]
  const names = attendees.map((p) => (user && p.id === user.id ? t("going.you") : p.name))

  const onViewAll = useCallback(() => {
    useNavStore.getState().push({ kind: "members", id: cleanup.id, roomKind: "cleanup" })
  }, [cleanup.id])

  return (
    <View style={styles.goingRow}>
      <View style={styles.avStack}>
        {stack.map((p, i) => (
          <View key={p.id} style={i === 0 ? null : styles.avOverlap}>
            <Avatar
              name={p.name}
              seed={p.id}
              photoUrl={p.avatarUrl ?? null}
              gradient={p.avatar ?? null}
              size={28}
            />
          </View>
        ))}
      </View>
      <View style={styles.goingMain}>
        <Text style={styles.goingCount}>{t("going.count", { count: goingCount })}</Text>
        {goingCount === 0 ? (
          <Text style={styles.goingEmpty}>{t("going.empty")}</Text>
        ) : names.length > 0 ? (
          <Pressable
            onPress={() => setExpanded((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={expanded ? t("going.a11y_show_fewer") : t("going.a11y_show_everyone")}
            {...focusRingProps}
          >
            <Text style={styles.goingNames} numberOfLines={expanded ? undefined : 1}>
              {data?.scope === "following"
                ? t("going.names_following", { names: names.join(", ") })
                : t("going.names", { names: names.join(", ") })}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {goingCount > 0 ? (
        <TextLink
          variant="label"
          onPress={onViewAll}
          standalone
          accessibilityLabel={t("going.a11y_view_everyone")}
        >
          {t("going.view_all")}
        </TextLink>
      ) : null}
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
      <Text style={styles.sectionTitle}>{t("linked_reports.heading")}</Text>
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
  const canViewGuestContact = hasHostCapability(capabilityCleanup, "view_guest_contact")
  const canViewRoster = hasHostCapability(capabilityCleanup, "view_roster")
  const actsAsHost = managesEvent(capabilityCleanup)
  const onOpenHostDashboard = useCallback(() => {
    openHostDashboard({ eventId: cleanup.id })
  }, [cleanup.id])
  const onOpenCheckin = useCallback(() => {
    useNavStore.getState().push({ kind: "host-checkin", id: cleanup.id, title: cleanup.title })
  }, [cleanup.id, cleanup.title])
  const hasTicketTypes = cleanup.ticketTypes.length > 0
  const donatePage = useOrgDonationPage(cleanup.donationOrg?.slug, {
    enabled: cleanup.donationOrg?.enabled === true,
  })
  const isCancelled = cleanup.status === "cancelled"
  const isDone = cleanup.status === "done"
  const isUpcoming = !isCancelled && !isDone
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

  const { day, month } = eventChip(cleanup.scheduledAt, locale)
  const where = cleanup.address?.trim()
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

  const showLinkedReports = cleanup.eventKind === "cleanup" && cleanup.linkedReports.length > 0
  const showDetails =
    !!cleanup.description || cleanup.bring.length > 0 || showLinkedReports

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
        <Text style={styles.title} numberOfLines={2} accessibilityRole="header" {...headingLevel(2)}>
          {cleanup.title}
        </Text>
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
            <Text style={styles.metaWhen}>
              {dowLabel(cleanup.scheduledAt, weekdays)}, {month} {day}
            </Text>
            <MetaDot color={th.colors.textSubtle} />
            <Text style={styles.metaWhen}>{timeLabel(cleanup.scheduledAt, locale)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Icon icon={iconMap.MapPin} size={14} color={th.colors.textSubtle} />
            <Text style={styles.metaWhere} numberOfLines={1}>
              {where ?? (cleanup.type === "route" ? t("where.route") : t("where.meeting_point"))}
            </Text>
            {dist ? (
              <>
                <MetaDot color={th.colors.textSubtle} />
                <Text style={styles.metaDist} numberOfLines={1}>
                  {t("where.distance_away", { dist })}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>

      {isUpcoming && !actsAsHost ? (
        hasTicketTypes ? (
          <View style={styles.rsvp}>
            <RegistrationBlock cleanup={cleanup} onGuestRegister={onSignedOutRsvp} />
          </View>
        ) : (
          <RsvpPill
            going={going}
            onToggle={(currentlyGoing) => {
              if (!currentlyGoing) haptics.success()
              join.mutate(currentlyGoing)
            }}
            busy={join.isPending}
            nextPath={next}
            size="md"
            fill
            onSignedOutPress={onSignedOutRsvp}
            style={styles.rsvp}
          />
        )
      ) : null}

      {!actsAsHost && canCheckIn && isUpcoming ? (
        <View style={styles.section}>
          <EventActionRows>
            <EventActionRow
              icon={iconMap.QrCode}
              label={t("host.check_in")}
              accessibilityLabel={t("host.check_in_a11y")}
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("going.heading")}</Text>
        <GoingRow cleanup={cleanup} goingCount={goingCount} />
        {canViewGuestContact ? (
          <View style={styles.guestsWrap}>
            <EventGuestsBlock
              cleanupId={cleanup.id}
              guestCount={cleanup.guestCount}
              canViewContact
            />
          </View>
        ) : canViewRoster ? (
          <View style={styles.guestsWrap}>
            <EventRosterBlock cleanupId={cleanup.id} canCheckIn={canCheckIn} />
          </View>
        ) : null}
      </View>

      {cleanup.slots.length > 0 ? (
        <View style={[styles.section, styles.sectionFlush]}>
          <EventSlotsBlock
            cleanupId={cleanup.id}
            slots={cleanup.slots}
            joined={going}
            readonly={isDone || isCancelled}
          />
        </View>
      ) : null}

      {showDetails ? (
        <View style={styles.section}>
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

      {isDone ? (
        <View style={styles.section}>
          <EventHoursBlock
            cleanupId={cleanup.id}
            actsAsHost={actsAsHost}
            joined={going}
          />
        </View>
      ) : null}

      <View style={styles.section}>
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

      <View style={styles.section}>
        <EventActionRows>
          {isCancelled ? null : (
            <EventActionRow
              icon={iconMap.MessageCircle}
              label={t("actions.message_crew")}
              accessibilityLabel={t("actions.message_crew_a11y")}
              disabled={!going && !actsAsHost}
              hint={!going && !actsAsHost ? t("actions.message_crew_hint") : undefined}
              onPress={onMessageCrew}
            />
          )}
          {isCancelled ? null : (
            <EventActionRow
              icon={iconMap.RefreshCw}
              label={t("actions.repost")}
              accessibilityLabel={t("actions.repost_a11y")}
              onPress={onRepost}
            />
          )}
          <EventActionRow
            icon={iconMap.Share}
            label={t("actions.share")}
            accessibilityLabel={t("actions.share_a11y")}
            onPress={onShare}
          />
          {actsAsHost ? null : (
            <EventActionRow
              icon={iconMap.Flag}
              label={t("actions.report")}
              accessibilityLabel={t("actions.report_a11y")}
              onPress={onReport}
            />
          )}
        </EventActionRows>
      </View>

      {donatePage.data ? (
        <View style={styles.section}>
          <DonateBlock
            org={{
              slug: donatePage.data.org.slug,
              displayName: donatePage.data.org.displayName,
              legalName: donatePage.data.org.legalName,
              verified: donatePage.data.org.verified,
              donateState: donatePage.data.donateState,
            }}
            eventId={cleanup.id}
          />
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
      <SkeletonBlock width="100%" height={HERO_HEIGHT} radius={theme.radius.lg} style={styles.skeletonHero} />
      <SkeletonGroup style={styles.header}>
        <SkeletonText width="76%" height={22} />
        <SkeletonText width="30%" height={12} style={styles.skeletonStatus} />
        <SkeletonGroup style={styles.metaRows}>
          <SkeletonText width="54%" height={12} />
          <SkeletonText width="68%" height={12} />
        </SkeletonGroup>
      </SkeletonGroup>
      <SkeletonBlock width="100%" height={44} radius={theme.radius.pill} style={styles.rsvp} />
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
  skeletonHero: {
    marginTop: t.space["1"],
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
  heroBlank: {
    height: HERO_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },

  header: {
    marginTop: t.space["4"],
    marginBottom: t.space["4"],
  },
  title: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["24"],
    lineHeight: 28,
    color: t.colors.text,
    letterSpacing: -0.3,
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
  metaWhere: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  metaDist: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },

  rsvp: {
    height: 44,
    alignSelf: "stretch",
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
  sectionTitle: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  subsection: {
    gap: t.space["2"],
  },

  goingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  avStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  avOverlap: {
    marginLeft: -10,
  },
  goingMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  goingCount: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  goingNames: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  goingEmpty: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
  },
  guestsWrap: {
    marginTop: t.space["3"],
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
