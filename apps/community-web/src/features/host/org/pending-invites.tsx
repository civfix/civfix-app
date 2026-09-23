"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ListOrganizationInvitesResponse, OrganizationInviteDTO } from "@civfix/shared"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { ErrorRegion } from "@/components/console/states"
import { ConsoleButton } from "@/components/console/button"
import { Chip } from "@/components/console/chips/chip"
import { QRow } from "@/components/console/qrow"
import { ConfirmModal } from "@/components/console/overlay/confirm-modal"
import { useConsoleToast } from "@/components/console/overlay/toast"

import { useConsoleOrg } from "../console-context"
import { useConsoleErrors } from "../error-copy"
import { consoleKeys } from "../console-keys"
import { ORG_INVITE_TTL_DAYS, daysUntil, inviteIsExpired, visibleInvites } from "./org-invites"
import { suspendedForbiddenCopy } from "./suspended-banner"

/**
 * Invites carry the typed email, so the server lists them for owner|admin only; a plain member
 * would get FORBIDDEN, hence `enabled`.
 */
export function useOrgInvites(orgId: string, enabled: boolean) {
  const api = useApi()
  return useQuery<ListOrganizationInvitesResponse>({
    queryKey: consoleKeys.orgInvites(orgId),
    queryFn: () => api.listOrganizationInvites({ id: orgId }),
    enabled,
    retry: false,
  })
}

export function inviteDisplayName(invite: OrganizationInviteDTO, unknown: string): string {
  return invite.user?.name ?? invite.email ?? unknown
}

interface PendingRevoke {
  inviteId: string
  name: string
}

/**
 * The "Pending invites" card under the roster: hidden entirely while there is nothing pending (an
 * empty card would only shout about a feature the host has not used), shown to owner|admin with a
 * confirmed Revoke per row. An expired row keeps its place with a status pill so the host sees why
 * the invitee never showed up, and can re-invite.
 */
export function PendingInvites() {
  const { t } = useT("host-org")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const { orgId, canManage, isSuspended } = useConsoleOrg()

  const invites = useOrgInvites(orgId, canManage)
  const rows = visibleInvites(invites.data?.items ?? [])
  const [pendingRevoke, setPendingRevoke] = useState<PendingRevoke | null>(null)

  const revoke = useMutation({
    mutationFn: (input: PendingRevoke) =>
      api.revokeOrganizationInvite({ id: orgId, inviteId: input.inviteId }),
    onSuccess: (_result, input) => {
      toast.toast({
        title: t("invites.revoked", { name: input.name, defaultValue: `Revoked the invite for ${input.name}` }),
        tone: "success",
      })
      setPendingRevoke(null)
      void qc.invalidateQueries({ queryKey: consoleKeys.orgInvites(orgId) })
    },
    onError: (err) => {
      setPendingRevoke(null)
      toast.toast({
        title: errors.message(err, {
          NOT_FOUND: t("invites.error_not_found", {
            defaultValue: "That invitation was already accepted or revoked.",
          }),
          ...(isSuspended ? { FORBIDDEN: suspendedForbiddenCopy(t) } : {}),
        }),
        tone: "danger",
      })
      void qc.invalidateQueries({ queryKey: consoleKeys.orgInvites(orgId) })
    },
  })

  if (!canManage) return null
  if (invites.isError) {
    return (
      <ErrorRegion
        title={t("invites.error_title", { defaultValue: "Pending invites did not load" })}
        onRetry={() => void invites.refetch()}
      />
    )
  }
  if (rows.length === 0) return null

  const unknown = t("invites.unknown", { defaultValue: "Someone" })

  return (
    <section
      aria-labelledby="org-pending-invites-title"
      className="rounded-md border border-console-line bg-console-surface shadow-console-1"
    >
      <div className="border-b border-console-line px-token-4 py-token-3">
        <h2
          id="org-pending-invites-title"
          className="font-display text-token-16 font-bold text-console-ink"
        >
          {t("invites.title", { defaultValue: "Pending invites" })}
        </h2>
        <p className="text-token-12 text-console-ink-3">
          {t("invites.subtitle", {
            days: ORG_INVITE_TTL_DAYS,
            defaultValue: `Invites expire after ${ORG_INVITE_TTL_DAYS} days. Revoke one to stop the link working.`,
          })}
        </p>
      </div>
      {rows.map((invite) => {
        const name = inviteDisplayName(invite, unknown)
        const expired = inviteIsExpired(invite)
        const days = daysUntil(invite.expiresAt)
        const expiry = expired
          ? t("invites.expired", { defaultValue: "Expired" })
          : t("invites.expires_in", {
              count: days,
              defaultValue: days === 1 ? "Expires in 1 day" : `Expires in ${days} days`,
            })
        const sub = invite.invitedBy
          ? `${t("invites.invited_by", {
              name: invite.invitedBy.name,
              defaultValue: `Invited by ${invite.invitedBy.name}`,
            })} · ${expiry}`
          : expiry
        return (
          <QRow
            key={invite.id}
            title={name}
            ident={invite.user?.handle ? `@${invite.user.handle}` : undefined}
            sub={sub}
            chips={
              <>
                <Chip kind="org-role" value={invite.role} size="sm" />
                {expired ? (
                  <span className="inline-flex items-center rounded-pill border border-current/25 bg-console-surface-alt px-2 py-0.5 text-token-11 font-semibold text-console-ink-3">
                    {t("invites.status_expired", { defaultValue: "Expired" })}
                  </span>
                ) : null}
              </>
            }
            trailing={
              invite.status === "pending" ? (
                <ConsoleButton
                  variant="ghost"
                  size="sm"
                  disabled={isSuspended}
                  aria-label={t("invites.revoke_a11y", {
                    name,
                    defaultValue: `Revoke the invite for ${name}`,
                  })}
                  onClick={() => setPendingRevoke({ inviteId: invite.id, name })}
                >
                  {t("invites.revoke", { defaultValue: "Revoke" })}
                </ConsoleButton>
              ) : null
            }
          />
        )
      })}

      <ConfirmModal
        open={pendingRevoke !== null}
        severity="warn"
        title={t("invites.revoke_title", { defaultValue: "Revoke invite?" })}
        body={
          pendingRevoke
            ? t("invites.revoke_body", {
                name: pendingRevoke.name,
                defaultValue: `${pendingRevoke.name}'s invite link will stop working. You can invite them again later.`,
              })
            : ""
        }
        confirmLabel={t("invites.revoke", { defaultValue: "Revoke" })}
        busy={revoke.isPending}
        onCancel={() => setPendingRevoke(null)}
        onConfirm={() => {
          if (pendingRevoke) revoke.mutate(pendingRevoke)
        }}
      />
    </section>
  )
}
