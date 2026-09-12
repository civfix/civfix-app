import React, { memo, useCallback } from "react"
import { View } from "react-native"
import type { PendingEventTeamInviteDTO, PendingOrganizationInviteDTO } from "@civfix/shared"
import { dowLabel, timeLabel } from "@civfix/shared/datetime"
import { makeThemedStyles, useTheme } from "../../../theme"
import { Text, TextLink, Icon, iconMap, type IconName } from "../../../typography"
import { MetaDot, SecondaryButton } from "../../../primitives"
import { useLocale, useRelativeTime, useT } from "../../../i18n"

export interface EventInviteRowProps {
  invite: PendingEventTeamInviteDTO
  roleLabel: string
  pending: boolean
  onAccept: (inviteId: string) => void
  onDecline: (inviteId: string) => void
}

function AttentionTile({ icon }: { icon: IconName }) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <View style={styles.tile}>
      <Icon icon={iconMap[icon]} size={18} color={th.colors.sun["700"]} />
    </View>
  )
}

function InviteActions({
  title,
  pending,
  onAccept,
  onDecline,
}: {
  title: string
  pending: boolean
  onAccept: () => void
  onDecline: () => void
}) {
  const styles = useStyles()
  const { t } = useT("event-dashboard")
  return (
    <View style={styles.actions}>
      <TextLink
        variant="label"
        standalone
        accessibilityLabel={t("invites.decline_a11y", { title })}
        onPress={pending ? () => {} : onDecline}
      >
        {t("invites.decline")}
      </TextLink>
      <SecondaryButton
        size="sm"
        icon={iconMap.Check}
        label={t("invites.accept")}
        accessibilityLabel={t("invites.accept_a11y", { title })}
        disabled={pending}
        onPress={onAccept}
      />
    </View>
  )
}

function InviteWhen({ startsAt, where }: { startsAt: string; where?: string | null | undefined }) {
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
            variant="caption"
            numberOfLines={1}
            style={index === parts.length - 1 ? styles.subLast : styles.subFixed}
          >
            {part}
          </Text>
        </React.Fragment>
      ))}
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
        <AttentionTile icon="Mail" />
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>
            {invite.event.title}
          </Text>
          <InviteWhen startsAt={invite.event.startsAt} where={invite.event.address} />
          <Text variant="caption" numberOfLines={2}>
            {t("invites.event_invited_as", { name: inviter, role: roleLabel })}
          </Text>
        </View>
      </View>
      <InviteActions
        title={invite.event.title}
        pending={pending}
        onAccept={accept}
        onDecline={decline}
      />
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
        <AttentionTile icon="Building" />
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>
            {invite.organization.name}
          </Text>
          <Text variant="caption" numberOfLines={2}>
            {t("invites.org_invited_as", { name: inviter, role: roleLabel })}
          </Text>
        </View>
      </View>
      <InviteActions
        title={invite.organization.name}
        pending={pending}
        onAccept={accept}
        onDecline={decline}
      />
    </View>
  )
})

const TILE_SIZE = 40

const useStyles = makeThemedStyles((t) => ({
  row: {
    gap: t.space["2"],
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.md,
    backgroundColor: t.colors.sun["50"],
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: t.space["4"],
  },
  meta: {
    flex: 1,
    minWidth: 0,
    gap: t.space["1"],
  },
  title: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subLast: {
    flexShrink: 1,
  },
  subFixed: {
    flexShrink: 0,
  },
  subDot: {
    marginHorizontal: t.space["1"],
  },
}))
