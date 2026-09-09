"use client"

import { useState } from "react"
import { Megaphone, Plus } from "lucide-react"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  BroadcastDTO,
  DeliveryStatus,
  ListEventBroadcastsResponse,
} from "@civfix/shared"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import type { ConsoleRoute } from "@/components/console/route"
import { useConsoleUrlState } from "@/components/console/url-state"
import { useGate } from "@/components/console/query-state"
import { EmptyState, LoadingState, StateGate } from "@/components/console/states"
import { ConsoleButton } from "@/components/console/button"
import { Chip } from "@/components/console/chips/chip"
import { QRow } from "@/components/console/qrow"
import { ConfirmModal } from "@/components/console/overlay/confirm-modal"
import { useConsoleToast } from "@/components/console/overlay/toast"

import { useConsoleEvent, useConsoleNavigation } from "../console-context"
import { useConsoleErrors } from "../error-copy"
import { useConsoleFormat } from "../format"
import { consoleKeys } from "../console-keys"
import { BroadcastComposer } from "./broadcast-composer"
import { DeliveryDrawer } from "./delivery-drawer"
import { broadcastCan } from "./audience"

const DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  "pending",
  "in_flight",
  "sent",
  "failed",
  "suppressed",
  "skipped",
]

function deliveryStatusFrom(value: string | undefined): DeliveryStatus | "all" {
  return value !== undefined && (DELIVERY_STATUSES as readonly string[]).includes(value)
    ? (value as DeliveryStatus)
    : "all"
}

function BroadcastsList() {
  const { t } = useT("host-broadcasts")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const format = useConsoleFormat()
  const { eventId } = useConsoleEvent()
  const { go } = useConsoleNavigation()
  const { params, set } = useConsoleUrlState()

  const [pendingCancel, setPendingCancel] = useState<BroadcastDTO | null>(null)

  const list = useInfiniteQuery<ListEventBroadcastsResponse>({
    queryKey: consoleKeys.broadcasts(eventId, "all"),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listEventBroadcasts({
        id: eventId,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
  const gate = useGate(list)
  const rows = (list.data?.pages ?? []).flatMap((page) => page.items)

  const cancel = useMutation({
    mutationFn: (broadcastId: string) => api.cancelEventBroadcast({ id: eventId, broadcastId }),
    onSuccess: () => {
      toast.toast({ title: t("cancelled"), tone: "success" })
      setPendingCancel(null)
      void qc.invalidateQueries({ queryKey: consoleKeys.broadcasts(eventId, "all") })
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  return (
    <div className="flex flex-col gap-token-4">
      <div className="flex flex-wrap items-center justify-between gap-token-3">
        <div>
          <h2 className="font-display text-token-16 font-bold text-console-ink">
            {t("list.title")}
          </h2>
          <p className="text-token-12 text-console-ink-3">{t("list.hint")}</p>
        </div>
        <ConsoleButton size="sm" onClick={() => go({ kind: "broadcast-new", eventId })}>
          <Plus aria-hidden className="h-4 w-4" />
          {t("list.new")}
        </ConsoleButton>
      </div>

      <StateGate
        {...gate}
        onRetry={() => void list.refetch()}
        skeleton={<LoadingState count={4} />}
        empty={rows.length === 0}
        emptyState={
          <EmptyState
            icon={Megaphone}
            title={t("list.empty_title")}
            body={t("list.empty_body")}
            cta={{ label: t("list.new"), onPress: () => go({ kind: "broadcast-new", eventId }) }}
          />
        }
      >
        <div className="overflow-hidden rounded-md border border-console-line bg-console-surface shadow-console-1">
          {rows.map((row) => {
            const gates = broadcastCan(row.status)
            return (
              <QRow
                key={row.id}
                title={row.subject ?? t("list.untitled")}
                pressLabel={t("list.open", { subject: row.subject ?? t("list.untitled") })}
                sub={
                  <span className="flex flex-wrap items-center gap-token-2">
                    <span>{format.dateTime(row.createdAt)}</span>
                    <span>
                      {t("list.counts", {
                        sent: format.number(row.sentCount),
                        recipients: format.number(row.recipientCount),
                      })}
                    </span>
                    {row.failedCount > 0 ? (
                      <span className="text-console-bloom-strong">
                        {t("list.failed", { count: row.failedCount })}
                      </span>
                    ) : null}
                  </span>
                }
                chips={
                  <>
                    <Chip kind="broadcast-status" value={row.status} size="sm" />
                    <Chip kind="broadcast-kind" value={row.kind} size="sm" />
                    {row.channels.map((channel) => (
                      <Chip key={channel} kind="channel" value={channel} size="sm" />
                    ))}
                  </>
                }
                onPress={() => go({ kind: "broadcast", eventId, broadcastId: row.id })}
                trailing={
                  <>
                    <ConsoleButton
                      variant="ghost"
                      size="sm"
                      onClick={() => set({ delivery: row.id }, "push")}
                    >
                      {t("list.deliveries")}
                    </ConsoleButton>
                    {gates.cancel ? (
                      <ConsoleButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingCancel(row)}
                      >
                        {tc("action.cancel")}
                      </ConsoleButton>
                    ) : null}
                  </>
                }
              />
            )
          })}
        </div>
        {list.hasNextPage ? (
          <div className="flex justify-center">
            <ConsoleButton
              variant="outline"
              size="sm"
              disabled={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              {list.isFetchingNextPage ? tc("action.loading") : tc("action.load_more")}
            </ConsoleButton>
          </div>
        ) : null}
      </StateGate>

      <DeliveryDrawer
        eventId={eventId}
        broadcastId={params.delivery ?? null}
        status={deliveryStatusFrom(params.status)}
        onStatusChange={(next) => set({ status: next === "all" ? null : next })}
        onClose={() => set({ delivery: null, status: null })}
      />

      <ConfirmModal
        open={pendingCancel !== null}
        severity="warn"
        title={t("cancel_confirm.title")}
        body={t("cancel_confirm.body")}
        banner={t("cancel_confirm.banner")}
        confirmLabel={t("cancel_confirm.confirm")}
        busy={cancel.isPending}
        onCancel={() => setPendingCancel(null)}
        onConfirm={() => {
          if (pendingCancel) cancel.mutate(pendingCancel.id)
        }}
      />
    </div>
  )
}

function BroadcastDetail({ broadcastId }: { broadcastId: string }) {
  const api = useApi()
  const { eventId } = useConsoleEvent()
  const broadcast = useQuery<BroadcastDTO>({
    queryKey: consoleKeys.broadcast(eventId, broadcastId),
    queryFn: () => api.getEventBroadcast({ id: eventId, broadcastId }),
    retry: false,
  })
  const gate = useGate(broadcast)

  return (
    <StateGate
      {...gate}
      onRetry={() => void broadcast.refetch()}
      skeleton={<LoadingState count={6} />}
    >
      {broadcast.data ? <BroadcastComposer broadcast={broadcast.data} /> : null}
    </StateGate>
  )
}

export function BroadcastsRouter({ route }: { route: ConsoleRoute }) {
  if (route.kind === "broadcast-new") return <BroadcastComposer broadcast={null} />
  if (route.kind === "broadcast") return <BroadcastDetail broadcastId={route.broadcastId} />
  return <BroadcastsList />
}
