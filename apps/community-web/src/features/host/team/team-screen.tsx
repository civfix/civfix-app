"use client"

import { useState } from "react"
import { UserPlus } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { EventTeamRole } from "@civfix/shared"
import {
  INVITABLE_EVENT_TEAM_ROLES,
  SETTABLE_EVENT_MEMBER_ROLES,
  useApi,
  type SettableEventMemberRole,
} from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { useGate, fieldErrorsFrom } from "@/components/console/query-state"
import { EmptyState, LoadingState, StateGate } from "@/components/console/states"
import { ConsoleButton } from "@/components/console/button"
import { Chip } from "@/components/console/chips/chip"
import { QRow } from "@/components/console/qrow"
import { Drawer } from "@/components/console/overlay/drawer"
import { ConfirmModal } from "@/components/console/overlay/confirm-modal"
import { useConsoleTeam } from "./use-team"
import { useConsoleToast } from "@/components/console/overlay/toast"
import { Field } from "@/components/console/forms/field"
import { TextInput, Select } from "@/components/console/forms/inputs"
import { SegmentedControl } from "@/components/console/forms/segmented-control"

import { useConsoleEvent } from "../console-context"
import { useConsoleErrors } from "../error-copy"
import { useConsoleFormat } from "../format"
import { invalidateEvent } from "../console-invalidate"
import { INVITE_IDENTIFIER_MAX, normalizeInviteIdentifier } from "../org/org-invites"

interface PendingRoleChange {
  userId: string
  name: string
  role: SettableEventMemberRole
}

export function TeamScreen() {
  const { t } = useT("host-team")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const format = useConsoleFormat()
  const { eventId } = useConsoleEvent()

  const team = useConsoleTeam(eventId)
  const gate = useGate(team)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [identifierKind, setIdentifierKind] = useState<"handle" | "email">("handle")
  const [identifier, setIdentifier] = useState("")
  const [role, setRole] = useState<EventTeamRole>("staff")
  const [fields, setFields] = useState<Record<string, string>>({})
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null)
  const [pendingRole, setPendingRole] = useState<PendingRoleChange | null>(null)

  const invite = useMutation({
    mutationFn: () =>
      api.inviteEventTeamMember({
        id: eventId,
        identifierKind,
        identifier: normalizeInviteIdentifier(identifierKind, identifier),
        role,
      }),
    onSuccess: () => {
      toast.toast({ title: t("invite.sent"), tone: "success" })
      setInviteOpen(false)
      setIdentifier("")
      setFields({})
      invalidateEvent(qc, eventId)
    },
    onError: (err) => {
      setFields(fieldErrorsFrom(err))
      toast.toast({ title: errors.message(err), tone: "danger" })
    },
  })

  const revoke = useMutation({
    mutationFn: (inviteId: string) => api.revokeEventTeamInvite({ id: eventId, inviteId }),
    onSuccess: () => {
      toast.toast({ title: t("invite.revoked"), tone: "success" })
      setPendingRevoke(null)
      invalidateEvent(qc, eventId)
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  const setRoleFor = useMutation({
    mutationFn: (input: PendingRoleChange) =>
      api.setCleanupMemberRole({ id: eventId, userId: input.userId, role: input.role }),
    onSuccess: () => {
      toast.toast({ title: t("role.updated"), tone: "success" })
      setPendingRole(null)
      invalidateEvent(qc, eventId)
    },
    onError: (err) => {
      setPendingRole(null)
      toast.toast({
        title: errors.message(err, {
          CONFLICT: t("role.error_conflict"),
          FORBIDDEN: t("role.error_forbidden"),
        }),
        tone: "danger",
      })
    },
  })

  return (
    <div className="flex flex-col gap-token-5">
      <section className="rounded-md border border-console-line bg-console-surface shadow-console-1">
        <div className="flex flex-wrap items-center justify-between gap-token-3 border-b border-console-line px-token-4 py-token-3">
          <h2 className="font-display text-token-16 font-bold text-console-ink">
            {t("members.title")}
          </h2>
          <ConsoleButton size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus aria-hidden className="h-4 w-4" />
            {t("invite.action")}
          </ConsoleButton>
        </div>
        <StateGate
          {...gate}
          onRetry={() => void team.refetch()}
          skeleton={<LoadingState count={4} className="p-token-4" />}
          empty={(team.data?.members.length ?? 0) === 0}
          emptyState={
            <div className="p-token-4">
              <EmptyState title={t("members.empty_title")} body={t("members.empty_body")} />
            </div>
          }
        >
          {(team.data?.members ?? []).map((member) => (
            <QRow
              key={member.person.id}
              title={member.person.name}
              sub={
                member.joinedAt ? t("members.joined", { when: format.date(member.joinedAt) }) : ""
              }
              chips={<Chip kind="team-role" value={member.role} size="sm" />}
              trailing={
                member.canChangeRole && member.role !== "organizer" ? (
                  <Select
                    aria-label={t("role.change_a11y", { name: member.person.name })}
                    className="h-8 w-32"
                    value={member.role}
                    disabled={setRoleFor.isPending}
                    onChange={(event) =>
                      setPendingRole({
                        userId: member.person.id,
                        name: member.person.name,
                        role: event.target.value as SettableEventMemberRole,
                      })
                    }
                    options={SETTABLE_EVENT_MEMBER_ROLES.map((value) => ({
                      value,
                      label: t(`role.${value}`),
                    }))}
                  />
                ) : null
              }
            />
          ))}
        </StateGate>
      </section>

      {(team.data?.invites.length ?? 0) > 0 ? (
        <section className="rounded-md border border-console-line bg-console-surface shadow-console-1">
          <h2 className="border-b border-console-line px-token-4 py-token-3 font-display text-token-16 font-bold text-console-ink">
            {t("invites.title")}
          </h2>
          {(team.data?.invites ?? []).map((row) => (
            <QRow
              key={row.id}
              title={row.invitee?.name ?? row.maskedEmail ?? t("invites.unknown")}
              sub={t("invites.sent", { when: format.date(row.createdAt) })}
              chips={<Chip kind="team-role" value={row.role} size="sm" />}
              trailing={
                row.status === "pending" ? (
                  <ConsoleButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingRevoke(row.id)}
                  >
                    {t("invites.revoke")}
                  </ConsoleButton>
                ) : (
                  <span className="text-token-12 text-console-ink-3">
                    {t(`invites.status_${row.status}`)}
                  </span>
                )
              }
            />
          ))}
        </section>
      ) : null}

      <Drawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={t("invite.title")}
        footer={
          <div className="flex items-center justify-end gap-token-2">
            <ConsoleButton variant="ghost" size="sm" onClick={() => setInviteOpen(false)}>
              {tc("action.cancel")}
            </ConsoleButton>
            <ConsoleButton
              size="sm"
              disabled={identifier.trim().length === 0 || invite.isPending}
              onClick={() => invite.mutate()}
            >
              {t("invite.send")}
            </ConsoleButton>
          </div>
        }
      >
        <div className="flex flex-col gap-token-4 p-token-4">
          <Field label={t("invite.identifier_kind")}>
            <SegmentedControl
              label={t("invite.identifier_kind")}
              value={identifierKind}
              onChange={setIdentifierKind}
              options={[
                { value: "handle", label: t("invite.by_handle") },
                { value: "email", label: t("invite.by_email") },
              ]}
            />
          </Field>
          <Field
            label={identifierKind === "handle" ? t("invite.handle") : t("invite.email")}
            htmlFor="invite-identifier"
            error={fields.identifier}
          >
            <TextInput
              id="invite-identifier"
              value={identifier}
              maxLength={INVITE_IDENTIFIER_MAX}
              autoComplete="off"
              type={identifierKind === "email" ? "email" : "text"}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </Field>
          <Field label={t("invite.role")} htmlFor="invite-role" hint={t(`role.hint_${role}`)}>
            <Select
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value as EventTeamRole)}
              options={INVITABLE_EVENT_TEAM_ROLES.map((value) => ({
                value,
                label: t(`role.${value}`),
              }))}
            />
          </Field>
          <p className="text-token-12 text-console-ink-3">{t("invite.privacy_note")}</p>
        </div>
      </Drawer>

      <ConfirmModal
        open={pendingRole !== null}
        severity="warn"
        title={t("role.confirm_title")}
        body={
          pendingRole
            ? t("role.confirm_body", {
                name: pendingRole.name,
                role: t(`role.${pendingRole.role}`),
              })
            : ""
        }
        confirmLabel={t("role.confirm_action")}
        busy={setRoleFor.isPending}
        onCancel={() => setPendingRole(null)}
        onConfirm={() => {
          if (pendingRole) setRoleFor.mutate(pendingRole)
        }}
      />

      <ConfirmModal
        open={pendingRevoke !== null}
        severity="warn"
        title={t("invites.revoke_title")}
        body={t("invites.revoke_body")}
        confirmLabel={t("invites.revoke")}
        busy={revoke.isPending}
        onCancel={() => setPendingRevoke(null)}
        onConfirm={() => {
          if (pendingRevoke) revoke.mutate(pendingRevoke)
        }}
      />
    </div>
  )
}
