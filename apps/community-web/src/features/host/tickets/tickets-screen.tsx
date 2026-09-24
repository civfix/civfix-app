"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Plus, Ticket, Trash2 } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { TicketTypeDTO } from "@civfix/shared"
import { MAX_TICKET_TYPES_PER_EVENT } from "@civfix/shared"
import { useApi, useEventTicketTypes } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { useGate } from "@/components/console/query-state"
import { ConsoleButton, ConsoleIconButton } from "@/components/console/button"
import { EmptyState, StateGate } from "@/components/console/states"
import { Chip } from "@/components/console/chips/chip"
import { QRow } from "@/components/console/qrow"
import { ConfirmModal } from "@/components/console/overlay/confirm-modal"
import { useConsoleToast } from "@/components/console/overlay/toast"

import { useConsoleEvent } from "../console-context"
import { useConsoleErrors } from "../error-copy"
import { useConsoleFormat } from "../format"
import { TicketTypeDrawer } from "./ticket-type-drawer"
import { QuestionsEditor } from "./questions-editor"
import { invalidateEvent } from "../console-invalidate"

export function TicketsScreen() {
  const { t } = useT("host-tickets")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const format = useConsoleFormat()
  const { eventId } = useConsoleEvent()

  const ticketTypes = useEventTicketTypes(eventId)
  const gate = useGate(ticketTypes)
  const types = ticketTypes.data ?? []

  const [editing, setEditing] = useState<TicketTypeDTO | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<TicketTypeDTO | null>(null)

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.reorderEventTicketTypes({ id: eventId, ticketTypeIds: ids }),
    onSuccess: () => invalidateEvent(qc, eventId),
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  const remove = useMutation({
    mutationFn: (ticketTypeId: string) =>
      api.deleteEventTicketType({ id: eventId, ticketTypeId }),
    onSuccess: () => {
      toast.toast({ title: t("deleted"), tone: "success" })
      setPendingDelete(null)
      invalidateEvent(qc, eventId)
    },
    onError: (err) => {
      toast.toast({
        title: errors.message(err, { CONFLICT: t("delete.in_use") }),
        tone: "danger",
      })
    },
  })

  const move = (index: number, delta: number) => {
    const ids = types.map((type) => type.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    const [moved] = ids.splice(index, 1)
    if (moved) ids.splice(target, 0, moved)
    reorder.mutate(ids)
  }

  return (
    <div className="flex flex-col gap-token-5">
      <section
        aria-labelledby="ticket-types-heading"
        className="rounded-md border border-console-line bg-console-surface shadow-console-1"
      >
        <div className="flex flex-wrap items-center justify-between gap-token-3 border-b border-console-line px-token-4 py-token-3">
          <div>
            <h2
              id="ticket-types-heading"
              className="font-display text-token-16 font-bold text-console-ink"
            >
              {t("types.title")}
            </h2>
            <p className="text-token-12 text-console-ink-3">
              {t("types.count", { count: types.length, max: MAX_TICKET_TYPES_PER_EVENT })}
            </p>
          </div>
          <ConsoleButton
            size="sm"
            disabled={types.length >= MAX_TICKET_TYPES_PER_EVENT}
            onClick={() => {
              setEditing(null)
              setDrawerOpen(true)
            }}
          >
            <Plus aria-hidden className="h-4 w-4" />
            {t("types.add")}
          </ConsoleButton>
        </div>

        <StateGate
          {...gate}
          onRetry={() => void ticketTypes.refetch()}
          empty={types.length === 0}
          emptyState={
            <div className="p-token-4">
              <EmptyState
                icon={Ticket}
                title={t("types.empty_title")}
                body={t("types.empty_body")}
                cta={{
                  label: t("types.add"),
                  onPress: () => {
                    setEditing(null)
                    setDrawerOpen(true)
                  },
                }}
              />
            </div>
          }
        >
          {types.map((type, index) => (
            <QRow
              key={type.id}
              title={type.name}
              pressLabel={t("types.edit_a11y", { name: type.name })}
              sub={
                <span className="flex flex-wrap items-center gap-token-2">
                  <span>
                    {t("types.sold", {
                      sold: format.number(type.sold),
                      capacity:
                        type.capacity === null || type.capacity === undefined
                          ? t("types.unlimited")
                          : format.number(type.capacity),
                    })}
                  </span>
                  <span>{t("types.party", { max: type.maxPartySize })}</span>
                </span>
              }
              chips={
                <>
                  <Chip kind="ticket-visibility" value={type.visibility} size="sm" />
                  {type.soldOut ? <Chip kind="registration-state" value="full" size="sm" /> : null}
                  {!type.salesOpen ? (
                    <Chip kind="registration-state" value="closed" size="sm" />
                  ) : null}
                  {type.waitlistEnabled ? (
                    <Chip kind="registration-state" value="waitlist" size="sm" />
                  ) : null}
                </>
              }
              onPress={() => {
                setEditing(type)
                setDrawerOpen(true)
              }}
              trailing={
                <>
                  <ConsoleIconButton
                    label={t("types.move_up_named", { name: type.name })}
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp aria-hidden className="h-4 w-4" />
                  </ConsoleIconButton>
                  <ConsoleIconButton
                    label={t("types.move_down_named", { name: type.name })}
                    disabled={index === types.length - 1 || reorder.isPending}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown aria-hidden className="h-4 w-4" />
                  </ConsoleIconButton>
                  <ConsoleIconButton
                    label={t("types.delete_named", { name: type.name })}
                    onClick={() => setPendingDelete(type)}
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </ConsoleIconButton>
                </>
              }
            />
          ))}
        </StateGate>
      </section>

      <QuestionsEditor eventId={eventId} ticketTypes={types} />

      {drawerOpen ? (
        <TicketTypeDrawer
          key={editing?.id ?? "new"}
          eventId={eventId}
          ticketType={editing}
          open
          onClose={() => {
            setDrawerOpen(false)
            setEditing(null)
          }}
        />
      ) : null}

      <ConfirmModal
        open={pendingDelete !== null}
        severity="danger"
        title={t("delete.title")}
        body={t("delete.body", { name: pendingDelete?.name ?? "" })}
        banner={t("delete.banner")}
        confirmLabel={t("delete.confirm")}
        busy={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete.id)
        }}
      />
    </div>
  )
}
