"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { MAX_EVENT_REMINDER_OFFSETS } from "@civfix/shared"
import type { CleanupDTO, EventVisibility, OrganizationDTO } from "@civfix/shared"
import { datetimeLocalFromIso } from "@civfix/shared/datetime"
import { useApi, useMyOrganizations } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { EMAIL_MAX_LENGTH, HTTPS_URL_MAX_LENGTH } from "@/lib/input-limits"
import { fieldErrorsFrom } from "@/components/console/query-state"
import { ConsoleButton } from "@/components/console/button"
import { Field } from "@/components/console/forms/field"
import { TextInput, Select } from "@/components/console/forms/inputs"
import { SegmentedControl } from "@/components/console/forms/segmented-control"
import { ChipMultiSelect } from "@/components/console/forms/chip-multi-select"
import { ConfirmModal } from "@/components/console/overlay/confirm-modal"
import { useConsoleToast } from "@/components/console/overlay/toast"

import { useConsoleEvent, useConsoleNavigation } from "../console-context"
import { ConsoleLink } from "../layout/console-link"
import { hrefForRoute } from "@/components/console/route"
import { useConsoleErrors } from "../error-copy"
import { invalidateEvent } from "../console-invalidate"
import {
  useConsoleInputZone,
  useInputZoneNames,
  zonedFieldPatch,
} from "../format"
import type { ZonedFieldPatch } from "../format"

const REMINDER_OFFSETS = [60, 180, 1440, 2880, 10080] as const

interface RegistrationWindow {
  registrationOpensAt: string
  registrationClosesAt: string
}

interface SettingsDraft {
  visibility: EventVisibility
  opensAt: string
  closesAt: string
  donationUrl: string
  reminders: string[]
  organizationId: string
}

function settingsDraftFrom(event: CleanupDTO, zone: string): SettingsDraft {
  return {
    visibility: event.visibility,
    opensAt: datetimeLocalFromIso(event.registrationOpensAt, zone),
    closesAt: datetimeLocalFromIso(event.registrationClosesAt, zone),
    donationUrl: event.donationUrl ?? "",
    reminders: (event.reminderOffsetsMinutes ?? []).map(String),
    organizationId: event.organization?.id ?? "",
  }
}

function settingsDraftDiffers(draft: SettingsDraft, saved: SettingsDraft): boolean {
  return (
    draft.visibility !== saved.visibility ||
    draft.opensAt !== saved.opensAt ||
    draft.closesAt !== saved.closesAt ||
    draft.donationUrl !== saved.donationUrl ||
    draft.reminders.join(",") !== saved.reminders.join(",") ||
    draft.organizationId !== saved.organizationId
  )
}

export function SettingsScreen() {
  const { t } = useT("host-settings")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const { eventId, event, can } = useConsoleEvent()
  const { go } = useConsoleNavigation()
  const { t: to } = useT("host-org")
  const zone = useConsoleInputZone(event.timezone)

  const canLinkOrg = can("manage_org_link")
  const orgs = useMyOrganizations()
  // A suspended org refuses every write, so it cannot be picked; one that is ALREADY linked stays
  // in the list (disabled, with a hint) so the current value is never silently blank.
  const myOrgs: OrganizationDTO[] = orgs.data ?? []
  const linkableOrgs = myOrgs.filter(
    (org) => (org.myRole === "owner" || org.myRole === "admin") && org.suspended !== true,
  )
  const linkedOrg = event.organization ?? null
  const linkedSuspended =
    linkedOrg !== null && myOrgs.some((org) => org.id === linkedOrg.id && org.suspended === true)

  const [visibility, setVisibility] = useState<EventVisibility>("public")
  const [opensAt, setOpensAt] = useState("")
  const [closesAt, setClosesAt] = useState("")
  const [savedWindow, setSavedWindow] = useState<RegistrationWindow>({
    registrationOpensAt: "",
    registrationClosesAt: "",
  })
  const [donationUrl, setDonationUrl] = useState("")
  const [replyTo, setReplyTo] = useState("")
  const [reminders, setReminders] = useState<string[]>([])
  const [organizationId, setOrganizationId] = useState("")
  const [fields, setFields] = useState<Record<string, string>>({})
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [seededFrom, setSeededFrom] = useState<CleanupDTO | null>(null)

  // A refetch reseeds the form only while it still matches the event it was seeded from, so a server
  // change shows up without ever overwriting the host's unsaved edits.
  if (event && event !== seededFrom) {
    setSeededFrom(event)
    const draft = { visibility, opensAt, closesAt, donationUrl, reminders, organizationId }
    if (seededFrom === null || !settingsDraftDiffers(draft, settingsDraftFrom(seededFrom, zone))) {
      const next = settingsDraftFrom(event, zone)
      setVisibility(next.visibility)
      setOpensAt(next.opensAt)
      setClosesAt(next.closesAt)
      setSavedWindow({ registrationOpensAt: next.opensAt, registrationClosesAt: next.closesAt })
      setDonationUrl(next.donationUrl)
      setReminders(next.reminders)
      setOrganizationId(next.organizationId)
    }
  }

  const zoneNames = useInputZoneNames(zone, [opensAt, closesAt], event.scheduledAt)
  const currentWindow = { registrationOpensAt: opensAt, registrationClosesAt: closesAt }
  const windowPatch = zonedFieldPatch(savedWindow, currentWindow, zone)

  const save = useMutation({
    mutationFn: ({
      patch,
    }: {
      patch: ZonedFieldPatch<keyof RegistrationWindow>["patch"]
      window: RegistrationWindow
    }) =>
      api.updateCleanup({
        id: eventId,
        visibility,
        ...patch,
        donationUrl: donationUrl.trim() === "" ? null : donationUrl.trim(),
        reminderOffsetsMinutes: reminders.length > 0 ? reminders.map(Number) : null,
        ...(replyTo.trim() !== "" ? { hostReplyTo: replyTo.trim() } : {}),
        ...(canLinkOrg ? { organizationId: organizationId === "" ? null : organizationId } : {}),
      }),
    onSuccess: (_result, { window: savedInputs }) => {
      toast.toast({ title: t("saved"), tone: "success" })
      setSavedWindow(savedInputs)
      setFields({})
      invalidateEvent(qc, eventId)
    },
    onError: (err) => {
      setFields(fieldErrorsFrom(err))
      toast.toast({ title: errors.message(err), tone: "danger" })
    },
  })

  const onSave = () => {
    if (windowPatch.invalid.length > 0) {
      const message = t("registration.time_not_in_zone", { zone: zoneNames.name })
      setFields(Object.fromEntries(windowPatch.invalid.map((field) => [field, message])))
      return
    }
    save.mutate({ patch: windowPatch.patch, window: currentWindow })
  }

  const cancelEvent = useMutation({
    mutationFn: (reason: string | undefined) =>
      api.cancelCleanup({ id: eventId, ...(reason ? { reason } : {}) }),
    onSuccess: () => {
      toast.toast({ title: t("danger.cancelled"), tone: "success" })
      setConfirmCancel(false)
      invalidateEvent(qc, eventId)
      go({ kind: "portfolio" })
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  return (
    <div className="flex flex-col gap-token-5">
      <section className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1">
        <h2 className="mb-token-4 font-display text-token-16 font-bold text-console-ink">
          {t("registration.title")}
        </h2>
        <div className="flex flex-col gap-token-4">
          <Field label={t("registration.visibility")}>
            <SegmentedControl
              label={t("registration.visibility")}
              value={visibility}
              onChange={setVisibility}
              options={[
                { value: "public", label: t("visibility.public") },
                { value: "unlisted", label: t("visibility.unlisted") },
                { value: "private", label: t("visibility.private") },
              ]}
            />
          </Field>
          <div className="grid gap-token-3 sm:grid-cols-2">
            <Field
              label={t("registration.opens")}
              htmlFor="settings-opens"
              optional
              error={fields.registrationOpensAt}
            >
              <TextInput
                id="settings-opens"
                type="datetime-local"
                value={opensAt}
                onChange={(event) => setOpensAt(event.target.value)}
              />
            </Field>
            <Field
              label={t("registration.closes")}
              htmlFor="settings-closes"
              optional
              error={fields.registrationClosesAt}
            >
              <TextInput
                id="settings-closes"
                type="datetime-local"
                value={closesAt}
                onChange={(event) => setClosesAt(event.target.value)}
              />
            </Field>
          </div>
          {zoneNames.hint ? (
            <p className="text-token-12 text-console-ink-3">
              {t("registration.zone_hint", { zone: zoneNames.hint })}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1">
        <h2 className="mb-token-4 font-display text-token-16 font-bold text-console-ink">
          {t("messaging.title")}
        </h2>
        <div className="flex flex-col gap-token-4">
          <Field
            label={t("messaging.reminders")}
            hint={`${t("messaging.reminders_hint")} ${t("messaging.reminders_max", {
              count: MAX_EVENT_REMINDER_OFFSETS,
            })}`}
            error={fields.reminderOffsetsMinutes}
          >
            <ChipMultiSelect
              label={t("messaging.reminders")}
              values={reminders}
              onChange={setReminders}
              options={REMINDER_OFFSETS.map((minutes) => ({
                value: String(minutes),
                label: t(`messaging.offset_${minutes}`),
                disabled:
                  !reminders.includes(String(minutes)) &&
                  reminders.length >= MAX_EVENT_REMINDER_OFFSETS,
              }))}
            />
          </Field>
          <Field
            label={t("messaging.reply_to")}
            htmlFor="settings-reply-to"
            optional
            hint={t("messaging.reply_to_unverified")}
            error={fields.hostReplyTo}
          >
            <TextInput
              id="settings-reply-to"
              type="email"
              maxLength={EMAIL_MAX_LENGTH}
              value={replyTo}
              placeholder={t("messaging.reply_to_placeholder")}
              onChange={(event) => setReplyTo(event.target.value)}
            />
          </Field>
        </div>
      </section>

      {canLinkOrg ? (
        <section className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1">
          <h2 className="mb-token-1 font-display text-token-16 font-bold text-console-ink">
            {to("event_link.title", { defaultValue: "Organization" })}
          </h2>
          <p className="mb-token-4 text-token-13 text-console-ink-3">
            {to("event_link.body", {
              defaultValue:
                "Host this event under an organization: it carries the organization's name and verification badge, and its admins can manage the event.",
            })}
          </p>
          <Field
            label={to("event_link.field", { defaultValue: "Hosted by" })}
            htmlFor="settings-organization"
            error={fields.organizationId}
            hint={
              linkedOrg && linkedSuspended
                ? to("event_link.current_suspended", {
                    name: linkedOrg.name,
                    defaultValue: `Linked to ${linkedOrg.name}, which is suspended: it stays linked, but it can't be chosen again once unlinked.`,
                  })
                : linkedOrg
                  ? to("event_link.current", {
                      name: linkedOrg.name,
                      defaultValue: `Currently linked to ${linkedOrg.name}.`,
                    })
                  : to("event_link.personal_hint", {
                      defaultValue: "Personal events are hosted under your own name.",
                    })
            }
          >
            <Select
              id="settings-organization"
              value={organizationId}
              disabled={orgs.isPending}
              onChange={(changeEvent) => setOrganizationId(changeEvent.target.value)}
              options={[
                {
                  value: "",
                  label: to("event_link.personal", { defaultValue: "Personal (no organization)" }),
                },
                ...linkableOrgs.map((org) => ({ value: org.id, label: org.name })),
                ...(linkedOrg && !linkableOrgs.some((org) => org.id === linkedOrg.id)
                  ? [{ value: linkedOrg.id, label: linkedOrg.name, disabled: linkedSuspended }]
                  : []),
              ]}
            />
          </Field>
          {linkableOrgs.length === 0 && !orgs.isPending ? (
            <p className="mt-token-2 text-token-12 text-console-ink-3">
              {to("event_link.none", {
                defaultValue: "You are not an owner or admin of any organization yet.",
              })}{" "}
              <ConsoleLink
                href={hrefForRoute({ kind: "org-new" })}
                className="rounded-xs font-semibold text-console-sky-strong underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
              >
                {to("event_link.create", { defaultValue: "Create one" })}
              </ConsoleLink>
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1">
        <h2 className="mb-token-4 font-display text-token-16 font-bold text-console-ink">
          {t("donations.title")}
        </h2>
        <Field
          label={t("donations.link")}
          htmlFor="settings-donation-url"
          optional
          hint={t("donations.link_hint")}
          error={fields.donationUrl}
        >
          <TextInput
            id="settings-donation-url"
            value={donationUrl}
            placeholder="https://"
            maxLength={HTTPS_URL_MAX_LENGTH}
            onChange={(event) => setDonationUrl(event.target.value)}
          />
        </Field>
        {event.organization?.donationUrl ? (
          <p className="mt-token-2 text-token-12 text-console-ink-3">
            {t("donations.org_fallback", { org: event.organization.name })}
          </p>
        ) : null}
      </section>

      <div className="flex justify-end">
        <ConsoleButton disabled={save.isPending} onClick={onSave}>
          {tc("action.save")}
        </ConsoleButton>
      </div>

      <section className="rounded-md border border-console-bloom-strong/40 bg-console-bloom-soft p-token-4">
        <h2 className="mb-token-2 font-display text-token-16 font-bold text-console-bloom-strong">
          {t("danger.title")}
        </h2>
        <p className="mb-token-3 text-token-13 text-console-ink-2">{t("danger.body")}</p>
        <ConsoleButton
          variant="destructive"
          size="sm"
          disabled={event.status === "cancelled"}
          onClick={() => setConfirmCancel(true)}
        >
          {t("danger.cancel_event")}
        </ConsoleButton>
      </section>

      <ConfirmModal
        open={confirmCancel}
        severity="danger"
        title={t("danger.confirm_title")}
        body={t("danger.confirm_body")}
        banner={t("danger.confirm_banner")}
        reasonField={{ label: t("danger.reason"), required: false }}
        agreement={{ label: t("danger.agreement") }}
        confirmLabel={t("danger.cancel_event")}
        busy={cancelEvent.isPending}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={(payload) => cancelEvent.mutate(payload.reason)}
      />
    </div>
  )
}
