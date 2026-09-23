"use client"

import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { TicketTypeDTO, TicketTypeVisibility } from "@civfix/shared"
import {
  CreateEventTicketTypeRequestSchema,
  MAX_PARTY_SIZE,
  MAX_TICKET_TYPE_DESCRIPTION,
  MAX_TICKET_TYPE_NAME,
} from "@civfix/shared"
import { useApi, useAuthState } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { Drawer } from "@/components/console/overlay/drawer"
import { useConsoleToast } from "@/components/console/overlay/toast"
import { ConsoleButton } from "@/components/console/button"
import { Field } from "@/components/console/forms/field"
import { TextInput, TextArea, Select } from "@/components/console/forms/inputs"
import { ToggleRow } from "@/components/console/forms/toggle-row"
import { ErrorSummary } from "@/components/console/forms/error-summary"
import type { FieldError } from "@/components/console/forms/error-summary"
import { DraftRestoredBar } from "@/components/console/forms/draft-restored-bar"
import { useDraft, consoleDraftKey } from "@/components/console/use-draft"
import { fieldErrorsFrom } from "@/components/console/query-state"

import { useConsoleErrors } from "../error-copy"
import { invalidateEvent } from "../console-invalidate"
import { useConsoleEvent } from "../console-context"
import {
  isoToZonedInput,
  useConsoleFormat,
  useConsoleInputZone,
  zonedFieldPatch,
} from "../format"

interface TicketDraft {
  name: string
  description: string
  capacity: string
  salesOpensAt: string
  salesClosesAt: string
  visibility: TicketTypeVisibility
  accessCode: string
  maxPartySize: number
  waitlistEnabled: boolean
}

const EMPTY_DRAFT: TicketDraft = {
  name: "",
  description: "",
  capacity: "",
  salesOpensAt: "",
  salesClosesAt: "",
  visibility: "public",
  accessCode: "",
  maxPartySize: 1,
  waitlistEnabled: false,
}

function draftFrom(type: TicketTypeDTO | null, timeZone: string): TicketDraft {
  if (!type) return EMPTY_DRAFT
  return {
    name: type.name,
    description: type.description ?? "",
    capacity: type.capacity === null || type.capacity === undefined ? "" : String(type.capacity),
    salesOpensAt: isoToZonedInput(type.salesOpensAt, timeZone),
    salesClosesAt: isoToZonedInput(type.salesClosesAt, timeZone),
    visibility: type.visibility,
    accessCode: "",
    maxPartySize: type.maxPartySize,
    waitlistEnabled: type.waitlistEnabled,
  }
}

export interface TicketTypeDrawerProps {
  eventId: string
  ticketType: TicketTypeDTO | null
  open: boolean
  onClose: () => void
}

export function TicketTypeDrawer({ eventId, ticketType, open, onClose }: TicketTypeDrawerProps) {
  const { t } = useT("host-tickets")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const viewerId = useAuthState().user?.id ?? null
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const zone = useConsoleInputZone(useConsoleEvent().event?.timezone)
  const zoneName = useConsoleFormat(zone).zoneLabel(new Date().toISOString())

  // v2 scope: drafts saved before the event-zone fix hold sales times as UTC wall clocks.
  const draftKey = consoleDraftKey(`ticket.v2.${eventId}`, ticketType?.id ?? "new", viewerId)
  const initial = useMemo(() => draftFrom(ticketType, zone), [ticketType, zone])
  const { draft, patch, restored, dismissRestored, clear } = useDraft(draftKey, initial)
  const [serverFields, setServerFields] = useState<Record<string, string>>({})
  const [submitCount, setSubmitCount] = useState(0)

  const sales = useMemo(() => {
    const pick = (from: TicketDraft) => ({
      salesOpensAt: from.salesOpensAt,
      salesClosesAt: from.salesClosesAt,
    })
    return {
      changed: zonedFieldPatch(ticketType ? pick(initial) : null, pick(draft), zone),
      all: zonedFieldPatch(null, pick(draft), zone).patch,
    }
  }, [draft, initial, ticketType, zone])

  const localErrors = useMemo(() => {
    const parsed = CreateEventTicketTypeRequestSchema.safeParse({
      id: eventId,
      name: draft.name.trim(),
      ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
      ...(draft.capacity ? { capacity: Number(draft.capacity) } : {}),
      ...(sales.all.salesOpensAt ? { salesOpensAt: sales.all.salesOpensAt } : {}),
      ...(sales.all.salesClosesAt ? { salesClosesAt: sales.all.salesClosesAt } : {}),
      visibility: draft.visibility,
      ...(draft.accessCode ? { accessCode: draft.accessCode } : {}),
      maxPartySize: draft.maxPartySize,
      waitlistEnabled: draft.waitlistEnabled,
    })
    const out: Record<string, string> = {}
    for (const bound of sales.changed.invalid) {
      out[bound] = t("field.sales_time_not_in_zone", { zone: zoneName ?? zone })
    }
    if (parsed.success) return out
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form")
      if (!out[key]) out[key] = issue.message
    }
    return out
  }, [draft, eventId, sales, t, zone, zoneName])

  const fieldErrors = { ...localErrors, ...serverFields }
  const summary: FieldError[] = Object.entries(fieldErrors).map(([key, message]) => ({
    id: `ticket-${key}`,
    message: `${t(`field.${key}`, { defaultValue: key })}: ${message}`,
  }))

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: draft.name.trim(),
        description: draft.description.trim() === "" ? null : draft.description.trim(),
        capacity: draft.capacity === "" ? null : Number(draft.capacity),
        ...sales.changed.patch,
        visibility: draft.visibility,
        maxPartySize: draft.maxPartySize,
        waitlistEnabled: draft.waitlistEnabled,
        ...(draft.accessCode.trim() !== "" ? { accessCode: draft.accessCode.trim() } : {}),
      }
      if (ticketType) {
        return api.updateEventTicketType({ id: eventId, ticketTypeId: ticketType.id, ...body })
      }
      return api.createEventTicketType({ id: eventId, ...body })
    },
    onSuccess: () => {
      toast.toast({ title: ticketType ? t("saved") : t("created"), tone: "success" })
      setServerFields({})
      clear()
      invalidateEvent(qc, eventId)
      onClose()
    },
    onError: (err) => {
      setServerFields(fieldErrorsFrom(err))
      toast.toast({ title: errors.message(err), tone: "danger" })
    },
  })

  const submit = () => {
    setSubmitCount((count) => count + 1)
    if (Object.keys(localErrors).length > 0) return
    save.mutate()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={ticketType ? t("drawer.edit_title") : t("drawer.new_title")}
      footer={
        <div className="flex items-center justify-end gap-token-2">
          <ConsoleButton variant="ghost" size="sm" onClick={onClose}>
            {tc("action.cancel")}
          </ConsoleButton>
          <ConsoleButton size="sm" disabled={save.isPending} onClick={submit}>
            {tc("action.save")}
          </ConsoleButton>
        </div>
      }
    >
      <div className="flex flex-col gap-token-4 p-token-4">
        {restored ? <DraftRestoredBar onDiscard={() => { clear(); dismissRestored() }} /> : null}
        <ErrorSummary errors={submitCount > 0 ? summary : []} submitCount={submitCount} />

        <Field
          announceError={false}
          label={t("field.name")}
          htmlFor="ticket-name"
          error={submitCount > 0 ? fieldErrors.name : undefined}
          counter={`${draft.name.length}/${MAX_TICKET_TYPE_NAME}`}
        >
          <TextInput
            id="ticket-name"
            value={draft.name}
            maxLength={MAX_TICKET_TYPE_NAME}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </Field>

        <Field
          announceError={false}
          label={t("field.description")}
          htmlFor="ticket-description"
          optional
          counter={`${draft.description.length}/${MAX_TICKET_TYPE_DESCRIPTION}`}
        >
          <TextArea
            id="ticket-description"
            value={draft.description}
            maxLength={MAX_TICKET_TYPE_DESCRIPTION}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </Field>

        <Field
          announceError={false}
          label={t("field.capacity")}
          htmlFor="ticket-capacity"
          optional
          hint={t("field.capacity_hint")}
          error={submitCount > 0 ? fieldErrors.capacity : undefined}
        >
          <TextInput
            id="ticket-capacity"
            type="number"
            min={1}
            value={draft.capacity}
            onChange={(event) => patch({ capacity: event.target.value })}
          />
        </Field>

        <div className="grid gap-token-3 sm:grid-cols-2">
          <Field
            announceError={false}
            label={t("field.sales_opens")}
            htmlFor="ticket-opens"
            optional
            error={submitCount > 0 ? fieldErrors.salesOpensAt : undefined}
          >
            <TextInput
              id="ticket-opens"
              type="datetime-local"
              value={draft.salesOpensAt}
              onChange={(event) => patch({ salesOpensAt: event.target.value })}
            />
          </Field>
          <Field
            announceError={false}
            label={t("field.sales_closes")}
            htmlFor="ticket-closes"
            optional
            error={submitCount > 0 ? fieldErrors.salesClosesAt : undefined}
          >
            <TextInput
              id="ticket-closes"
              type="datetime-local"
              value={draft.salesClosesAt}
              onChange={(event) => patch({ salesClosesAt: event.target.value })}
            />
          </Field>
        </div>
        {zoneName ? (
          <p className="-mt-token-2 text-token-12 text-console-ink-3">
            {t("field.sales_zone_hint", { zone: zoneName })}
          </p>
        ) : null}

        <Field announceError={false} label={t("field.visibility")} htmlFor="ticket-visibility">
          <Select
            id="ticket-visibility"
            value={draft.visibility}
            onChange={(event) =>
              patch({ visibility: event.target.value as TicketTypeVisibility })
            }
            options={[
              { value: "public", label: t("visibility.public") },
              { value: "hidden", label: t("visibility.hidden") },
              { value: "access_code", label: t("visibility.access_code") },
            ]}
          />
        </Field>

        {draft.visibility === "access_code" ? (
          <Field
            announceError={false}
            label={t("field.access_code")}
            htmlFor="ticket-access-code"
            hint={ticketType?.accessCodeSet ? t("field.access_code_set") : t("field.access_code_hint")}
            error={submitCount > 0 ? fieldErrors.accessCode : undefined}
          >
            <TextInput
              id="ticket-access-code"
              value={draft.accessCode}
              autoComplete="off"
              onChange={(event) => patch({ accessCode: event.target.value })}
            />
          </Field>
        ) : null}

        <Field
          announceError={false}
          label={t("field.max_party")}
          htmlFor="ticket-party"
          hint={t("field.max_party_hint", { max: MAX_PARTY_SIZE })}
        >
          <TextInput
            id="ticket-party"
            type="number"
            min={1}
            max={MAX_PARTY_SIZE}
            value={draft.maxPartySize}
            onChange={(event) =>
              patch({
                maxPartySize: Math.min(
                  MAX_PARTY_SIZE,
                  Math.max(1, Number(event.target.value) || 1),
                ),
              })
            }
          />
        </Field>

        <ToggleRow
          label={t("field.waitlist")}
          caption={t("field.waitlist_hint")}
          checked={draft.waitlistEnabled}
          onChange={(checked) => patch({ waitlistEnabled: checked })}
        />
      </div>
    </Drawer>
  )
}
