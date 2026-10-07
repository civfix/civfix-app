"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { useConsoleToast } from "@/components/console/overlay/toast"

import { useConsoleErrors } from "../error-copy"
import { invalidateEvent, invalidateRoster } from "../console-invalidate"
import { checkInSeats } from "./check-in-seats"

export function useAttendeeDrawerActions({
  eventId,
  registrationId,
  onMoved,
  onRemoved,
}: {
  eventId: string
  registrationId: string | null
  onMoved: () => void
  onRemoved: () => void
}) {
  const { t } = useT("host-attendees")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()

  const refresh = () => invalidateRoster(qc, eventId)
  const toastFailure = (err: unknown) => toast.toast({ title: errors.message(err), tone: "danger" })
  const succeed = (titleKey: string) => {
    toast.toast({ title: t(titleKey), tone: "success" })
    refresh()
  }

  const saveNote = useMutation({
    mutationFn: (value: string | null) =>
      api.setEventRegistrationNote({
        id: eventId,
        registrationId: registrationId as string,
        note: value,
      }),
    onSuccess: () => succeed("drawer.note_saved"),
    onError: toastFailure,
  })

  const checkIn = useMutation({
    mutationFn: (seatId: string) =>
      api.checkInEventSeat({ id: eventId, seatId, method: "manual" }),
    onSuccess: () => succeed("drawer.checked_in"),
    onError: toastFailure,
  })

  const checkInAll = useMutation({
    mutationFn: async (seatIds: readonly string[]) => {
      const outcome = await checkInSeats(api, eventId, seatIds)
      return { done: outcome.done.length, failed: outcome.failed }
    },
    onSuccess: ({ done, failed }) => {
      toast.toast({
        title: t("bulk.checked_in", { count: done }),
        ...(failed > 0 ? { description: t("bulk.partial", { count: failed }) } : {}),
        tone: failed > 0 ? "danger" : "success",
      })
      refresh()
    },
    onError: toastFailure,
  })

  const undoCheckIn = useMutation({
    mutationFn: (seatId: string) => api.undoEventCheckIn({ id: eventId, seatId }),
    onSuccess: () => succeed("drawer.check_in_undone"),
    onError: toastFailure,
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
      onMoved()
      invalidateEvent(qc, eventId)
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
      onRemoved()
      refresh()
    },
    onError: toastFailure,
  })

  return { saveNote, checkIn, checkInAll, undoCheckIn, transfer, remove }
}

export type AttendeeDrawerActions = ReturnType<typeof useAttendeeDrawerActions>
