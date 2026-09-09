"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Download } from "lucide-react"
import type { HostExportDTO } from "@civfix/shared"
import { queryKeys, useApi, useOrgDonationExports } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { useGate } from "@/components/console/query-state"
import { EmptyState, LoadingState, StateGate } from "@/components/console/states"
import { ConsoleButton } from "@/components/console/button"
import { Chip } from "@/components/console/chips/chip"
import { QRow } from "@/components/console/qrow"
import { useConsoleToast } from "@/components/console/overlay/toast"

import { useConsoleErrors } from "../../error-copy"
import { useConsoleFormat } from "../../format"

export interface DonationExportsProps {
  orgId: string
  canView: boolean
}

export type ExportDisplayStatus = HostExportDTO["status"]

export function exportDisplayStatus(row: HostExportDTO, now: number): ExportDisplayStatus {
  if (row.status === "expired") return "expired"
  if (row.status !== "ready") return row.status
  if (row.expiresAt && Date.parse(row.expiresAt) <= now) return "expired"
  return "ready"
}

export function DonationExports({ orgId, canView }: DonationExportsProps) {
  const { t } = useT("host-payments")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const format = useConsoleFormat()

  const list = useOrgDonationExports(canView ? orgId : undefined)
  const gate = useGate(list)
  const rows = list.data ?? []
  const now = Date.now()

  const request = useMutation({
    mutationFn: () => api.requestOrgDonationExport({ id: orgId }),
    onSuccess: () => {
      toast.toast({
        title: t("exports.requested"),
        description: t("exports.requested_hint"),
        tone: "success",
      })
      void qc.invalidateQueries({ queryKey: queryKeys.orgDonationExports(orgId) })
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  const [downloading, setDownloading] = useState<string | null>(null)
  const download = useMutation({
    mutationFn: (exportId: string) => api.downloadHostExport({ id: exportId }),
    onSuccess: (res) => {
      window.location.assign(res.url)
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
    onSettled: () => setDownloading(null),
  })

  if (!canView) return null

  return (
    <section
      aria-labelledby="donation-exports"
      className="flex flex-col gap-token-3 rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1"
    >
      <div className="flex flex-wrap items-center justify-between gap-token-3">
        <h2
          id="donation-exports"
          className="font-display text-token-16 font-bold text-console-ink"
        >
          {t("exports.title")}
        </h2>
        <ConsoleButton
          variant="outline"
          size="sm"
          disabled={request.isPending}
          onClick={() => request.mutate()}
        >
          <Download aria-hidden className="h-4 w-4" />
          {t("exports.request")}
        </ConsoleButton>
      </div>

      <p className="text-token-12 text-console-ink-3">{t("exports.hint")}</p>

      <StateGate
        {...gate}
        onRetry={() => void list.refetch()}
        skeleton={<LoadingState count={2} />}
        empty={rows.length === 0}
        emptyState={
          <EmptyState title={t("exports.empty_title")} body={t("exports.empty_body")} />
        }
      >
        <ul className="flex flex-col divide-y divide-console-line">
          {rows.map((row) => {
            const status = exportDisplayStatus(row, now)
            return (
              <li key={row.id}>
                <QRow
                  title={format.dateTime(row.requestedAt)}
                  sub={[
                    row.rowCount === null || row.rowCount === undefined
                      ? null
                      : t("exports.rows", { count: row.rowCount }),
                    row.truncated ? t("exports.truncated") : null,
                    status === "expired"
                      ? t("exports.expired")
                      : status === "ready" && row.expiresAt
                        ? t("exports.expires", { when: format.dateTime(row.expiresAt) })
                        : null,
                    status === "failed" && row.errorCode
                      ? t("exports.failed_reason", { code: row.errorCode })
                      : null,
                  ]
                    .filter((part) => part !== null)
                    .join(" · ")}
                  chips={<Chip kind="export-status" value={status} size="sm" />}
                  trailing={
                    status === "ready" ? (
                      <ConsoleButton
                        size="sm"
                        variant="outline"
                        disabled={downloading !== null}
                        onClick={() => {
                          setDownloading(row.id)
                          download.mutate(row.id)
                        }}
                      >
                        {downloading === row.id ? tc("action.loading") : t("exports.download")}
                      </ConsoleButton>
                    ) : null
                  }
                />
              </li>
            )
          })}
        </ul>
      </StateGate>

      <p className="text-token-12 text-console-ink-3">{t("exports.note")}</p>
    </section>
  )
}
