import React, { memo, useCallback } from "react"
import { Image, StyleSheet, View } from "react-native"
import type { PendingEventTeamInviteDTO, PendingOrganizationInviteDTO } from "@civfix/shared"
import { eventChip, dowLabel, timeLabel } from "@civfix/shared/datetime"
import { makeThemedStyles, useTheme } from "../../../theme"
import { Text } from "../../../typography"
import { Avatar, MetaDot, PrimaryButton, SecondaryButton } from "../../../primitives"
import { useLocale, useRelativeTime, useT } from "../../../i18n"

export interface EventInviteRowProps {
  invite: PendingEventTeamInviteDTO
  roleLabel: string
  pending: boolean
  onAccept: (inviteId: string) => void
  onDecline: (inviteId: string) => void
}

function EventWhen({ startsAt, where }: { startsAt: string; where?: string | null | undefined }) {
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

function EventBadge({ startsAt, coverThumbUrl }: { startsAt: string; coverThumbUrl?: string | null }) {
  const styles = useStyles()
  const { locale } = useLocale()
  const { day, month } = eventChip(startsAt, locale)
  if (coverThumbUrl) {
    return (
      <Image source={{ uri: coverThumbUrl }} style={styles.cover} accessibilityIgnoresInvertColors />
    )
  }
  return (
    <View style={styles.date}>
      <Text style={styles.dateDay}>{day}</Text>
      <Text style={styles.dateMonth}>{month}</Text>
    </View>
  )
}

export const EventInviteRow = memo(function EventInviteRow({
  invite,
  roleLabel,
  pending,
  onAccept,
  onDecline,
}: EventInviteRowProps) {
  const styles = useStyles()
  const { t } = useT("event-dashboard")
  const accept = useCallback(() => onAccept(invite.id), [onAccept, invite.id])
  const decline = useCallback(() => onDecline(invite.id), [onDecline, invite.id])
  const inviter = invite.invitedBy?.name ?? t("invites.invited_by_unknown")
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <EventBadge startsAt={invite.event.startsAt} coverThumbUrl={invite.event.coverThumbUrl ?? null} />
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>
            {invite.event.title}
          </Text>
          <EventWhen startsAt={invite.event.startsAt} where={invite.event.address} />
          <Text style={styles.by} numberOfLines={2}>
            {t("invites.event_invited_as", { name: inviter, role: roleLabel })}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <SecondaryButton
          size="sm"
          label={t("invites.decline")}
          accessibilityLabel={t("invites.decline_a11y", { title: invite.event.title })}
          disabled={pending}
          onPress={decline}
        />
        <PrimaryButton
          label={t("invites.accept")}
          accessibilityLabel={t("invites.accept_a11y", { title: invite.event.title })}
          loading={pending}
          onPress={accept}
          style={styles.acceptBtn}
        />
      </View>
    </View>
  )
})

export interface OrgInviteRowProps {
  invite: PendingOrganizationInviteDTO
  roleLabel: string
  pending: boolean
  onAccept: (inviteId: string) => void
  onDecline: (inviteId: string) => void
}

export const OrgInviteRow = memo(function OrgInviteRow({
  invite,
  roleLabel,
  pending,
  onAccept,
  onDecline,
}: OrgInviteRowProps) {
  const styles = useStyles()
  const { t } = useT("event-dashboard")
  const accept = useCallback(() => onAccept(invite.id), [onAccept, invite.id])
  const decline = useCallback(() => onDecline(invite.id), [onDecline, invite.id])
  const inviter = invite.invitedBy?.name ?? t("invites.invited_by_unknown")
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <Avatar
          name={invite.organization.name}
          seed={invite.organization.id}
          photoUrl={invite.organization.logoUrl ?? null}
          size={46}
        />
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>
            {invite.organization.name}
          </Text>
          <Text style={styles.by} numberOfLines={2}>
            {t("invites.org_invited_as", { name: inviter, role: roleLabel })}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <SecondaryButton
          size="sm"
          label={t("invites.decline")}
          accessibilityLabel={t("invites.decline_a11y", { title: invite.organization.name })}
          disabled={pending}
          onPress={decline}
        />
        <PrimaryButton
          label={t("invites.accept")}
          accessibilityLabel={t("invites.accept_a11y", { title: invite.organization.name })}
          loading={pending}
          onPress={accept}
          style={styles.acceptBtn}
        />
      </View>
    </View>
  )
})

const useStyles = makeThemedStyles((t) => ({
  row: {
    gap: t.space["3"],
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    paddingVertical: 11,
    paddingHorizontal: 13,
    ...t.shadows.s1,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: t.space["2"],
  },
  acceptBtn: {
    paddingHorizontal: t.space["5"],
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
  by: {
    marginTop: 3,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textMuted,
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
}))
