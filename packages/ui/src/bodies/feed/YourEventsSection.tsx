import React, { memo, useCallback, useMemo, useState } from "react"
import { Image, Pressable, StyleSheet, View } from "react-native"
import type { CleanupMemberRole, HostedEventDTO, PendingEventTeamInviteDTO } from "@civfix/shared"
import { eventChip, dowLabel, timeLabel } from "@civfix/shared/datetime"
import { focusRingProps, makeThemedStyles, useTheme } from "../../theme"
import { Text } from "../../typography"
import { MetaDot, PrimaryButton, SecondaryButton, useToast } from "../../primitives"
import { useOpenExternal } from "../../capabilities"
import { useLocale, useRelativeTime, useT } from "../../i18n"
import { useAuthState } from "../../data"
import {
  hostedEventRows,
  myEventInviteRows,
  useAcceptMyEventInvite,
  useDeclineMyEventInvite,
  useMyEventInvites,
  useMyHostedEvents,
} from "../../data/hooks/host"
import { SectionEyebrow } from "../profile/SectionHeadings"
import { openHostDashboard } from "../hostDashboardTarget"
import { FeedNotice } from "../FeedNotice"
import { RoleChip } from "../RoleChip"
import type { OpenExternalCapability } from "../../capabilities"
import { buildYourEventsModel } from "./yourEventsModel"

function useRoleLabel(): (role: CleanupMemberRole) => string {
  const { t } = useT("enums")
  return useCallback((role: CleanupMemberRole) => t(`cleanupMemberRole.${role}`), [t])
}

function WhenLine({ startsAt, where }: { startsAt: string; where?: string | null | undefined }) {
  const styles = useStyles()
  const th = useTheme()
  const { locale } = useLocale()
  const { weekdays } = useRelativeTime()
  const parts = [dowLabel(startsAt, weekdays), timeLabel(startsAt, locale), where?.trim()].filter(
    (part): part is string => !!part,
  )
  return (
    <View style={styles.subRow}>
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <MetaDot color={th.colors.textSubtle} style={styles.subDot} /> : null}
          <Text
            style={[styles.sub, index === parts.length - 1 ? styles.subLast : null]}
            numberOfLines={1}
          >
            {part}
          </Text>
        </React.Fragment>
      ))}
    </View>
  )
}

function DateBlock({ startsAt, coverThumbUrl }: { startsAt: string; coverThumbUrl?: string | null }) {
  const styles = useStyles()
  const { locale } = useLocale()
  const { day, month } = eventChip(startsAt, locale)
  if (coverThumbUrl) {
    return <Image source={{ uri: coverThumbUrl }} style={styles.cover} accessibilityIgnoresInvertColors />
  }
  return (
    <View style={styles.date}>
      <Text style={styles.dateDay}>{day}</Text>
      <Text style={styles.dateMonth}>{month}</Text>
    </View>
  )
}

const HostedEventRow = memo(function HostedEventRow({
  event,
  roleLabel,
  onPress,
}: {
  event: HostedEventDTO
  roleLabel: string
  onPress: (eventId: string) => void
}) {
  const styles = useStyles()
  const { t } = useT("home-feed")
  const press = useCallback(() => onPress(event.id), [onPress, event.id])
  return (
    <Pressable
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={t("your_events.open_dashboard_a11y", { title: event.title })}
      {...focusRingProps}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      <DateBlock startsAt={event.startsAt} coverThumbUrl={event.coverThumbUrl ?? null} />
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
        <WhenLine startsAt={event.startsAt} />
      </View>
      {event.myRole ? (
        <RoleChip label={roleLabel} tone={event.myRole === "organizer" ? "lead" : "neutral"} />
      ) : null}
    </Pressable>
  )
})

const InviteRow = memo(function InviteRow({
  invite,
  roleLabel,
  pending,
  onAccept,
  onDecline,
}: {
  invite: PendingEventTeamInviteDTO
  roleLabel: string
  pending: boolean
  onAccept: (inviteId: string) => void
  onDecline: (inviteId: string) => void
}) {
  const styles = useStyles()
  const { t } = useT("home-feed")
  const accept = useCallback(() => onAccept(invite.id), [onAccept, invite.id])
  const decline = useCallback(() => onDecline(invite.id), [onDecline, invite.id])
  const inviter = invite.invitedBy?.name ?? t("your_events.invited_by_unknown")
  return (
    <View style={[styles.row, styles.inviteRow]}>
      <View style={styles.inviteHead}>
        <DateBlock startsAt={invite.event.startsAt} coverThumbUrl={invite.event.coverThumbUrl ?? null} />
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>
            {invite.event.title}
          </Text>
          <WhenLine startsAt={invite.event.startsAt} where={invite.event.address} />
          <Text style={styles.inviteBy} numberOfLines={1}>
            {t("your_events.invited_as", { name: inviter, role: roleLabel })}
          </Text>
        </View>
      </View>
      <View style={styles.inviteActions}>
        <SecondaryButton
          size="sm"
          label={t("your_events.decline")}
          accessibilityLabel={t("your_events.decline_a11y", { title: invite.event.title })}
          disabled={pending}
          onPress={decline}
        />
        <PrimaryButton
          label={t("your_events.accept")}
          accessibilityLabel={t("your_events.accept_a11y", { title: invite.event.title })}
          loading={pending}
          onPress={accept}
          style={styles.acceptBtn}
        />
      </View>
    </View>
  )
})

function ShowMoreControl({
  label,
  a11yLabel,
  onPress,
}: {
  label: string
  a11yLabel: string
  onPress: () => void
}) {
  const styles = useStyles()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      {...focusRingProps}
      style={styles.more}
    >
      <Text style={styles.moreText}>{label}</Text>
    </Pressable>
  )
}

export function YourEventsSection() {
  const styles = useStyles()
  const { t } = useT("home-feed")
  const roleLabel = useRoleLabel()
  const toast = useToast()
  const openExternal: OpenExternalCapability | undefined = useOpenExternal()
  const { isAuthenticated } = useAuthState()
  const [expanded, setExpanded] = useState(false)

  const hosted = useMyHostedEvents("upcoming")
  const invitesQuery = useMyEventInvites()
  const accept = useAcceptMyEventInvite()
  const decline = useDeclineMyEventInvite()

  const events = useMemo(() => hostedEventRows(hosted.data?.pages), [hosted.data])
  const invites = useMemo(() => myEventInviteRows(invitesQuery.data), [invitesQuery.data])

  const model = useMemo(
    () =>
      buildYourEventsModel({
        isAuthenticated,
        events,
        invites,
        expanded,
        eventsPending: hosted.isPending,
        invitesPending: invitesQuery.isPending,
        invitesError: invitesQuery.isError,
      }),
    [
      isAuthenticated,
      events,
      invites,
      expanded,
      hosted.isPending,
      invitesQuery.isPending,
      invitesQuery.isError,
    ],
  )

  const onOpenDashboard = useCallback(
    (eventId: string) => {
      openHostDashboard({ eventId, openExternal })
    },
    [openExternal],
  )

  const acceptMutate = accept.mutate
  const declineMutate = decline.mutate
  const onMutationError = useCallback(() => {
    toast.show(t("your_events.action_error"), { variant: "error" })
  }, [toast, t])

  const onAccept = useCallback(
    (inviteId: string) => acceptMutate({ inviteId }, { onError: onMutationError }),
    [acceptMutate, onMutationError],
  )
  const onDecline = useCallback(
    (inviteId: string) => declineMutate({ inviteId }, { onError: onMutationError }),
    [declineMutate, onMutationError],
  )
  const fetchMoreHosted = hosted.fetchNextPage
  const hostedHasNextPage = hosted.hasNextPage
  const hostedFetchingNextPage = hosted.isFetchingNextPage
  const showMore = useCallback(() => {
    setExpanded(true)
    if (hostedHasNextPage && !hostedFetchingNextPage) void fetchMoreHosted()
  }, [fetchMoreHosted, hostedHasNextPage, hostedFetchingNextPage])
  const showFewer = useCallback(() => setExpanded(false), [])

  const refetchInvites = invitesQuery.refetch
  const retryInvites = useCallback(() => {
    void refetchInvites()
  }, [refetchInvites])

  const pendingInviteId =
    (accept.isPending ? accept.variables?.inviteId : undefined) ??
    (decline.isPending ? decline.variables?.inviteId : undefined) ??
    null

  if (!model.visible) return null

  return (
    <View style={styles.section}>
      <SectionEyebrow>{t("your_events.section")}</SectionEyebrow>
      <View style={styles.list}>
        {model.inviteErrorVisible ? (
          <FeedNotice
            icon="CloudOff"
            title={t("your_events.invites_error_title")}
            body={t("your_events.invites_error_body")}
            actionLabel={t("your_events.invites_retry")}
            onAction={retryInvites}
          />
        ) : null}
        {model.invites.map((invite) => (
          <InviteRow
            key={invite.id}
            invite={invite}
            roleLabel={roleLabel(invite.role)}
            pending={pendingInviteId === invite.id}
            onAccept={onAccept}
            onDecline={onDecline}
          />
        ))}
        {model.events.map((event) => (
          <HostedEventRow
            key={event.id}
            event={event}
            roleLabel={event.myRole ? roleLabel(event.myRole) : ""}
            onPress={onOpenDashboard}
          />
        ))}
      </View>
      {model.showMoreVisible ? (
        <ShowMoreControl
          label={t("your_events.show_more", { count: model.hiddenCount })}
          a11yLabel={t("your_events.show_more_a11y", { count: model.hiddenCount })}
          onPress={showMore}
        />
      ) : null}
      {model.showFewerVisible ? (
        <ShowMoreControl
          label={t("your_events.show_fewer")}
          a11yLabel={t("your_events.show_fewer")}
          onPress={showFewer}
        />
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  section: {
    marginBottom: t.space["2"],
  },
  list: {
    gap: t.space["2"],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    paddingVertical: 11,
    paddingHorizontal: 13,
    ...t.shadows.s1,
  },
  rowPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  inviteRow: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: t.space["3"],
  },
  inviteHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  inviteActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: t.space["2"],
  },
  acceptBtn: {
    paddingHorizontal: t.space["5"],
  },
  inviteBy: {
    marginTop: 3,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textMuted,
  },
  date: {
    width: 46,
    height: 46,
    flexShrink: 0,
    borderRadius: t.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  dateDay: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: 19,
    lineHeight: 20,
    color: t.colors.text,
  },
  dateMonth: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: 2,
    color: t.colors.textMuted,
  },
  cover: {
    width: 46,
    height: 46,
    flexShrink: 0,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.bgAlt,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14.5,
    color: t.colors.text,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  sub: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textSubtle,
  },
  subLast: {
    flexShrink: 1,
  },
  subDot: {
    marginHorizontal: 5,
  },
  more: {
    alignSelf: "flex-start",
    marginTop: t.space["2"],
    paddingVertical: t.space["1"],
    borderRadius: t.radius.sm,
  },
  moreText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.accentText,
  },
}))
