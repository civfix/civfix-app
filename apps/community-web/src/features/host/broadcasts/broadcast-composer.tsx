"use client"

import { useEffect, useMemo, useState } from "react"
import { Eye, Send, Clock, TestTube } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { BroadcastDTO, BroadcastPreviewDTO, BroadcastSegment } from "@civfix/shared"
import {
  HTTPS_URL_MAX_LENGTH,
  MAX_BROADCAST_BODY,
  MAX_BROADCAST_CTA_LABEL,
  MAX_BROADCAST_SUBJECT,
} from "@civfix/shared"
import { datetimeLocalFromIso, isoFromDatetimeLocal } from "@civfix/shared/datetime"
import { useApi, useAuthState, useEventTicketTypes } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"
import type { Translate } from "@civfix/ui/i18n"

import { fieldErrorsFrom } from "@/components/console/query-state"
import { ConsoleButton } from "@/components/console/button"
import { Chip } from "@/components/console/chips/chip"
import { Field } from "@/components/console/forms/field"
import { TextInput } from "@/components/console/forms/inputs"
import { SegmentedControl } from "@/components/console/forms/segmented-control"
import { ChipMultiSelect } from "@/components/console/forms/chip-multi-select"
import { ErrorSummary } from "@/components/console/forms/error-summary"
import { DraftRestoredBar } from "@/components/console/forms/draft-restored-bar"
import { RichTextEditor } from "@/components/console/forms/rich-text/editor"
import { MarkdownPreview } from "@/components/console/forms/rich-text/preview"
import { useDraft, consoleDraftKey } from "@/components/console/use-draft"
import { useConsoleToast } from "@/components/console/overlay/toast"
import { ConfirmModal } from "@/components/console/overlay/confirm-modal"

import { useConsoleEvent, useConsoleNavigation } from "../console-context"
import { useConsoleErrors } from "../error-copy"
import {
  useConsoleFormat,
  useConsoleInputZone,
  useInputZoneNames,
} from "../format"
import { consoleKeys } from "../console-keys"
import {
  AUDIENCE_KINDS,
  HOST_CHANNELS,
  audienceExcludesGuests,
  audienceFrom,
  broadcastCan,
  composerReadiness,
  composerReady,
  isHostChannel,
  segmentFrom,
} from "./audience"
import type { AudienceKind, AudienceState, ComposerReadiness, HostChannel } from "./audience"

/** The server's cap on test sends per broadcast; past it the button stays disabled. */
const TEST_SEND_CAP = 5

interface ComposerDraft {
  subject: string
  bodyMd: string
  ctaLabel: string
  ctaUrl: string
  audienceKind: AudienceKind
  ticketTypeIds: string[]
  slotIds: string[]
  channels: HostChannel[]
  scheduledAt: string
}

const EMPTY: ComposerDraft = {
  subject: "",
  bodyMd: "",
  ctaLabel: "",
  ctaUrl: "",
  audienceKind: "all_registered",
  ticketTypeIds: [],
  slotIds: [],
  channels: ["inapp", "push"],
  scheduledAt: "",
}

function draftFrom(broadcast: BroadcastDTO | null, timeZone: string): ComposerDraft {
  if (!broadcast) return EMPTY
  const audience = audienceFrom(broadcast.segment)
  return {
    subject: broadcast.subject ?? "",
    bodyMd: broadcast.bodyMd ?? "",
    ctaLabel: broadcast.ctaLabel ?? "",
    ctaUrl: broadcast.ctaUrl ?? "",
    audienceKind: audience.kind,
    ticketTypeIds: [...audience.ticketTypeIds],
    slotIds: [...audience.slotIds],
    channels: broadcast.channels.filter(isHostChannel),
    scheduledAt: datetimeLocalFromIso(broadcast.scheduledAt, timeZone),
  }
}

/**
 * Send, test send and schedule all act on the SAVED broadcast, so any unsaved change to what it
 * says or who gets it blocks them. The schedule time is left out: editing it is how scheduling
 * works, and it is sent with the schedule call itself.
 */
function composerContentChanged(draft: ComposerDraft, saved: ComposerDraft): boolean {
  const content = ({ scheduledAt: _scheduledAt, ...rest }: ComposerDraft) =>
    JSON.stringify({
      ...rest,
      ticketTypeIds: [...rest.ticketTypeIds].sort(),
      slotIds: [...rest.slotIds].sort(),
      channels: [...rest.channels].sort(),
    })
  return content(draft) !== content(saved)
}

/** An untouched time is sent back exactly as stored, so re-scheduling cannot drift. */
function scheduleInstant(
  draftValue: string,
  saved: { input: string; iso: string | null },
  timeZone: string,
): string | null {
  if (saved.iso !== null && draftValue === saved.input) return saved.iso
  const parsed = isoFromDatetimeLocal(draftValue, timeZone)
  return parsed.kind === "instant" ? parsed.iso : null
}

const FIELD_INPUT_IDS: Readonly<Record<string, string>> = {
  bodyMd: "broadcast-body",
  ctaLabel: "broadcast-cta-label",
  ctaUrl: "broadcast-cta-url",
  segment: "broadcast-audience",
  scheduledAt: "broadcast-schedule",
}

/** The input an error-summary link focuses for a request field. */
function broadcastFieldInputId(field: string): string {
  return FIELD_INPUT_IDS[field] ?? `broadcast-${field}`
}

function audienceOf(draft: ComposerDraft): AudienceState {
  return { kind: draft.audienceKind, ticketTypeIds: draft.ticketTypeIds, slotIds: draft.slotIds }
}

/** The request fields preview and save both send, trimmed the way the server stores them. */
function broadcastBodyFrom(draft: ComposerDraft): {
  content: { subject: string; bodyMd: string; ctaLabel?: string; ctaUrl?: string }
  segment: BroadcastSegment | null
  channels: HostChannel[]
} {
  return {
    content: {
      subject: draft.subject.trim(),
      bodyMd: draft.bodyMd.trim(),
      ...(draft.ctaLabel.trim() ? { ctaLabel: draft.ctaLabel.trim() } : {}),
      ...(draft.ctaUrl.trim() ? { ctaUrl: draft.ctaUrl.trim() } : {}),
    },
    segment: segmentFrom(audienceOf(draft)),
    channels: draft.channels,
  }
}

function composerSummaryErrors(
  readiness: ComposerReadiness,
  submitCount: number,
  serverFields: Record<string, string>,
  t: Translate,
): { id: string; message: string }[] {
  const local: [keyof ComposerReadiness, string, string][] = [
    ["subject", "broadcast-subject", "composer.error_subject"],
    ["body", "broadcast-body", "composer.error_body"],
    ["audience", "broadcast-audience", "composer.error_audience"],
    ["channels", "broadcast-channels", "composer.error_channels"],
  ]
  return [
    ...(submitCount > 0
      ? local
          .filter(([check]) => !readiness[check])
          .map(([, id, key]) => ({ id, message: t(key) }))
      : []),
    ...Object.entries(serverFields).map(([key, message]) => ({
      id: broadcastFieldInputId(key),
      message,
    })),
  ]
}

export interface BroadcastComposerProps {
  broadcast: BroadcastDTO | null
}

function useComposerActions(
  eventId: string,
  broadcast: BroadcastDTO | null,
  draft: ComposerDraft,
  clear: () => void,
) {
  const { t } = useT("host-broadcasts")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const { go } = useConsoleNavigation()

  const [serverFields, setServerFields] = useState<Record<string, string>>({})
  const [confirmSend, setConfirmSend] = useState(false)
  const [testSends, setTestSends] = useState(0)

  useEffect(() => {
    setServerFields({})
  }, [draft.subject, draft.bodyMd, draft.channels, draft.audienceKind])

  const persist = useMutation({
    mutationFn: async (): Promise<BroadcastDTO> => {
      const { content, segment, channels } = broadcastBodyFrom(draft)
      if (!segment) throw new Error("incomplete audience")
      const body = { ...content, segment, channels }
      if (broadcast) {
        return api.updateEventBroadcast({ id: eventId, broadcastId: broadcast.id, ...body })
      }
      return api.createEventBroadcast({ id: eventId, ...body })
    },
    onSuccess: (res) => {
      toast.toast({ title: t("composer.saved"), tone: "success" })
      clear()
      void qc.invalidateQueries({ queryKey: consoleKeys.broadcasts(eventId) })
      qc.setQueryData(consoleKeys.broadcast(eventId, res.id), res)
      go({ kind: "broadcast", eventId, broadcastId: res.id })
    },
    onError: (err) => {
      setServerFields(fieldErrorsFrom(err))
      toast.toast({ title: errors.message(err), tone: "danger" })
    },
  })

  const testSend = useMutation({
    mutationFn: () =>
      api.testSendEventBroadcast({ id: eventId, broadcastId: broadcast?.id as string }),
    onSuccess: () => {
      setTestSends((count) => count + 1)
      toast.toast({ title: t("composer.test_sent"), tone: "success" })
    },
    onError: (err) =>
      toast.toast({
        title: errors.message(err, { RATE_LIMITED: t("composer.test_rate_limited") }),
        tone: "danger",
      }),
  })

  const send = useMutation({
    mutationFn: () =>
      api.sendEventBroadcast({ id: eventId, broadcastId: broadcast?.id as string }),
    onSuccess: (res) => {
      toast.toast({ title: t("composer.sending"), tone: "success" })
      setConfirmSend(false)
      clear()
      qc.setQueryData(consoleKeys.broadcast(eventId, res.id), res)
      void qc.invalidateQueries({ queryKey: consoleKeys.broadcasts(eventId) })
    },
    onError: (err) => {
      setServerFields(fieldErrorsFrom(err))
      setConfirmSend(false)
      toast.toast({ title: errors.message(err), tone: "danger" })
    },
  })

  const schedule = useMutation({
    mutationFn: (scheduledAt: string) =>
      api.scheduleEventBroadcast({
        id: eventId,
        broadcastId: broadcast?.id as string,
        scheduledAt,
      }),
    onSuccess: (res) => {
      toast.toast({ title: t("composer.scheduled"), tone: "success" })
      clear()
      qc.setQueryData(consoleKeys.broadcast(eventId, res.id), res)
      void qc.invalidateQueries({ queryKey: consoleKeys.broadcasts(eventId) })
    },
    onError: (err) => {
      setServerFields(fieldErrorsFrom(err))
      toast.toast({ title: errors.message(err), tone: "danger" })
    },
  })

  return {
    serverFields,
    setServerFields,
    confirmSend,
    setConfirmSend,
    testCapped: testSends >= TEST_SEND_CAP,
    persist,
    testSend,
    send,
    schedule,
  }
}

export function BroadcastComposer({ broadcast }: BroadcastComposerProps) {
  const { t } = useT("host-broadcasts")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const viewerId = useAuthState().user?.id ?? null
  const { eventId, event } = useConsoleEvent()
  const zone = useConsoleInputZone(event.timezone)
  const format = useConsoleFormat(zone)

  const ticketTypes = useEventTicketTypes(eventId)
  const slots = event.slots ?? []

  // The key is versioned because older drafts hold the schedule as a UTC wall clock, not in the
  // event's zone.
  const draftKey = consoleDraftKey(`broadcast.v2.${eventId}`, broadcast?.id ?? "new", viewerId)
  const initial = useMemo(() => draftFrom(broadcast, zone), [broadcast, zone])
  const { draft, patch, restored, dismissRestored, clear } = useDraft(draftKey, initial)

  const [submitCount, setSubmitCount] = useState(0)

  const audience = audienceOf(draft)
  const unsaved = broadcast !== null && composerContentChanged(draft, initial)
  const readiness = composerReadiness({
    subject: draft.subject,
    bodyMd: draft.bodyMd,
    audience,
    channels: draft.channels,
  })
  const ready = composerReady(readiness)
  const status = broadcast?.status ?? "draft"
  const gates = broadcastCan(status)

  const previewFingerprint = JSON.stringify([
    draft.subject.trim(),
    draft.bodyMd.trim(),
    draft.ctaLabel.trim(),
    draft.ctaUrl.trim(),
    segmentFrom(audience),
    [...draft.channels].sort(),
  ])

  // eslint-disable-next-line @tanstack/query/exhaustive-deps -- previewFingerprint is the key's projection of draft and broadcast: keying on the raw objects would drop a fetched preview on edits that do not change what is sent
  const preview = useQuery<BroadcastPreviewDTO>({
    queryKey: [...consoleKeys.broadcastPreview(eventId, broadcast?.id ?? "new"), previewFingerprint],
    enabled: false,
    gcTime: 0,
    queryFn: () => {
      const { content, segment, channels } = broadcastBodyFrom(draft)
      return api.previewEventBroadcast({
        id: eventId,
        ...(broadcast ? { broadcastId: broadcast.id } : {}),
        ...content,
        ...(segment ? { segment } : {}),
        channels,
      })
    },
    retry: false,
  })

  const {
    serverFields,
    setServerFields,
    confirmSend,
    setConfirmSend,
    testCapped,
    persist,
    testSend,
    send,
    schedule,
  } = useComposerActions(eventId, broadcast, draft, clear)

  const zoneNames = useInputZoneNames(zone, [draft.scheduledAt], broadcast?.scheduledAt)
  const scheduleNow = () => {
    const scheduledAt = scheduleInstant(
      draft.scheduledAt,
      { input: initial.scheduledAt, iso: broadcast?.scheduledAt ?? null },
      zone,
    )
    if (scheduledAt === null) {
      setServerFields((current) => ({
        ...current,
        scheduledAt: t("composer.schedule_not_in_zone", { zone: zoneNames.name }),
      }))
      return
    }
    schedule.mutate(scheduledAt)
  }

  const summaryErrors = composerSummaryErrors(readiness, submitCount, serverFields, t)

  const readOnly = broadcast !== null && !gates.edit

  return (
    <div className="flex flex-col gap-token-4">
      {restored ? (
        <DraftRestoredBar
          onDiscard={() => {
            clear()
            dismissRestored()
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-token-3">
        <div className="flex items-center gap-token-2">
          <Chip kind="broadcast-status" value={status} />
          {broadcast ? <Chip kind="broadcast-kind" value={broadcast.kind} size="sm" /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-token-2">
          <ConsoleButton
            variant="outline"
            size="sm"
            disabled={!ready || preview.isFetching}
            onClick={() => void preview.refetch()}
          >
            <Eye aria-hidden className="h-4 w-4" />
            {t("composer.preview")}
          </ConsoleButton>
          {broadcast ? (
            <ConsoleButton
              variant="outline"
              size="sm"
              disabled={testSend.isPending || testCapped || unsaved}
              onClick={() => testSend.mutate()}
            >
              <TestTube aria-hidden className="h-4 w-4" />
              {t("composer.test_send")}
            </ConsoleButton>
          ) : null}
          {!readOnly ? (
            <ConsoleButton
              size="sm"
              variant="secondary"
              disabled={persist.isPending}
              onClick={() => {
                setSubmitCount((count) => count + 1)
                if (!ready) return
                persist.mutate()
              }}
            >
              {tc("action.save")}
            </ConsoleButton>
          ) : null}
          {broadcast && gates.send ? (
            <ConsoleButton
              size="sm"
              disabled={send.isPending || unsaved}
              onClick={() => setConfirmSend(true)}
            >
              <Send aria-hidden className="h-4 w-4" />
              {t("composer.send")}
            </ConsoleButton>
          ) : null}
        </div>
      </div>

      {unsaved || (broadcast && testCapped) ? (
        <p role="status" className="text-token-12 text-console-ink-3">
          {unsaved ? t("composer.save_before_send") : t("composer.test_cap")}
        </p>
      ) : null}

      <ErrorSummary errors={summaryErrors} submitCount={submitCount} />

      <div className="grid gap-token-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <MessageFields
          draft={draft}
          patch={patch}
          readOnly={readOnly}
          serverFields={serverFields}
        />

        <div className="flex flex-col gap-token-4">
          <AudienceSection
            draft={draft}
            patch={patch}
            ticketTypes={ticketTypes.data ?? []}
            slots={slots}
          />

          <ChannelsSection channels={draft.channels} patch={patch} />

          {broadcast && gates.schedule ? (
            <ScheduleSection
              broadcast={broadcast}
              value={draft.scheduledAt}
              zoneHint={zoneNames.hint}
              error={serverFields.scheduledAt}
              disabled={draft.scheduledAt === "" || schedule.isPending || unsaved}
              whenLabel={format.whenLabel}
              onChange={(value) => {
                patch({ scheduledAt: value })
                setServerFields(({ scheduledAt: _stale, ...rest }) => rest)
              }}
              onSchedule={scheduleNow}
            />
          ) : null}

          {preview.data ? (
            <PreviewSection
              preview={preview.data}
              bodyMd={draft.bodyMd}
              recipients={format.number(preview.data.recipientCount)}
            />
          ) : null}
        </div>
      </div>

      <ConfirmModal
        open={confirmSend}
        severity="warn"
        title={t("send_confirm.title")}
        body={t("send_confirm.body", {
          count: preview.data ? format.number(preview.data.recipientCount) : "…",
        })}
        banner={t("send_confirm.banner")}
        agreement={{ label: t("send_confirm.agreement") }}
        confirmLabel={t("composer.send")}
        busy={send.isPending}
        onCancel={() => setConfirmSend(false)}
        onConfirm={() => send.mutate()}
      />
    </div>
  )
}

const SECTION_CLASS =
  "rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1"

type PatchDraft = (patch: Partial<ComposerDraft>) => void

function MessageFields({
  draft,
  patch,
  readOnly,
  serverFields,
}: {
  draft: ComposerDraft
  patch: PatchDraft
  readOnly: boolean
  serverFields: Record<string, string>
}) {
  const { t } = useT("host-broadcasts")
  return (
    <div className="flex flex-col gap-token-4">
      <Field
        announceError={false}
        label={t("composer.subject")}
        htmlFor="broadcast-subject"
        counter={`${draft.subject.length}/${MAX_BROADCAST_SUBJECT}`}
        error={serverFields.subject}
      >
        <TextInput
          id="broadcast-subject"
          value={draft.subject}
          disabled={readOnly}
          maxLength={MAX_BROADCAST_SUBJECT}
          onChange={(event) => patch({ subject: event.target.value })}
        />
      </Field>

      <Field
        announceError={false}
        label={t("composer.body")}
        htmlFor="broadcast-body"
        hint={t("composer.body_hint")}
        error={serverFields.bodyMd}
      >
        <RichTextEditor
          id="broadcast-body"
          value={draft.bodyMd}
          disabled={readOnly}
          maxChars={MAX_BROADCAST_BODY}
          invalid={Boolean(serverFields.bodyMd)}
          onChange={(value) => patch({ bodyMd: value })}
        />
      </Field>

      <div className="grid gap-token-3 sm:grid-cols-2">
        <Field
          announceError={false}
          label={t("composer.cta_label")}
          htmlFor="broadcast-cta-label"
          optional
          counter={`${draft.ctaLabel.length}/${MAX_BROADCAST_CTA_LABEL}`}
        >
          <TextInput
            id="broadcast-cta-label"
            value={draft.ctaLabel}
            disabled={readOnly}
            maxLength={MAX_BROADCAST_CTA_LABEL}
            onChange={(event) => patch({ ctaLabel: event.target.value })}
          />
        </Field>
        <Field
          announceError={false}
          label={t("composer.cta_url")}
          htmlFor="broadcast-cta-url"
          optional
          hint={t("composer.cta_url_hint")}
          error={serverFields.ctaUrl}
        >
          <TextInput
            id="broadcast-cta-url"
            value={draft.ctaUrl}
            disabled={readOnly}
            placeholder="https://"
            maxLength={HTTPS_URL_MAX_LENGTH}
            onChange={(event) => patch({ ctaUrl: event.target.value })}
          />
        </Field>
      </div>
    </div>
  )
}

function AudienceSection({
  draft,
  patch,
  ticketTypes,
  slots,
}: {
  draft: ComposerDraft
  patch: PatchDraft
  ticketTypes: readonly { id: string; name: string }[]
  slots: readonly { id: string; title: string }[]
}) {
  const { t } = useT("host-broadcasts")
  return (
    <section id="broadcast-audience" className={SECTION_CLASS}>
      <h2 className="mb-token-3 font-display text-token-16 font-bold text-console-ink">
        {t("composer.audience")}
      </h2>
      <SegmentedControl
        size="sm"
        className="flex-wrap"
        label={t("composer.audience")}
        value={draft.audienceKind}
        onChange={(value) => patch({ audienceKind: value })}
        options={AUDIENCE_KINDS.filter(
          (kind) =>
            (kind !== "ticket_types" || ticketTypes.length > 0) &&
            (kind !== "slots" || slots.length > 0),
        ).map((kind) => ({ value: kind, label: t(`audience.${kind}`) }))}
      />
      {draft.audienceKind === "ticket_types" ? (
        <ChipMultiSelect
          className="mt-token-3"
          label={t("composer.audience_ticket_types")}
          values={draft.ticketTypeIds}
          onChange={(values) => patch({ ticketTypeIds: values })}
          options={ticketTypes.map((type) => ({
            value: type.id,
            label: type.name,
          }))}
        />
      ) : null}
      {draft.audienceKind === "slots" ? (
        <ChipMultiSelect
          className="mt-token-3"
          label={t("composer.audience_slots")}
          values={draft.slotIds}
          onChange={(values) => patch({ slotIds: values })}
          options={slots.map((slot) => ({ value: slot.id, label: slot.title }))}
        />
      ) : null}
      {audienceExcludesGuests(audienceOf(draft)) ? (
        <p className="mt-token-2 text-token-12 text-console-ink-3">
          {t("composer.slots_members_only")}
        </p>
      ) : null}
    </section>
  )
}

function ChannelsSection({
  channels,
  patch,
}: {
  channels: readonly HostChannel[]
  patch: PatchDraft
}) {
  const { t } = useT("host-broadcasts")
  return (
    <section id="broadcast-channels" className={SECTION_CLASS}>
      <h2 className="mb-token-3 font-display text-token-16 font-bold text-console-ink">
        {t("composer.channels")}
      </h2>
      <ChipMultiSelect
        label={t("composer.channels")}
        values={channels}
        onChange={(values) => patch({ channels: values.filter(isHostChannel) })}
        options={HOST_CHANNELS.map((channel) => ({
          value: channel,
          label: t(`channel.${channel}`),
        }))}
      />
    </section>
  )
}

function ScheduleSection({
  broadcast,
  value,
  zoneHint,
  error,
  disabled,
  whenLabel,
  onChange,
  onSchedule,
}: {
  broadcast: BroadcastDTO
  value: string
  zoneHint: string | null
  error: string | undefined
  disabled: boolean
  whenLabel: (iso: string) => string
  onChange: (value: string) => void
  onSchedule: () => void
}) {
  const { t } = useT("host-broadcasts")
  return (
    <section className={SECTION_CLASS}>
      <h2 className="mb-token-3 font-display text-token-16 font-bold text-console-ink">
        {t("composer.schedule")}
      </h2>
      <Field
        announceError={false}
        label={t("composer.schedule_at")}
        htmlFor="broadcast-schedule"
        hint={zoneHint ? t("composer.schedule_zone_hint", { zone: zoneHint }) : undefined}
        error={error}
      >
        <TextInput
          id="broadcast-schedule"
          type="datetime-local"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
      <ConsoleButton
        size="sm"
        variant="outline"
        className="mt-token-3"
        disabled={disabled}
        onClick={onSchedule}
      >
        <Clock aria-hidden className="h-4 w-4" />
        {t("composer.schedule_action")}
      </ConsoleButton>
      {broadcast.scheduledAt ? (
        <p className="mt-token-2 text-token-12 text-console-ink-3">
          {t("composer.scheduled_for", {
            when: whenLabel(broadcast.scheduledAt),
          })}
        </p>
      ) : null}
    </section>
  )
}

function PreviewSection({
  preview,
  bodyMd,
  recipients,
}: {
  preview: BroadcastPreviewDTO
  bodyMd: string
  recipients: string
}) {
  const { t } = useT("host-broadcasts")
  return (
    <section aria-live="polite" className={SECTION_CLASS}>
      <h2 className="mb-token-2 font-display text-token-16 font-bold text-console-ink">
        {t("composer.preview")}
      </h2>
      <p className="mb-token-2 text-token-13 text-console-ink-2">
        {t("composer.recipients", { count: recipients })}
      </p>
      {preview.warnings.length > 0 ? (
        <ul className="mb-token-2 flex flex-col gap-token-1">
          {preview.warnings.map((warning) => (
            <li key={warning} className="text-token-12 text-console-sun-strong">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-token-13 font-semibold text-console-ink">{preview.subject}</p>
      <MarkdownPreview source={bodyMd} maxChars={MAX_BROADCAST_BODY} className="mt-token-2" />
    </section>
  )
}
