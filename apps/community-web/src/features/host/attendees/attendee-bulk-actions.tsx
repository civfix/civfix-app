"use client"

import { useState } from "react"
import { Download, Trash2, UserCheck, UserX } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { EventRegistrationDTO } from "@civfix/shared"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { BulkBar, type SelectionApi } from "@/components/console/table"
import { useConsoleToast } from "@/components/console/overlay/toast"
import { ConfirmModal } from "@/components/console/overlay/confirm-modal"

import type { ConsoleEventContext } from "../console-context"
import { useConsoleErrors } from "../error-copy"
import { invalidateRoster } from "../console-invalidate"
import { checkInSeats } from "./check-in-seats"
import { checkableSeatIds } from "@civfix/shared/host"

interface RemoveInput {
  ids: readonly string[]
  reason?: string
}

function useAttendeeBulkMutations(
  eventId: string,
  rows: readonly EventRegistrationDTO[],
  selection: SelectionApi,
) {
  const { t } = useT("host-attendees")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const [confirmNoShow, setConfirmNoShow] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const refresh = () => invalidateRoster(qc, eventId)
  const toastFailure = (err: unknown) => toast.toast({ title: errors.message(err), tone: "danger" })
  const toastTally = (key: "bulk.checked_in" | "bulk.removed", done: number, failed: number) =>
    toast.toast({
      title: t(key, { count: done }),
      ...(failed > 0 ? { description: t("bulk.partial", { count: failed }) } : {}),
      tone: failed > 0 ? "danger" : "success",
    })

  const checkIn = useMutation({
    mutationFn: async (ids: readonly string[]) => {
      const seatIds = rows.filter((row) => ids.includes(row.id)).flatMap(checkableSeatIds)
      const outcome = await checkInSeats(api, eventId, seatIds)
      return { done: outcome.done.length, failed: outcome.failed }
    },
    onSuccess: ({ done, failed }) => {
      toastTally("bulk.checked_in", done, failed)
      selection.clear()
      refresh()
    },
    onError: toastFailure,
  })

  const noShow = useMutation({
    mutationFn: (ids: readonly string[]) => {
      const seatIds = rows
        .filter((row) => ids.includes(row.id))
        .flatMap((row) => row.seats.filter((seat) => seat.status === "active").map((s) => s.id))
      return api.markEventNoShows({ id: eventId, seatIds, all: false })
    },
    onSuccess: (res) => {
      toast.toast({ title: t("bulk.no_show", { count: res.marked }), tone: "success" })
      selection.clear()
      setConfirmNoShow(false)
      refresh()
    },
    onError: toastFailure,
  })

  const remove = useMutation({
    mutationFn: async (input: RemoveInput) => {
      let done = 0
      let failed = 0
      for (const id of input.ids) {
        try {
          await api.removeEventRegistration({
            id: eventId,
            registrationId: id,
            ban: false,
            ...(input.reason ? { reason: input.reason } : {}),
          })
          done += 1
        } catch {
          failed += 1
        }
      }
      return { done, failed }
    },
    onSuccess: ({ done, failed }) => {
      toastTally("bulk.removed", done, failed)
      selection.clear()
      setConfirmRemove(false)
      refresh()
    },
    onError: toastFailure,
  })

  return { checkIn, noShow, remove, confirmNoShow, setConfirmNoShow, confirmRemove, setConfirmRemove }
}

export function AttendeeBulkActions({
  eventId,
  rows,
  selection,
  can,
}: {
  eventId: string
  rows: readonly EventRegistrationDTO[]
  selection: SelectionApi
  can: ConsoleEventContext["can"]
}) {
  const { t } = useT("host-attendees")
  const bulk = useAttendeeBulkMutations(eventId, rows, selection)

  return (
    <>
      <BulkBar
        count={selection.count}
        onClear={() => selection.clear()}
        actions={[
          ...(can("check_in")
            ? [
                {
                  id: "check-in",
                  label: t("bulk.check_in"),
                  icon: UserCheck,
                  disabled: bulk.checkIn.isPending,
                  onPress: () => bulk.checkIn.mutate([...selection.selectedIds]),
                },
                {
                  id: "no-show",
                  label: t("bulk.mark_no_show"),
                  icon: UserX,
                  disabled: bulk.noShow.isPending,
                  onPress: () => bulk.setConfirmNoShow(true),
                },
              ]
            : []),
          ...(can("manage_event")
            ? [
                {
                  id: "remove",
                  label: t("bulk.remove"),
                  icon: Trash2,
                  destructive: true,
                  disabled: bulk.remove.isPending,
                  onPress: () => bulk.setConfirmRemove(true),
                },
              ]
            : []),
          ...(can("export")
            ? [
                {
                  id: "export",
                  label: t("bulk.export_hint"),
                  icon: Download,
                  disabled: true,
                  disabledReason: t("bulk.export_reason"),
                  onPress: () => undefined,
                },
              ]
            : []),
        ]}
      />

      <ConfirmModal
        open={bulk.confirmNoShow}
        severity="warn"
        title={t("no_show.title")}
        body={t("no_show.body", { count: selection.count })}
        confirmLabel={t("no_show.confirm")}
        busy={bulk.noShow.isPending}
        onCancel={() => bulk.setConfirmNoShow(false)}
        onConfirm={() => bulk.noShow.mutate([...selection.selectedIds])}
      />

      <ConfirmModal
        open={bulk.confirmRemove}
        severity="danger"
        title={t("bulk_remove.title", { count: selection.count })}
        body={t("bulk_remove.body", { count: selection.count })}
        reasonField={{ label: t("remove.reason"), required: false }}
        confirmLabel={t("remove.confirm")}
        busy={bulk.remove.isPending}
        onCancel={() => bulk.setConfirmRemove(false)}
        onConfirm={(payload) =>
          bulk.remove.mutate({
            ids: [...selection.selectedIds],
            ...(payload.reason ? { reason: payload.reason } : {}),
          })
        }
      />
    </>
  )
}
