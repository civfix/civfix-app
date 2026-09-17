import React from "react"
import { View } from "react-native"
import type {
  CleanupMemberRole,
  OrganizationMemberRole,
  PendingEventTeamInviteDTO,
  PendingOrganizationInviteDTO,
} from "@civfix/shared"
import { SectionCard, LIST_DIVIDER_INSET } from "../../primitives"
import { useT } from "../../i18n"
import { makeThemedStyles } from "../../theme"
import { FeedNotice } from "../FeedNotice"
import { RowsSkeleton } from "../host/HostSkeletons"
import { EventInviteRow, OrgInviteRow } from "./InviteRows"
import { inviteRowSlice } from "./invitesModel"

export interface InvitationsCardProps {
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
}

export function InvitationsCard({
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
}: InvitationsCardProps) {
  const { t } = useT("profile")
  const styles = useStyles()

  const slice = inviteRowSlice(eventInvites, orgInvites)
  if (invitesError) {
    return (
      <SectionCard label={t("invites.section")} variant="list">
        <View style={styles.notice}>
          <FeedNotice
            icon="CloudOff"
            title={t("invites.error_title")}
            body={t("invites.error_body")}
            actionLabel={t("invites.retry")}
            onAction={onRetryInvites}
          />
        </View>
      </SectionCard>
    )
  }
  if (invitesPending && slice.total === 0) return <RowsSkeleton rows={1} />
  if (slice.total === 0) return null

  return (
    <SectionCard
      label={t("invites.section")}
      variant="list"
      dividerInset={LIST_DIVIDER_INSET}
    >
      {slice.events.map((invite) => (
        <EventInviteRow
          key={invite.id}
          invite={invite}
          roleLabel={eventRoleLabel(invite.role)}
          pending={pendingEventInviteId === invite.id}
          onAccept={onAcceptEventInvite}
          onDecline={onDeclineEventInvite}
        />
      ))}
      {slice.orgs.map((invite) => (
        <OrgInviteRow
          key={invite.id}
          invite={invite}
          roleLabel={orgRoleLabel(invite.role)}
          pending={pendingOrgInviteId === invite.id}
          onAccept={onAcceptOrgInvite}
          onDecline={onDeclineOrgInvite}
        />
      ))}
    </SectionCard>
  )
}

const useStyles = makeThemedStyles((t) => ({
  notice: {
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["2"],
  },
}))
