"use client"

import type { ReactNode } from "react"
import type { UseQueryResult } from "@tanstack/react-query"
import {
  MAX_HOST_NOTE,
  type EventRegistrationDTO,
  type GetEventRegistrationAnswersResponse,
} from "@civfix/shared"
import { useT } from "@civfix/ui/i18n"

import { ConsoleButton } from "@/components/console/button"
import { Chip } from "@/components/console/chips/chip"
import { Field } from "@/components/console/forms/field"
import { TextArea, Select } from "@/components/console/forms/inputs"
import { LoadingState, StateGate } from "@/components/console/states"
import { useGate } from "@/components/console/query-state"
import { TimelineList } from "@/components/console/timeline-list"

import type { ConsoleFormatters } from "../format"
import { EmptyValue } from "../analytics/analytics-value"
import type { AttendeeDrawerActions } from "./use-attendee-drawer-actions"

type Answer = GetEventRegistrationAnswersResponse["answers"][number]

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-token-2 text-token-12 font-bold uppercase tracking-wider text-console-ink-3">
      {children}
    </h3>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-token-2">
      <dt className="text-console-ink-3">{label}</dt>
      <dd className="text-console-ink">{children}</dd>
    </div>
  )
}

export function RegistrationSection({
  registration,
  format,
}: {
  registration: EventRegistrationDTO
  format: ConsoleFormatters
}) {
  const { t } = useT("host-attendees")
  return (
    <section>
      <SectionHeading>{t("drawer.registration")}</SectionHeading>
      <dl className="flex flex-col gap-token-2 text-token-13">
        <DetailRow label={t("drawer.ticket_type")}>
          {registration.ticketTypeName ?? <EmptyValue />}
        </DetailRow>
        <DetailRow label={t("drawer.party")}>{format.number(registration.seatCount)}</DetailRow>
        <DetailRow label={t("drawer.registered_at")}>
          {format.dateTime(registration.registeredAt)}
        </DetailRow>
        {registration.slot ? (
          <DetailRow label={t("drawer.slot")}>{registration.slot.title}</DetailRow>
        ) : null}
        <DetailRow label={t("drawer.source")}>{t(`source.${registration.source}`)}</DetailRow>
      </dl>
      <p className="mt-token-2 text-token-12 text-console-ink-3">{t("drawer.no_contact")}</p>
    </section>
  )
}

export function SeatsSection({
  registration,
  pendingSeats,
  canCheckIn,
  actions,
  format,
}: {
  registration: EventRegistrationDTO
  pendingSeats: readonly string[]
  canCheckIn: boolean
  actions: AttendeeDrawerActions
  format: ConsoleFormatters
}) {
  const { t } = useT("host-attendees")
  const { t: tc } = useT("host-common")
  const { checkIn, checkInAll, undoCheckIn } = actions
  const checkInBusy = checkIn.isPending || checkInAll.isPending

  return (
    <section>
      <SectionHeading>{t("drawer.seats")}</SectionHeading>
      <ul className="flex flex-col divide-y divide-console-line rounded-sm border border-console-line">
        {registration.seats.map((seat, index) => (
          <li
            key={seat.id}
            className="flex items-center gap-token-2 px-token-3 py-token-2 text-token-13"
          >
            <span className="min-w-0 flex-1 truncate text-console-ink">
              {seat.attendeeName ?? t("drawer.seat_n", { n: index + 1 })}
            </span>
            {seat.checkedInAt ? (
              <>
                <span className="text-token-12 text-console-ink-3">
                  {format.time(seat.checkedInAt)}
                </span>
                {seat.checkinMethod ? (
                  <Chip kind="checkin-method" value={seat.checkinMethod} size="sm" />
                ) : null}
                {canCheckIn ? (
                  <ConsoleButton
                    variant="ghost"
                    size="sm"
                    disabled={undoCheckIn.isPending}
                    onClick={() => undoCheckIn.mutate(seat.id)}
                  >
                    {tc("action.undo")}
                  </ConsoleButton>
                ) : null}
              </>
            ) : canCheckIn && seat.status === "active" ? (
              <ConsoleButton
                variant="outline"
                size="sm"
                disabled={checkInBusy}
                onClick={() => checkIn.mutate(seat.id)}
              >
                {t("drawer.check_in")}
              </ConsoleButton>
            ) : (
              <Chip kind="seat-status" value={seat.status} size="sm" />
            )}
          </li>
        ))}
        {registration.seats.length === 0 ? (
          <li className="px-token-3 py-token-3 text-token-13 text-console-ink-3">
            {t("drawer.no_seats")}
          </li>
        ) : null}
      </ul>
      {canCheckIn && pendingSeats.length > 1 ? (
        <ConsoleButton
          variant="outline"
          size="sm"
          className="mt-token-2"
          disabled={checkInBusy}
          onClick={() => checkInAll.mutate(pendingSeats)}
        >
          {t("drawer.check_in_all", { count: pendingSeats.length })}
        </ConsoleButton>
      ) : null}
    </section>
  )
}

function AnswerValue({ answer }: { answer: Answer }) {
  const { t } = useT("host-attendees")
  const { t: tc } = useT("host-common")
  if (answer.scrubbedAt) return <>{t("drawer.answer_scrubbed")}</>
  if (Array.isArray(answer.value)) return <>{answer.value.join(", ")}</>
  if (typeof answer.value === "boolean") return <>{answer.value ? tc("common.yes") : tc("common.no")}</>
  return <>{answer.value ?? <EmptyValue />}</>
}

export function AnswersSection({
  answers,
}: {
  answers: UseQueryResult<GetEventRegistrationAnswersResponse>
}) {
  const { t } = useT("host-attendees")
  const gate = useGate(answers)
  return (
    <section>
      <SectionHeading>{t("drawer.answers")}</SectionHeading>
      <StateGate
        {...gate}
        onRetry={() => void answers.refetch()}
        skeleton={<LoadingState count={2} />}
        empty={(answers.data?.answers.length ?? 0) === 0}
        emptyState={<p className="text-token-13 text-console-ink-3">{t("drawer.no_answers")}</p>}
      >
        <dl className="flex flex-col gap-token-2 text-token-13">
          {(answers.data?.answers ?? []).map((answer) => (
            <div key={answer.questionId} className="flex flex-col gap-0.5">
              <dt className="text-console-ink-3">{answer.prompt}</dt>
              <dd className="text-console-ink">
                <AnswerValue answer={answer} />
              </dd>
            </div>
          ))}
        </dl>
      </StateGate>
    </section>
  )
}

export function MoveTicketSection({
  registration,
  ticketTypes,
  transferTo,
  onTransferToChange,
  actions,
}: {
  registration: EventRegistrationDTO
  ticketTypes: readonly { id: string; name: string }[]
  transferTo: string
  onTransferToChange: (value: string) => void
  actions: AttendeeDrawerActions
}) {
  const { t } = useT("host-attendees")
  const { transfer } = actions
  return (
    <section>
      <Field label={t("drawer.move_label")}>
        {({ id, describedBy }) => (
          <div className="flex items-center gap-token-2">
            <Select
              id={id}
              aria-describedby={describedBy}
              value={transferTo}
              placeholder={t("drawer.move_placeholder")}
              onChange={(event) => onTransferToChange(event.target.value)}
              options={ticketTypes
                .filter((type) => type.id !== registration.ticketTypeId)
                .map((type) => ({ value: type.id, label: type.name }))}
            />
            <ConsoleButton
              size="sm"
              disabled={transferTo === "" || transfer.isPending}
              onClick={() => transfer.mutate(transferTo)}
            >
              {t("drawer.move")}
            </ConsoleButton>
          </div>
        )}
      </Field>
    </section>
  )
}

export function NoteSection({
  noteValue,
  edited,
  onNoteChange,
  actions,
}: {
  noteValue: string
  edited: boolean
  onNoteChange: (value: string) => void
  actions: AttendeeDrawerActions
}) {
  const { t } = useT("host-attendees")
  const { t: tc } = useT("host-common")
  const { saveNote } = actions
  return (
    <section>
      <Field label={t("drawer.note_label")} hint={t("drawer.note_hint")}>
        {({ id, describedBy }) => (
          <div className="flex flex-col items-end gap-token-2">
            <TextArea
              id={id}
              aria-describedby={describedBy}
              value={noteValue}
              maxLength={MAX_HOST_NOTE}
              onChange={(event) => onNoteChange(event.target.value)}
            />
            <ConsoleButton
              size="sm"
              variant="outline"
              disabled={saveNote.isPending || !edited}
              onClick={() => saveNote.mutate(noteValue.trim() === "" ? null : noteValue)}
            >
              {tc("action.save")}
            </ConsoleButton>
          </div>
        )}
      </Field>
    </section>
  )
}

export function HistorySection({
  registration,
  format,
}: {
  registration: EventRegistrationDTO
  format: ConsoleFormatters
}) {
  const { t } = useT("host-attendees")
  return (
    <section>
      <SectionHeading>{t("drawer.history")}</SectionHeading>
      <TimelineList
        entries={[
          {
            id: "registered",
            at: registration.registeredAt,
            atLabel: format.date(registration.registeredAt),
            body: t("history.registered"),
          },
          ...(registration.checkedInAt
            ? [
                {
                  id: "checked-in",
                  at: registration.checkedInAt,
                  atLabel: format.date(registration.checkedInAt),
                  actorLabel: registration.checkedInBy?.name,
                  body: t("history.checked_in"),
                },
              ]
            : []),
          ...(registration.cancelledAt
            ? [
                {
                  id: "cancelled",
                  at: registration.cancelledAt,
                  atLabel: format.date(registration.cancelledAt),
                  body: t("history.cancelled"),
                },
              ]
            : []),
        ]}
      />
    </section>
  )
}
