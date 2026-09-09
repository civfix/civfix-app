"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { HostExportDTO, HostExportKind } from "@civfix/shared"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { ConsoleButton } from "@/components/console/button"
import { Overlay } from "@/components/console/overlay/overlay"
import { useConsoleToast } from "@/components/console/overlay/toast"
import { Chip } from "@/components/console/chips/chip"
import { consoleKeys } from "../console-keys"
import { useConsoleErrors } from "../error-copy"
import { useConsoleFormat } from "../format"

const EVENT_EXPORT_KINDS: readonly HostExportKind[] = ["roster", "answers", "checkins"]

const POLL_MS = 3000

export interface ExportMenuProps {
  eventId: string
  eventTitle: string
}

export function ExportMenu({ eventId, eventTitle }: ExportMenuProps) {
  const { t } = useT("host-exports")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const format = useConsoleFormat()
  const [open, setOpen] = useState(false)

  const list = useQuery({
    queryKey: consoleKeys.exports(eventId),
    enabled: open,
    queryFn: () => api.listEventExports({ id: eventId }),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? []
      return items.some((item) => item.status === "queued" || item.status === "running")
        ? POLL_MS
        : false
    },
    retry: false,
  })

  const request = useMutation({
    mutationFn: (kind: HostExportKind) => api.requestEventExport({ id: eventId, kind }),
    onSuccess: () => {
      toast.toast({ title: t("requested"), description: t("requested_hint"), tone: "success" })
      void qc.invalidateQueries({ queryKey: consoleKeys.exports(eventId) })
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  const download = useMutation({
    mutationFn: (exportId: string) => api.downloadHostExport({ id: exportId }),
    onSuccess: (res) => {
      window.location.assign(res.url)
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  return (
    <Overlay
      open={open}
      onClose={() => setOpen(false)}
      align="end"
      width={340}
      label={t("title")}
      trigger={
        <ConsoleButton variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <Download aria-hidden className="h-4 w-4" />
          {t("action")}
        </ConsoleButton>
      }
    >
      <div className="flex flex-col gap-token-3">
        <div>
          <p className="mb-token-2 text-token-12 font-bold uppercase tracking-wider text-console-ink-3">
            {t("new_export")}
          </p>
          <div className="flex flex-wrap gap-token-1">
            {EVENT_EXPORT_KINDS.map((kind) => (
              <ConsoleButton
                key={kind}
                variant="secondary"
                size="sm"
                disabled={request.isPending}
                onClick={() => request.mutate(kind)}
              >
                {t(`kind.${kind}`)}
              </ConsoleButton>
            ))}
          </div>
          <p className="mt-token-2 text-token-12 text-console-ink-3">
            {t("privacy_note", { title: eventTitle })}
          </p>
        </div>

        <div>
          <p className="mb-token-2 text-token-12 font-bold uppercase tracking-wider text-console-ink-3">
            {t("recent")}
          </p>
          {(list.data?.items.length ?? 0) === 0 ? (
            <p className="text-token-13 text-console-ink-3">{t("none")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-console-line">
              {(list.data?.items ?? []).map((item: HostExportDTO) => (
                <li key={item.id} className="flex items-center gap-token-2 py-token-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-token-13 text-console-ink">
                      {t(`kind.${item.kind}`)}
                    </span>
                    <span className="block text-token-12 text-console-ink-3">
                      {format.dateTime(item.requestedAt)}
                      {item.truncated ? ` · ${t("truncated")}` : ""}
                    </span>
                  </span>
                  <Chip kind="export-status" value={item.status} size="sm" />
                  {item.status === "ready" ? (
                    <ConsoleButton
                      size="sm"
                      variant="outline"
                      disabled={download.isPending}
                      onClick={() => download.mutate(item.id)}
                    >
                      {t("download")}
                    </ConsoleButton>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Overlay>
  )
}
