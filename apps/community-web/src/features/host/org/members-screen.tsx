"use client"

import { useState } from "react"
import { UserPlus } from "lucide-react"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { ListOrganizationMembersResponse, OrganizationMemberDTO } from "@civfix/shared"
import { useApi, useAuthState } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { useGate } from "@/components/console/query-state"
import { EmptyState, LoadingState, StateGate } from "@/components/console/states"
import { ConsoleButton } from "@/components/console/button"
import { Chip } from "@/components/console/chips/chip"
import { QRow } from "@/components/console/qrow"
import { Select } from "@/components/console/forms/inputs"
import { ConfirmModal } from "@/components/console/overlay/confirm-modal"
import { useConsoleToast } from "@/components/console/overlay/toast"

import { useConsoleOrg } from "../console-context"
import { useConsoleErrors } from "../error-copy"
import { useConsoleFormat } from "../format"
import { consoleKeys } from "../console-keys"
import { invalidateOrg } from "../console-invalidate"
import { InviteMemberDrawer } from "./invite-member-drawer"
import type { InvitableRole } from "./invite-member-drawer"
import { PendingInvites } from "./pending-invites"
import { suspendedForbiddenCopy } from "./suspended-banner"

export const SETTABLE_ORG_ROLES = ["admin", "member"] as const satisfies readonly InvitableRole[]

interface PendingRoleChange {
  userId: string
  name: string
  role: InvitableRole
}

interface PendingRemoval {
  userId: string
  name: string
}

export function useOrgMembers(orgId: string) {
  const api = useApi()
  return useInfiniteQuery<ListOrganizationMembersResponse>({
    queryKey: consoleKeys.orgMembers(orgId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listOrganizationMembers({
        id: orgId,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: false,
  })
}

export function MembersScreen() {
  const { t } = useT("host-org")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const format = useConsoleFormat()
  const viewerId = useAuthState().user?.id ?? null
  const { orgId, isOwner, canManage, isSuspended } = useConsoleOrg()
  const suspendedOverride = isSuspended ? { FORBIDDEN: suspendedForbiddenCopy(t) } : {}

  const members = useOrgMembers(orgId)
  const gate = useGate(members)
  const rows: OrganizationMemberDTO[] = (members.data?.pages ?? []).flatMap((page) => page.items)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [pendingRole, setPendingRole] = useState<PendingRoleChange | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null)

  const setRole = useMutation({
    mutationFn: (input: PendingRoleChange) =>
      api.setOrganizationMemberRole({ id: orgId, userId: input.userId, role: input.role }),
    onSuccess: () => {
      toast.toast({ title: t("role.updated", { defaultValue: "Role updated" }), tone: "success" })
      setPendingRole(null)
      invalidateOrg(qc, orgId)
    },
    onError: (err) => {
      setPendingRole(null)
      toast.toast({
        title: errors.message(err, {
          FORBIDDEN: t("role.error_forbidden", {
            defaultValue: "Only the owner can change roles.",
          }),
          ...suspendedOverride,
        }),
        tone: "danger",
      })
    },
  })

  const remove = useMutation({
    mutationFn: (input: PendingRemoval) =>
      api.removeOrganizationMember({ id: orgId, userId: input.userId }),
    onSuccess: (_result, input) => {
      toast.toast({
        title: t("remove.done", { name: input.name, defaultValue: `Removed ${input.name}` }),
        tone: "success",
      })
      setPendingRemoval(null)
      invalidateOrg(qc, orgId)
    },
    onError: (err) => {
      setPendingRemoval(null)
      toast.toast({ title: errors.message(err, suspendedOverride), tone: "danger" })
    },
  })

  const canChangeRole = (member: OrganizationMemberDTO) =>
    isOwner && member.role !== "owner" && member.person.id !== viewerId

  return (
    <div className="flex flex-col gap-token-5">
      <section className="rounded-md border border-console-line bg-console-surface shadow-console-1">
        <div className="flex flex-wrap items-center justify-between gap-token-3 border-b border-console-line px-token-4 py-token-3">
          <div>
            <h2 className="font-display text-token-16 font-bold text-console-ink">
              {t("members.title")}
            </h2>
            <p className="text-token-12 text-console-ink-3">
              {t("members.subtitle", {
                defaultValue:
                  "Owners manage roles and billing; admins run the profile and events; members see the roster.",
              })}
            </p>
          </div>
          {canManage ? (
            <ConsoleButton
              size="sm"
              disabled={isSuspended}
              title={isSuspended ? suspendedForbiddenCopy(t) : undefined}
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus aria-hidden className="h-4 w-4" />
              {t("invite.action", { defaultValue: "Invite" })}
            </ConsoleButton>
          ) : null}
        </div>
        <StateGate
          {...gate}
          onRetry={() => void members.refetch()}
          skeleton={<LoadingState count={4} className="p-token-4" />}
          empty={members.isSuccess && rows.length === 0}
          emptyState={
            <div className="p-token-4">
              <EmptyState
                title={t("members.empty_title", { defaultValue: "No members yet" })}
                body={t("members.empty_body", {
                  defaultValue: "Invite teammates so they can co-host under this organization.",
                })}
              />
            </div>
          }
        >
          {rows.map((member) => (
            <QRow
              key={member.person.id}
              title={member.person.name}
              ident={member.person.handle ? `@${member.person.handle}` : undefined}
              sub={t("members.joined", { when: format.date(member.joinedAt) })}
              chips={
                <>
                  <Chip kind="org-role" value={member.role} size="sm" />
                  {member.person.id === viewerId ? (
                    <span className="text-token-12 text-console-ink-3">
                      {t("members.you", { defaultValue: "You" })}
                    </span>
                  ) : null}
                </>
              }
              trailing={
                canChangeRole(member) || (member.canRemove && canManage) ? (
                  <span className="flex items-center gap-token-2">
                    {canChangeRole(member) ? (
                      <Select
                        aria-label={t("role.change_a11y", {
                          name: member.person.name,
                          defaultValue: `Change role for ${member.person.name}`,
                        })}
                        className="h-8 w-32"
                        value={member.role}
                        disabled={setRole.isPending || isSuspended}
                        title={isSuspended ? suspendedForbiddenCopy(t) : undefined}
                        onChange={(event) =>
                          setPendingRole({
                            userId: member.person.id,
                            name: member.person.name,
                            role: event.target.value as InvitableRole,
                          })
                        }
                        options={SETTABLE_ORG_ROLES.map((value) => ({
                          value,
                          label: t(`enums:organizationMemberRole.${value}`),
                        }))}
                      />
                    ) : null}
                    {member.canRemove && canManage ? (
                      <ConsoleButton
                        variant="ghost"
                        size="sm"
                        aria-label={t("remove.a11y", {
                          name: member.person.name,
                          defaultValue: `Remove ${member.person.name}`,
                        })}
                        disabled={isSuspended}
                        title={isSuspended ? suspendedForbiddenCopy(t) : undefined}
                        onClick={() =>
                          setPendingRemoval({ userId: member.person.id, name: member.person.name })
                        }
                      >
                        {t("remove.action", { defaultValue: "Remove" })}
                      </ConsoleButton>
                    ) : null}
                  </span>
                ) : null
              }
            />
          ))}
          {!isOwner ? (
            <p className="border-t border-console-line px-token-4 py-token-3 text-token-12 text-console-ink-3">
              {t("members.read_only")}
            </p>
          ) : null}
        </StateGate>
        {members.hasNextPage ? (
          <div className="flex justify-center border-t border-console-line p-token-3">
            <ConsoleButton
              variant="outline"
              size="sm"
              disabled={members.isFetchingNextPage}
              onClick={() => void members.fetchNextPage()}
            >
              {members.isFetchingNextPage ? tc("action.loading") : tc("action.load_more")}
            </ConsoleButton>
          </div>
        ) : null}
      </section>

      <PendingInvites />

      <InviteMemberDrawer
        orgId={orgId}
        open={inviteOpen}
        disabled={isSuspended}
        onClose={() => setInviteOpen(false)}
      />

      <ConfirmModal
        open={pendingRole !== null}
        severity="warn"
        title={t("role.confirm_title", { defaultValue: "Change role?" })}
        body={
          pendingRole
            ? t("role.confirm_body", {
                name: pendingRole.name,
                role: t(`enums:organizationMemberRole.${pendingRole.role}`),
                defaultValue: `${pendingRole.name} will become ${pendingRole.role === "admin" ? "an admin" : "a member"} of this organization.`,
              })
            : ""
        }
        confirmLabel={t("role.confirm_action", { defaultValue: "Change role" })}
        busy={setRole.isPending}
        onCancel={() => setPendingRole(null)}
        onConfirm={() => {
          if (pendingRole) setRole.mutate(pendingRole)
        }}
      />

      <ConfirmModal
        open={pendingRemoval !== null}
        severity="danger"
        title={t("remove.confirm_title", { defaultValue: "Remove member?" })}
        body={
          pendingRemoval
            ? t("remove.confirm_body", {
                name: pendingRemoval.name,
                defaultValue: `${pendingRemoval.name} will lose access to this organization's events and console. They can be invited again later.`,
              })
            : ""
        }
        confirmLabel={t("remove.action", { defaultValue: "Remove" })}
        busy={remove.isPending}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (pendingRemoval) remove.mutate(pendingRemoval)
        }}
      />
    </div>
  )
}
