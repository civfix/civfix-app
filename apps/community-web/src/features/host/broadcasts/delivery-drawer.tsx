"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import type { DeliveryStatus, ListBroadcastDeliveriesResponse } from "@civfix/shared"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { Drawer } from "@/components/console/overlay/drawer"
import { useGate } from "@/components/console/query-state"
import { EmptyState, StateGate } from "@/components/console/states"
import { ConsoleButton } from "@/components/console/button"
import { Chip } from "@/components/console/chips/chip"
import { SegmentedControl } from "@/components/console/forms/segmented-control"

import { consoleKeys } from "../console-keys"
import { useConsoleFormat } from "../format"

const STATUS_FILTERS: readonly (DeliveryStatus | "all")[] = [
  "all",
  "sent",
  "failed",
  "suppressed",
  "pending",
]

export interface DeliveryDrawerProps {
  eventId: string
  broadcastId: string | null
  status: DeliveryStatus | "all"
  onStatusChange: (status: DeliveryStatus | "all") => void
  onClose: () => void
}

export function DeliveryDrawer({
  eventId,
  broadcastId,
  status,
  onStatusChange,
  onClose,
}: DeliveryDrawerProps) {
  const { t } = useT("host-broadcasts")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const format = useConsoleFormat()

  const deliveries = useInfiniteQuery<ListBroadcastDeliveriesResponse>({
    queryKey: consoleKeys.deliveries(eventId, broadcastId ?? "none", status, "all"),
    enabled: broadcastId !== null,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listBroadcastDeliveries({
        id: eventId,
        broadcastId: broadcastId as string,
        ...(status !== "all" ? { status } : {}),
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
  const gate = useGate(deliveries)
  const rows = (deliveries.data?.pages ?? []).flatMap((page) => page.items)

  return (
    <Drawer
      open={broadcastId !== null}
      onClose={onClose}
      size="lg"
      title={t("deliveries.title")}
      headerExtra={
        <SegmentedControl
          size="sm"
          className="flex-wrap"
          label={t("deliveries.filter")}
          value={status}
          onChange={onStatusChange}
          options={STATUS_FILTERS.map((value) => ({
            value,
            label: value === "all" ? t("deliveries.all") : t(`delivery_status.${value}`),
          }))}
        />
      }
    >
      <div className="flex flex-col gap-token-3 p-token-4">
        <p className="text-token-12 text-console-ink-3">{t("deliveries.privacy_note")}</p>
        <StateGate
          {...gate}
          onRetry={() => void deliveries.refetch()}
          empty={rows.length === 0}
          emptyState={
            <EmptyState title={t("deliveries.empty_title")} body={t("deliveries.empty_body")} />
          }
        >
          <ul className="flex flex-col divide-y divide-console-line">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-token-2 py-token-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-token-13 text-console-ink">
                    {row.recipientLabel}
                  </span>
                  <span className="block text-token-12 text-console-ink-3">
                    {row.sentAt ? format.dateTime(row.sentAt) : t("deliveries.not_sent")}
                    {row.attempts > 1 ? ` · ${t("deliveries.attempts", { n: row.attempts })}` : ""}
                  </span>
                </span>
                <Chip kind="channel" value={row.channel} size="sm" />
                <Chip
                  kind="delivery-status"
                  value={row.status}
                  size="sm"
                  reason={
                    row.suppressionReason
                      ? t(`suppression.${row.suppressionReason}`)
                      : row.failureKind
                        ? t(`failure.${row.failureKind}`)
                        : undefined
                  }
                />
              </li>
            ))}
          </ul>
          {deliveries.hasNextPage ? (
            <ConsoleButton
              variant="outline"
              size="sm"
              className="self-center"
              disabled={deliveries.isFetchingNextPage}
              onClick={() => void deliveries.fetchNextPage()}
            >
              {deliveries.isFetchingNextPage ? tc("action.loading") : tc("action.load_more")}
            </ConsoleButton>
          ) : null}
        </StateGate>
      </div>
    </Drawer>
  )
}
