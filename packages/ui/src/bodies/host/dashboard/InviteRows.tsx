import React, { memo, useCallback } from "react"
import { View } from "react-native"
import type { PendingEventTeamInviteDTO, PendingOrganizationInviteDTO } from "@civfix/shared"
import { makeThemedStyles } from "../../../theme"
import { TextLink, iconMap } from "../../../typography"
import { IconTile, ListRow, SecondaryButton } from "../../../primitives"
import { useT } from "../../../i18n"

export interface EventInviteRowProps {
  invite: PendingEventTeamInviteDTO
  roleLabel: string
  pending: boolean
  onAccept: (inviteId: string) => void
  onDecline: (inviteId: string) => void
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
      <SecondaryButton
        size="sm"
        icon={iconMap.Check}
        label={t("invites.accept")}
        accessibilityLabel={t("invites.accept_a11y", { title })}
        disabled={pending}
        onPress={onAccept}
      />
      <TextLink
        variant="label"
        standalone
        accessibilityLabel={t("invites.decline_a11y", { title })}
        onPress={pending ? () => {} : onDecline}
      >
        {t("invites.decline")}
      </TextLink>
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
  const { t } = useT("event-dashboard")
  const accept = useCallback(() => onAccept(invite.id), [onAccept, invite.id])
  const decline = useCallback(() => onDecline(invite.id), [onDecline, invite.id])
  const inviter = invite.invitedBy?.name ?? t("invites.invited_by_unknown")
  return (
    <ListRow
      leading={<IconTile icon="Mail" tone="attention" />}
      title={invite.event.title}
      titleLines={2}
      sub={t("invites.event_invited_as", { name: inviter, role: roleLabel })}
      footer={
        <InviteActions
          title={invite.event.title}
          pending={pending}
          onAccept={accept}
          onDecline={decline}
        />
      }
    />
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
  const { t } = useT("event-dashboard")
  const accept = useCallback(() => onAccept(invite.id), [onAccept, invite.id])
  const decline = useCallback(() => onDecline(invite.id), [onDecline, invite.id])
  const inviter = invite.invitedBy?.name ?? t("invites.invited_by_unknown")
  return (
    <ListRow
      leading={<IconTile icon="Building2" tone="attention" />}
      title={invite.organization.name}
      titleLines={2}
      sub={t("invites.org_invited_as", { name: inviter, role: roleLabel })}
      footer={
        <InviteActions
          title={invite.organization.name}
          pending={pending}
          onAccept={accept}
          onDecline={decline}
        />
      }
    />
  )
})

const useStyles = makeThemedStyles((t) => ({
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["4"],
  },
}))
