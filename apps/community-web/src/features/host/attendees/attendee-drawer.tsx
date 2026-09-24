"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { EventRegistrationDTO, GetEventRegistrationAnswersResponse } from "@civfix/shared"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { Drawer } from "@/components/console/overlay/drawer"
import { ConfirmModal } from "@/components/console/overlay/confirm-modal"
import { ConsoleButton } from "@/components/console/button"
import { Chip } from "@/components/console/chips/chip"

import { useConsoleEvent } from "../console-context"
import { consoleKeys } from "../console-keys"
import { useConsoleFormat } from "../format"
import { attendeeDisplayName, checkableSeatIds } from "@civfix/shared/host"
import { attendanceOf } from "./roster-filters"
import { useAttendeeDrawerActions } from "./use-attendee-drawer-actions"
import {
  AnswersSection,
  HistorySection,
  MoveTicketSection,
  NoteSection,
  RegistrationSection,
  SeatsSection,
} from "./attendee-drawer-sections"

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
  const api = useApi()
  const format = useConsoleFormat(useConsoleEvent().event.timezone ?? undefined)

  const [note, setNote] = useState<string | null>(null)
  const [transferTo, setTransferTo] = useState("")
  const [confirmRemove, setConfirmRemove] = useState(false)

  const registrationId = registration?.id ?? null
  const open = registration !== null

  const answers = useQuery<GetEventRegistrationAnswersResponse>({
    queryKey: consoleKeys.answers(eventId, registrationId ?? "none"),
    enabled: open && canViewAnswers && registrationId !== null,
    queryFn: () =>
      api.getEventRegistrationAnswers({ id: eventId, registrationId: registrationId as string }),
    retry: false,
  })

  const actions = useAttendeeDrawerActions({
    eventId,
    registrationId,
    onMoved: () => setTransferTo(""),
    onRemoved: () => {
      setConfirmRemove(false)
      onClose()
    },
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
          <RegistrationSection registration={registration} format={format} />
          <SeatsSection
            registration={registration}
            pendingSeats={pendingSeats}
            canCheckIn={canCheckIn}
            actions={actions}
            format={format}
          />
          {canViewAnswers ? <AnswersSection answers={answers} /> : null}
          {canManageTickets && ticketTypes.length > 1 ? (
            <MoveTicketSection
              registration={registration}
              ticketTypes={ticketTypes}
              transferTo={transferTo}
              onTransferToChange={setTransferTo}
              actions={actions}
            />
          ) : null}
          {canManage ? (
            <NoteSection
              noteValue={noteValue}
              edited={note !== null}
              onNoteChange={setNote}
              actions={actions}
            />
          ) : null}
          <HistorySection registration={registration} format={format} />
        </div>
      </Drawer>

      <ConfirmModal
        open={confirmRemove}
        severity="danger"
        title={t("remove.title")}
        body={t("remove.body", { name: displayName })}
        reasonField={{ label: t("remove.reason"), required: false }}
        confirmLabel={t("remove.confirm")}
        busy={actions.remove.isPending}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={(payload) => actions.remove.mutate(payload.reason)}
      />
    </>
  )
}
