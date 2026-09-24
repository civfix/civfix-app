"use client"

import { useState } from "react"
import { MailCheck } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  InviteOrganizationMemberResponse,
  OrgInviteIdentifierKind,
  OrganizationInviteDTO,
} from "@civfix/shared"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { fieldErrorsFrom } from "@/components/console/query-state"
import { ConsoleButton } from "@/components/console/button"
import { Chip } from "@/components/console/chips/chip"
import { Drawer } from "@/components/console/overlay/drawer"
import { useConsoleToast } from "@/components/console/overlay/toast"
import { Field } from "@/components/console/forms/field"
import { TextInput, Select } from "@/components/console/forms/inputs"
import { SegmentedControl } from "@/components/console/forms/segmented-control"

import { useConsoleErrors } from "../error-copy"
import { invalidateOrg } from "../console-invalidate"
import {
  INVITE_IDENTIFIER_MAX,
  ORG_INVITE_TTL_DAYS,
  daysUntil,
  normalizeInviteIdentifier,
} from "./org-invites"
import { suspendedForbiddenCopy } from "./org-copy"

export type InvitableRole = "admin" | "member"

export interface InviteMemberDrawerProps {
  orgId: string
  open: boolean
  onClose: () => void
  /** Suspended org: the server refuses the write, so the submit is disabled and FORBIDDEN mapped. */
  disabled?: boolean
}

/**
 * A handle that resolves to an existing member-to-be is added on the spot and the drawer closes; an
 * email (or a handle the server chose to invite rather than add) becomes a pending invite, which the
 * drawer shows in place so the host sees where it went and when it lapses before closing. The
 * pending-invite list under the roster refreshes through `invalidateOrg` either way.
 */
export function InviteMemberDrawer({ orgId, open, onClose, disabled = false }: InviteMemberDrawerProps) {
  const { t } = useT("host-org")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()

  const [identifierKind, setIdentifierKind] = useState<OrgInviteIdentifierKind>("handle")
  const [identifier, setIdentifier] = useState("")
  const [role, setRole] = useState<InvitableRole>("member")
  const [fields, setFields] = useState<Record<string, string>>({})
  const [sent, setSent] = useState<OrganizationInviteDTO | null>(null)

  const reset = () => {
    setIdentifier("")
    setFields({})
    setSent(null)
  }

  const invite = useMutation({
    mutationFn: () =>
      api.inviteOrganizationMember({
        id: orgId,
        identifierKind,
        identifier: normalizeInviteIdentifier(identifierKind, identifier),
        role,
      }),
    onSuccess: (result: InviteOrganizationMemberResponse) => {
      toast.toast({
        title: result.member
          ? t("invite.added", {
              name: result.member.person.name,
              defaultValue: `Added ${result.member.person.name}`,
            })
          : t("invite.sent", { defaultValue: "Invitation sent" }),
        tone: "success",
      })
      invalidateOrg(qc, orgId)
      if (result.invite) {
        setIdentifier("")
        setFields({})
        setSent(result.invite)
        return
      }
      reset()
      onClose()
    },
    onError: (err) => {
      setFields(fieldErrorsFrom(err))
      toast.toast({
        title: errors.message(err, {
          NOT_FOUND: t("invite.error_not_found", {
            defaultValue: "We could not find anyone with that handle.",
          }),
          CONFLICT: t("invite.error_conflict", {
            defaultValue: "They are already a member, or already have an open invitation.",
          }),
          ...(disabled ? { FORBIDDEN: suspendedForbiddenCopy(t) } : {}),
        }),
        tone: "danger",
      })
    },
  })

  const close = () => {
    if (invite.isPending) return
    reset()
    onClose()
  }

  const canSend = !disabled && identifier.trim().length > 0 && !invite.isPending

  return (
    <Drawer
      open={open}
      onClose={close}
      title={t("invite.title", { defaultValue: "Invite a member" })}
      footer={
        sent ? (
          <div className="flex items-center justify-end gap-token-2">
            <ConsoleButton variant="ghost" size="sm" onClick={() => setSent(null)}>
              {t("invite.another", { defaultValue: "Invite another" })}
            </ConsoleButton>
            <ConsoleButton size="sm" onClick={close}>
              {t("invite.done", { defaultValue: "Done" })}
            </ConsoleButton>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-token-2">
            <ConsoleButton variant="ghost" size="sm" onClick={close}>
              {tc("action.cancel")}
            </ConsoleButton>
            <ConsoleButton
              size="sm"
              disabled={!canSend}
              title={disabled ? suspendedForbiddenCopy(t) : undefined}
              onClick={() => invite.mutate()}
            >
              {t("invite.send", { defaultValue: "Send invite" })}
            </ConsoleButton>
          </div>
        )
      }
    >
      {sent ? (
        <SentInvite invite={sent} />
      ) : (
        <form
          noValidate
          className="flex flex-col gap-token-4 p-token-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (canSend) invite.mutate()
          }}
        >
          <Field label={t("invite.identifier_kind", { defaultValue: "Find them by" })}>
            <SegmentedControl
              label={t("invite.identifier_kind", { defaultValue: "Find them by" })}
              value={identifierKind}
              onChange={(next) => {
                setIdentifierKind(next)
                setFields({})
              }}
              options={[
                { value: "handle", label: t("invite.by_handle", { defaultValue: "civfix handle" }) },
                { value: "email", label: t("invite.by_email", { defaultValue: "Email" }) },
              ]}
            />
          </Field>
          <Field
            label={
              identifierKind === "handle"
                ? t("invite.handle", { defaultValue: "Handle" })
                : t("invite.email", { defaultValue: "Email address" })
            }
            htmlFor="org-invite-identifier"
            error={fields.identifier}
            hint={
              identifierKind === "email"
                ? t("invite.email_hint", {
                    days: ORG_INVITE_TTL_DAYS,
                    defaultValue: `We'll email them an invite; it expires in ${ORG_INVITE_TTL_DAYS} days.`,
                  })
                : t("invite.handle_hint", { defaultValue: "The @handle on their civfix profile." })
            }
          >
            <TextInput
              id="org-invite-identifier"
              value={identifier}
              maxLength={INVITE_IDENTIFIER_MAX}
              autoComplete="off"
              autoCapitalize="none"
              type={identifierKind === "email" ? "email" : "text"}
              placeholder={identifierKind === "email" ? "name@example.org" : "@handle"}
              invalid={Boolean(fields.identifier)}
              disabled={disabled}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </Field>
          <Field
            label={t("invite.role", { defaultValue: "Role" })}
            htmlFor="org-invite-role"
            hint={
              role === "admin"
                ? t("invite.role_admin_hint", {
                    defaultValue:
                      "Admins edit the profile, apply for verification and invite members.",
                  })
                : t("invite.role_member_hint", {
                    defaultValue: "Members see the organization's events and roster.",
                  })
            }
          >
            <Select
              id="org-invite-role"
              value={role}
              disabled={disabled}
              onChange={(event) => setRole(event.target.value as InvitableRole)}
              options={[
                { value: "member", label: t("enums:organizationMemberRole.member") },
                { value: "admin", label: t("enums:organizationMemberRole.admin") },
              ]}
            />
          </Field>
          {disabled ? (
            <p role="status" className="text-token-12 text-console-ink-3">
              {suspendedForbiddenCopy(t)}
            </p>
          ) : null}
        </form>
      )}
    </Drawer>
  )
}

function SentInvite({ invite }: { invite: OrganizationInviteDTO }) {
  const { t } = useT("host-org")
  const days = Math.max(1, daysUntil(invite.expiresAt))
  const recipient = invite.user?.name ?? invite.email ?? ""
  return (
    <div
      role="status"
      data-testid="org-invite-sent"
      className="flex flex-col gap-token-4 p-token-4"
    >
      <div className="flex items-start gap-token-3 rounded-sm border border-console-moss-strong/40 bg-console-moss-soft px-token-4 py-token-3">
        <MailCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-console-moss-strong" />
        <div className="min-w-0 flex-1">
          <p className="text-token-13 font-bold text-console-moss-strong">
            {t("invite.sent", { defaultValue: "Invitation sent" })}
          </p>
          <p className="text-token-12 text-console-ink-2">
            {invite.email
              ? t("invite.sent_email_body", {
                  email: invite.email,
                  count: days,
                  defaultValue: `We emailed ${invite.email} an invite; it expires in ${days} ${days === 1 ? "day" : "days"}.`,
                })
              : t("invite.sent_user_body", {
                  name: recipient,
                  count: days,
                  defaultValue: `We sent ${recipient} an invite; it expires in ${days} ${days === 1 ? "day" : "days"}.`,
                })}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-token-4 gap-y-token-2 text-token-13">
        <dt className="text-console-ink-3">{t("invite.sent_to", { defaultValue: "Sent to" })}</dt>
        <dd className="min-w-0 break-words font-semibold text-console-ink">
          {recipient}
          {invite.user?.handle ? (
            <span className="ml-token-2 font-normal text-console-ink-3">{`@${invite.user.handle}`}</span>
          ) : null}
        </dd>
        <dt className="text-console-ink-3">{t("invite.role", { defaultValue: "Role" })}</dt>
        <dd>
          <Chip kind="org-role" value={invite.role} size="sm" />
        </dd>
      </dl>
      <p className="text-token-12 text-console-ink-3">
        {t("invite.sent_hint", {
          defaultValue:
            "They accept by signing in to civfix with the invited address. You can revoke it from the pending invites list.",
        })}
      </p>
    </div>
  )
}
