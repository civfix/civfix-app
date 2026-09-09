"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { EventRegistrationDTO, GetEventRegistrationAnswersResponse } from "@civfix/shared"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { Drawer } from "@/components/console/overlay/drawer"
import { ConfirmModal } from "@/components/console/overlay/confirm-modal"
import { useConsoleToast } from "@/components/console/overlay/toast"
import { ConsoleButton } from "@/components/console/button"
import { Chip } from "@/components/console/chips/chip"
import { Field } from "@/components/console/forms/field"
import { TextArea, Select } from "@/components/console/forms/inputs"
import { LoadingState, StateGate } from "@/components/console/states"
import { useGate } from "@/components/console/query-state"
import { TimelineList } from "@/components/console/timeline-list"

import { useConsoleErrors } from "../error-copy"
import { useConsoleFormat } from "../format"
import { attendanceOf, attendeeDisplayName, checkableSeatIds } from "./roster-filters"
import { invalidateEvent } from "../console-invalidate"

export interface AttendeeDrawerProps {
  eventId: string
  registration: EventRegistrationDTO | null
  ticketTypes: readonly { id: string; name: string }[]
  canViewAnswers: boolean
  canManage: boolean
  canCheckIn: boolean
  canManageTickets: boolean
  onClose: () => void
}

export function AttendeeDrawer({
  eventId,
  registration,
  ticketTypes,
  canViewAnswers,
  canManage,
  canCheckIn,
  canManageTickets,
  onClose,
}: AttendeeDrawerProps) {
  const { t } = useT("host-attendees")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const format = useConsoleFormat()

  const [note, setNote] = useState<string | null>(null)
  const [transferTo, setTransferTo] = useState("")
  const [confirmRemove, setConfirmRemove] = useState(false)

  const registrationId = registration?.id ?? null
  const open = registration !== null

  const answers = useQuery<GetEventRegistrationAnswersResponse>({
    queryKey: ["host", eventId, "answers", registrationId ?? "none"],
    enabled: open && canViewAnswers && registrationId !== null,
    queryFn: () =>
      api.getEventRegistrationAnswers({ id: eventId, registrationId: registrationId as string }),
    retry: false,
  })
  const answersGate = useGate(answers)

  const refresh = () => invalidateEvent(qc, eventId)

  const saveNote = useMutation({
    mutationFn: (value: string | null) =>
      api.setEventRegistrationNote({
        id: eventId,
        registrationId: registrationId as string,
        note: value,
      }),
    onSuccess: () => {
      toast.toast({ title: t("drawer.note_saved"), tone: "success" })
      refresh()
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  const checkIn = useMutation({
    mutationFn: (seatId: string) =>
      api.checkInEventSeat({ id: eventId, seatId, method: "manual" }),
    onSuccess: () => {
      toast.toast({ title: t("drawer.checked_in"), tone: "success" })
      refresh()
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  const undoCheckIn = useMutation({
    mutationFn: (seatId: string) => api.undoEventCheckIn({ id: eventId, seatId }),
    onSuccess: () => {
      toast.toast({ title: t("drawer.check_in_undone"), tone: "success" })
      refresh()
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  const transfer = useMutation({
    mutationFn: (ticketTypeId: string) =>
      api.transferEventRegistration({
        id: eventId,
        registrationId: registrationId as string,
        ticketTypeId,
      }),
    onSuccess: () => {
      toast.toast({ title: t("drawer.moved"), tone: "success" })
      setTransferTo("")
      refresh()
    },
    onError: (err) =>
      toast.toast({
        title: errors.message(err, { CONFLICT: t("drawer.move_conflict") }),
        tone: "danger",
      }),
  })

  const remove = useMutation({
    mutationFn: (reason: string | undefined) =>
      api.removeEventRegistration({
        id: eventId,
        registrationId: registrationId as string,
        ban: false,
        ...(reason ? { reason } : {}),
      }),
    onSuccess: () => {
      toast.toast({ title: t("drawer.removed"), tone: "success" })
      setConfirmRemove(false)
      onClose()
      refresh()
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  if (!registration) return null

  const displayName = attendeeDisplayName(registration, {
    guest: t("row.guest"),
    deleted: t("row.deleted_user"),
  })
  const noteValue = note ?? registration.note ?? ""
  const pendingSeats = checkableSeatIds(registration)

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={displayName}
        chips={
          <>
            <Chip kind="registration-status" value={registration.status} size="sm" />
            <Chip kind="attendee-kind" value={registration.kind} size="sm" />
            <Chip kind="attendance" value={attendanceOf(registration)} size="sm" />
          </>
        }
        footer={
          canManage ? (
            <div className="flex flex-wrap items-center justify-end gap-token-2">
              <ConsoleButton
                variant="destructive"
                size="sm"
                onClick={() => setConfirmRemove(true)}
              >
                {t("drawer.remove")}
              </ConsoleButton>
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-token-5 p-token-4">
          <section>
            <h3 className="mb-token-2 text-token-12 font-bold uppercase tracking-wider text-console-ink-3">
              {t("drawer.registration")}
            </h3>
            <dl className="flex flex-col gap-token-2 text-token-13">
              <div className="flex justify-between gap-token-2">
                <dt className="text-console-ink-3">{t("drawer.ticket_type")}</dt>
                <dd className="text-console-ink">{registration.ticketTypeName ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-token-2">
                <dt className="text-console-ink-3">{t("drawer.party")}</dt>
                <dd className="text-console-ink">{format.number(registration.seatCount)}</dd>
              </div>
              <div className="flex justify-between gap-token-2">
                <dt className="text-console-ink-3">{t("drawer.registered_at")}</dt>
                <dd className="text-console-ink">{format.dateTime(registration.registeredAt)}</dd>
              </div>
              {registration.slot ? (
                <div className="flex justify-between gap-token-2">
                  <dt className="text-console-ink-3">{t("drawer.slot")}</dt>
                  <dd className="text-console-ink">{registration.slot.title}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-token-2">
                <dt className="text-console-ink-3">{t("drawer.source")}</dt>
                <dd className="text-console-ink">{t(`source.${registration.source}`)}</dd>
              </div>
            </dl>
            <p className="mt-token-2 text-token-12 text-console-ink-3">
              {t("drawer.no_contact")}
            </p>
          </section>

          <section>
            <h3 className="mb-token-2 text-token-12 font-bold uppercase tracking-wider text-console-ink-3">
              {t("drawer.seats")}
            </h3>
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
                      disabled={checkIn.isPending}
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
                disabled={checkIn.isPending}
                onClick={() => {
                  for (const seatId of pendingSeats) checkIn.mutate(seatId)
                }}
              >
                {t("drawer.check_in_all", { count: pendingSeats.length })}
              </ConsoleButton>
            ) : null}
          </section>

          {canViewAnswers ? (
            <section>
              <h3 className="mb-token-2 text-token-12 font-bold uppercase tracking-wider text-console-ink-3">
                {t("drawer.answers")}
              </h3>
              <StateGate
                {...answersGate}
                onRetry={() => void answers.refetch()}
                skeleton={<LoadingState count={2} />}
                empty={(answers.data?.answers.length ?? 0) === 0}
                emptyState={
                  <p className="text-token-13 text-console-ink-3">{t("drawer.no_answers")}</p>
                }
              >
                <dl className="flex flex-col gap-token-2 text-token-13">
                  {(answers.data?.answers ?? []).map((answer) => (
                    <div key={answer.questionId} className="flex flex-col gap-0.5">
                      <dt className="text-console-ink-3">{answer.prompt}</dt>
                      <dd className="text-console-ink">
                        {answer.scrubbedAt
                          ? t("drawer.answer_scrubbed")
                          : Array.isArray(answer.value)
                            ? answer.value.join(", ")
                            : typeof answer.value === "boolean"
                              ? answer.value
                                ? tc("common.yes")
                                : tc("common.no")
                              : (answer.value ?? "—")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </StateGate>
            </section>
          ) : null}

          {canManageTickets && ticketTypes.length > 1 ? (
            <section>
              <Field label={t("drawer.move_label")}>
                {({ id, describedBy }) => (
                  <div className="flex items-center gap-token-2">
                    <Select
                      id={id}
                      aria-describedby={describedBy}
                      value={transferTo}
                      placeholder={t("drawer.move_placeholder")}
                      onChange={(event) => setTransferTo(event.target.value)}
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
          ) : null}

          {canManage ? (
            <section>
              <Field label={t("drawer.note_label")} hint={t("drawer.note_hint")}>
                {({ id, describedBy }) => (
                  <div className="flex flex-col items-end gap-token-2">
                    <TextArea
                      id={id}
                      aria-describedby={describedBy}
                      value={noteValue}
                      maxLength={1000}
                      onChange={(event) => setNote(event.target.value)}
                    />
                    <ConsoleButton
                      size="sm"
                      variant="outline"
                      disabled={saveNote.isPending || note === null}
                      onClick={() => saveNote.mutate(noteValue.trim() === "" ? null : noteValue)}
                    >
                      {tc("action.save")}
                    </ConsoleButton>
                  </div>
                )}
              </Field>
            </section>
          ) : null}

          <section>
            <h3 className="mb-token-2 text-token-12 font-bold uppercase tracking-wider text-console-ink-3">
              {t("drawer.history")}
            </h3>
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
        </div>
      </Drawer>

      <ConfirmModal
        open={confirmRemove}
        severity="danger"
        title={t("remove.title")}
        body={t("remove.body", { name: displayName })}
        reasonField={{ label: t("remove.reason"), required: false }}
        confirmLabel={t("remove.confirm")}
        busy={remove.isPending}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={(payload) => remove.mutate(payload.reason)}
      />
    </>
  )
}
