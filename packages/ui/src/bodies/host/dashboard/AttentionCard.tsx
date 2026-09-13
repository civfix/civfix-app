import React from "react"
import type {
  CleanupMemberRole,
  HostedEventDTO,
  OrganizationMemberRole,
  PendingEventTeamInviteDTO,
  PendingOrganizationInviteDTO,
} from "@civfix/shared"
import { dowLabel } from "@civfix/shared/datetime"
import { IconTile, ListRow, SectionCard, LIST_DIVIDER_INSET } from "../../../primitives"
import { useRelativeTime, useT } from "../../../i18n"
import { FeedNotice } from "../../FeedNotice"
import { RowsSkeleton } from "../HostSkeletons"
import { EventInviteRow, OrgInviteRow } from "./InviteRows"
import { ATTENTION_MAX_ROWS, type AttentionRow } from "./dashboardModel"

export interface AttentionCardProps {
  eventInvites: readonly PendingEventTeamInviteDTO[]
  orgInvites: readonly PendingOrganizationInviteDTO[]
  invitesPending: boolean
  invitesError: boolean
  onRetryInvites: () => void
  eventRoleLabel: (role: CleanupMemberRole) => string
  orgRoleLabel: (role: OrganizationMemberRole) => string
  pendingEventInviteId: string | null
  pendingOrgInviteId: string | null
  onAcceptEventInvite: (inviteId: string) => void
  onDeclineEventInvite: (inviteId: string) => void
  onAcceptOrgInvite: (inviteId: string) => void
  onDeclineOrgInvite: (inviteId: string) => void
  rows: readonly AttentionRow[]
  onOpenHost: (event: HostedEventDTO) => void
}

function TaskRow({
  row,
  onOpenHost,
}: {
  row: AttentionRow
  onOpenHost: (event: HostedEventDTO) => void
}) {
  const { t } = useT("event-dashboard")
  const { weekdays } = useRelativeTime()
  const { event, kind } = row
  const sub =
    kind === "complete"
      ? t("attention.complete", { dow: dowLabel(event.endsAt ?? event.startsAt, weekdays) })
      : t("attention.credit_hours", { count: event.checkedInCount })
  return (
    <ListRow
      leading={<IconTile icon={kind === "complete" ? "CheckCheck" : "Clock"} tone="attention" />}
      title={event.title}
      titleLines={1}
      sub={sub}
      chevron
      accessibilityLabel={t(
        kind === "complete" ? "attention.complete_a11y" : "attention.credit_hours_a11y",
        { title: event.title },
      )}
      onPress={() => onOpenHost(event)}
    />
  )
}

export function AttentionCard({
  eventInvites,
  orgInvites,
  invitesPending,
  invitesError,
  onRetryInvites,
  eventRoleLabel,
  orgRoleLabel,
  pendingEventInviteId,
  pendingOrgInviteId,
  onAcceptEventInvite,
  onDeclineEventInvite,
  onAcceptOrgInvite,
  onDeclineOrgInvite,
  rows,
  onOpenHost,
}: AttentionCardProps) {
  const { t } = useT("event-dashboard")

  const inviteCount = eventInvites.length + orgInvites.length
  if (invitesError) {
    return (
      <SectionCard label={t("attention.section")}>
        <FeedNotice
          icon="CloudOff"
          title={t("invites.error_title")}
          body={t("invites.error_body")}
          actionLabel={t("invites.retry")}
          onAction={onRetryInvites}
        />
      </SectionCard>
    )
  }
  if (invitesPending && inviteCount === 0 && rows.length === 0) {
    return <RowsSkeleton rows={1} />
  }
  if (inviteCount === 0 && rows.length === 0) return null

  const taskRoom = Math.max(0, ATTENTION_MAX_ROWS - inviteCount)
  const tasks = rows.slice(0, taskRoom)

  return (
    <SectionCard
      label={t("attention.section")}
      variant="list"
      dividerInset={LIST_DIVIDER_INSET}
    >
      {eventInvites.slice(0, ATTENTION_MAX_ROWS).map((invite) => (
        <EventInviteRow
          key={invite.id}
          invite={invite}
          roleLabel={eventRoleLabel(invite.role)}
          pending={pendingEventInviteId === invite.id}
          onAccept={onAcceptEventInvite}
          onDecline={onDeclineEventInvite}
        />
      ))}
      {orgInvites
        .slice(0, Math.max(0, ATTENTION_MAX_ROWS - eventInvites.length))
        .map((invite) => (
          <OrgInviteRow
            key={invite.id}
            invite={invite}
            roleLabel={orgRoleLabel(invite.role)}
            pending={pendingOrgInviteId === invite.id}
            onAccept={onAcceptOrgInvite}
            onDecline={onDeclineOrgInvite}
          />
        ))}
      {tasks.map((row) => (
        <TaskRow key={`${row.kind}-${row.event.id}`} row={row} onOpenHost={onOpenHost} />
      ))}
    </SectionCard>
  )
}
