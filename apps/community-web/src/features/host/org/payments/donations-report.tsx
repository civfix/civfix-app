"use client"

import { useMemo, useState } from "react"
import { Download } from "lucide-react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import type {
  DonationStatus,
  ListOrgDonationsResponse,
  OrgDonationRowDTO,
  OrgDonationSummaryDTO,
} from "@civfix/shared"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { useGate } from "@/components/console/query-state"
import { EmptyState, StateGate } from "@/components/console/states"
import { ConsoleButton } from "@/components/console/button"
import { Chip } from "@/components/console/chips/chip"
import { Select, TextInput } from "@/components/console/forms/inputs"
import { DataTable, FilterBar } from "@/components/console/table"
import type { DataTableColumn, FilterFacet } from "@/components/console/table"
import { KpiCell } from "@/components/console/charts"
import { csvFilename, downloadCsv, provenanceRows } from "@/components/console/export"
import { QRow } from "@/components/console/qrow"

import { consoleKeys } from "../../console-keys"
import { useConsoleFormat } from "../../format"

const STATUSES: readonly DonationStatus[] = [
  "succeeded",
  "refunded",
  "partially_refunded",
  "failed",
]

export interface DonationsReportProps {
  orgId: string
  orgName: string
  canView: boolean
}

export function DonationsReport({ orgId, orgName, canView }: DonationsReportProps) {
  const { t } = useT("host-payments")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const format = useConsoleFormat()

  const [status, setStatus] = useState<DonationStatus | null>(null)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const fromIso = from === "" ? undefined : new Date(`${from}T00:00:00`).toISOString()
  const toIso = to === "" ? undefined : new Date(`${to}T23:59:59.999`).toISOString()

  const donations = useInfiniteQuery<ListOrgDonationsResponse>({
    queryKey: consoleKeys.orgDonations(orgId, status ?? "all", from, to),
    enabled: canView,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listOrgDonations({
        id: orgId,
        ...(status ? { status } : {}),
        ...(fromIso ? { from: fromIso } : {}),
        ...(toIso ? { to: toIso } : {}),
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
  const gate = useGate(donations)
  const rows = useMemo(
    () => (donations.data?.pages ?? []).flatMap((page) => page.items),
    [donations.data],
  )

  const summary = useQuery<OrgDonationSummaryDTO>({
    queryKey: consoleKeys.orgDonationSummary(orgId, from, to),
    enabled: canView,
    queryFn: () =>
      api.getOrgDonationSummary({
        id: orgId,
        ...(fromIso ? { from: fromIso } : {}),
        ...(toIso ? { to: toIso } : {}),
      }),
    retry: false,
  })

  const exportVisible = () => {
    const now = new Date()
    const head = provenanceRows({
      title: t("report.csv_title", { org: orgName }),
      generatedAt: now.toISOString(),
      generatedAtLabel: format.dateTime(now.toISOString()),
      filters: [
        { label: t("report.filter_status"), value: status ?? t("report.all_statuses") },
        { label: t("report.filter_from"), value: from || "—" },
        { label: t("report.filter_to"), value: to || "—" },
      ],
      notes: [t("report.donor_identity_note"), t("report.loaded_pages_note")],
      labels: {
        source: t("csv.source"),
        reference: t("csv.reference"),
        generatedAt: t("csv.generated_at"),
        filters: t("csv.filters"),
        none: t("csv.none"),
        suppression: t("csv.suppression_k"),
        note: t("csv.note"),
      },
    })
    const body = [
      [
        t("column.date"),
        t("column.reference"),
        t("column.amount"),
        t("column.platform_fee"),
        t("column.processing_fee"),
        t("column.net"),
        t("column.donor"),
        t("column.status"),
      ],
      ...rows.map((row) => [
        row.chargedAt ?? "",
        row.reference,
        row.amount.amountMinor / 100,
        row.platformFeeMinor / 100,
        row.processorFeeMinor / 100,
        row.netMinor / 100,
        row.sharedIdentity ? (row.donorName ?? row.donorEmail ?? "") : t("report.anonymous"),
        row.status,
      ]),
    ]
    downloadCsv(csvFilename([orgName, "donations"], now), [...head, ...body])
  }

  const facets: FilterFacet[] = [
    {
      id: "status",
      kind: "custom",
      label: t("report.filter_status"),
      active: status !== null,
      valueLabel: status ? t(`donation_status.${status}`) : undefined,
      editor: (
        <Select
          aria-label={t("report.filter_status")}
          value={status ?? ""}
          placeholder={t("report.all_statuses")}
          onChange={(event) =>
            setStatus(event.target.value === "" ? null : (event.target.value as DonationStatus))
          }
          options={STATUSES.map((value) => ({ value, label: t(`donation_status.${value}`) }))}
        />
      ),
    },
    {
      id: "from",
      kind: "custom",
      label: t("report.filter_from"),
      active: from !== "",
      valueLabel: from || undefined,
      editor: (
        <TextInput
          type="date"
          aria-label={t("report.filter_from")}
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
      ),
    },
    {
      id: "to",
      kind: "custom",
      label: t("report.filter_to"),
      active: to !== "",
      valueLabel: to || undefined,
      editor: (
        <TextInput
          type="date"
          aria-label={t("report.filter_to")}
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      ),
    },
  ]

  const donorLabel = (row: OrgDonationRowDTO) =>
    row.sharedIdentity ? (row.donorName ?? row.donorEmail ?? t("report.anonymous")) : t("report.anonymous")

  const columns: DataTableColumn<OrgDonationRowDTO>[] = [
    {
      id: "date",
      label: t("column.date"),
      render: (row) => (row.chargedAt ? format.dateTime(row.chargedAt) : "—"),
    },
    {
      id: "amount",
      label: t("column.amount"),
      align: "right",
      render: (row) => format.money(row.amount.amountMinor, row.amount.currency),
    },
    {
      id: "platformFee",
      label: t("column.platform_fee"),
      align: "right",
      columnPriority: 1,
      render: (row) => format.money(row.platformFeeMinor),
    },
    {
      id: "processingFee",
      label: t("column.processing_fee"),
      align: "right",
      columnPriority: 2,
      render: (row) => format.money(row.processorFeeMinor),
    },
    {
      id: "net",
      label: t("column.net"),
      align: "right",
      render: (row) => format.money(row.netMinor),
    },
    {
      id: "donor",
      label: t("column.donor"),
      columnPriority: 1,
      render: (row) => donorLabel(row),
    },
    {
      id: "status",
      label: t("column.status"),
      render: (row) => (
        <span className="flex flex-wrap items-center gap-1">
          <Chip kind="donation-status" value={row.status} size="sm" />
          {row.disputeState !== "none" ? (
            <Chip kind="dispute-state" value={row.disputeState} size="sm" />
          ) : null}
        </span>
      ),
    },
    {
      id: "receipt",
      label: t("column.receipt"),
      columnPriority: 2,
      render: (row) => (row.receiptSentAt ? format.date(row.receiptSentAt) : "—"),
    },
  ]

  if (!canView) return null

  return (
    <section
      aria-labelledby="donations-report"
      className="flex flex-col gap-token-4 rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1"
    >
      <div className="flex flex-wrap items-center justify-between gap-token-3">
        <h2 id="donations-report" className="font-display text-token-16 font-bold text-console-ink">
          {t("report.title")}
        </h2>
        <div className="flex items-center gap-token-2">
          <ConsoleButton variant="outline" size="sm" onClick={exportVisible}>
            <Download aria-hidden className="h-4 w-4" />
            {t("report.export_visible")}
          </ConsoleButton>
        </div>
      </div>

      {summary.data ? (
        <div className="grid grid-cols-2 gap-token-3 lg:grid-cols-4">
          <KpiCell
            label={t("report.total_gross")}
            value={format.money(summary.data.grossMinor)}
            sub={t("report.donations", { count: summary.data.donationCount })}
          />
          <KpiCell label={t("report.total_platform_fee")} value={format.money(summary.data.platformFeeMinor)} />
          <KpiCell
            label={t("report.total_processing_fee")}
            value={format.money(summary.data.processorFeeMinor)}
          />
          <KpiCell label={t("report.total_net")} value={format.money(summary.data.netMinor)} />
        </div>
      ) : null}

      <FilterBar
        facets={facets}
        onReset={() => {
          setStatus(null)
          setFrom("")
          setTo("")
        }}
      />

      <p className="text-token-12 text-console-ink-3">{t("report.donor_identity_note")}</p>

      <StateGate
        {...gate}
        onRetry={() => void donations.refetch()}
        empty={rows.length === 0}
        emptyState={<EmptyState title={t("report.empty_title")} body={t("report.empty_body")} />}
      >
        <DataTable
          caption={t("report.table_caption")}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={donations.isPending}
          maxColumnPriority={2}
          renderCard={(row) => (
            <QRow
              as="card"
              title={format.money(row.amount.amountMinor, row.amount.currency)}
              sub={`${row.chargedAt ? format.date(row.chargedAt) : "—"} · ${donorLabel(row)}`}
              chips={<Chip kind="donation-status" value={row.status} size="sm" />}
            />
          )}
          emptyState={<EmptyState title={t("report.empty_title")} body={t("report.empty_body")} />}
        />
        {donations.hasNextPage ? (
          <div className="flex justify-center">
            <ConsoleButton
              variant="outline"
              size="sm"
              disabled={donations.isFetchingNextPage}
              onClick={() => void donations.fetchNextPage()}
            >
              {donations.isFetchingNextPage ? tc("action.loading") : tc("action.load_more")}
            </ConsoleButton>
          </div>
        ) : null}
      </StateGate>
    </section>
  )
}
