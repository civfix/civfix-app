import React, { useCallback, useMemo } from "react"
import type { CleanupMemberRole, OrganizationMemberRole } from "@civfix/shared"
import { useToast } from "../../primitives"
import {
  myEventInviteRows,
  useAcceptMyEventInvite,
  useDeclineMyEventInvite,
  useMyEventInvites,
} from "../../data/hooks/host"
import {
  useAcceptMyOrgInvite,
  useDeclineMyOrgInvite,
  useMyOrgInvites,
} from "../../data/hooks/orgs"
import { useT } from "../../i18n"
import { InvitationsCard } from "./InvitationsCard"

export function InvitationsSection() {
  const { t } = useT("profile")
  const { t: tEnums } = useT("enums")
  const toast = useToast()

  const eventInvites = useMyEventInvites()
  const orgInvites = useMyOrgInvites()
  const acceptEvent = useAcceptMyEventInvite()
  const declineEvent = useDeclineMyEventInvite()
  const acceptOrg = useAcceptMyOrgInvite()
  const declineOrg = useDeclineMyOrgInvite()

  const pendingEventInvites = useMemo(
    () => myEventInviteRows(eventInvites.data),
    [eventInvites.data],
  )
  const pendingOrgInvites = useMemo(() => orgInvites.data ?? [], [orgInvites.data])

  const eventRoleLabel = useCallback(
    (role: CleanupMemberRole) => tEnums(`cleanupMemberRole.${role}`),
    [tEnums],
  )
  const orgRoleLabel = useCallback(
    (role: OrganizationMemberRole) => tEnums(`organizationMemberRole.${role}`),
    [tEnums],
  )

  const onInviteError = useCallback(() => {
    toast.show(t("invites.error"), { variant: "error" })
  }, [t, toast])

  const acceptEventMutate = acceptEvent.mutate
  const declineEventMutate = declineEvent.mutate
  const acceptOrgMutate = acceptOrg.mutate
  const declineOrgMutate = declineOrg.mutate

  const onAcceptEventInvite = useCallback(
    (inviteId: string) => acceptEventMutate({ inviteId }, { onError: onInviteError }),
    [acceptEventMutate, onInviteError],
  )
  const onDeclineEventInvite = useCallback(
    (inviteId: string) => declineEventMutate({ inviteId }, { onError: onInviteError }),
    [declineEventMutate, onInviteError],
  )
  const onAcceptOrgInvite = useCallback(
    (inviteId: string) => acceptOrgMutate({ inviteId }, { onError: onInviteError }),
    [acceptOrgMutate, onInviteError],
  )
  const onDeclineOrgInvite = useCallback(
    (inviteId: string) => declineOrgMutate({ inviteId }, { onError: onInviteError }),
    [declineOrgMutate, onInviteError],
  )

  const onRetryInvites = useCallback(() => {
    if (eventInvites.isError) void eventInvites.refetch()
    if (orgInvites.isError) void orgInvites.refetch()
  }, [eventInvites, orgInvites])

  const pendingEventInviteId =
    (acceptEvent.isPending ? acceptEvent.variables?.inviteId : undefined) ??
    (declineEvent.isPending ? declineEvent.variables?.inviteId : undefined) ??
    null
  const pendingOrgInviteId =
    (acceptOrg.isPending ? acceptOrg.variables?.inviteId : undefined) ??
    (declineOrg.isPending ? declineOrg.variables?.inviteId : undefined) ??
    null

  return (
    <InvitationsCard
      eventInvites={pendingEventInvites}
      orgInvites={pendingOrgInvites}
      invitesPending={eventInvites.isPending || orgInvites.isPending}
      invitesError={eventInvites.isError || orgInvites.isError}
      onRetryInvites={onRetryInvites}
      eventRoleLabel={eventRoleLabel}
      orgRoleLabel={orgRoleLabel}
      pendingEventInviteId={pendingEventInviteId}
      pendingOrgInviteId={pendingOrgInviteId}
      onAcceptEventInvite={onAcceptEventInvite}
      onDeclineEventInvite={onDeclineEventInvite}
      onAcceptOrgInvite={onAcceptOrgInvite}
      onDeclineOrgInvite={onDeclineOrgInvite}
    />
  )
}
