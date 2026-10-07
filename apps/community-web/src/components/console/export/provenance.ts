import { ANALYTICS_SUPPRESSION_K } from "@civfix/shared"

import type { CsvRow } from "./csv"

export interface ProvenanceInput {
  title: string
  reference?: string | null
  generatedAt: string
  generatedAtLabel: string
  filters?: readonly { label: string; value: string }[]
  suppressed?: boolean
  suppressionK?: number
  notes?: readonly string[]
  labels: ProvenanceLabels
}

export interface ProvenanceLabels {
  source: string
  reference: string
  generatedAt: string
  filters: string
  none: string
  suppression: string
  note: string
}

export function provenanceRows(input: ProvenanceInput): CsvRow[] {
  const rows: CsvRow[] = [
    [input.labels.source, input.title],
    [input.labels.generatedAt, `${input.generatedAtLabel} (${input.generatedAt})`],
  ]
  if (input.reference) rows.splice(1, 0, [input.labels.reference, input.reference])
  const filters = input.filters ?? []
  rows.push([
    input.labels.filters,
    filters.length === 0
      ? input.labels.none
      : filters.map((filter) => `${filter.label}=${filter.value}`).join("; "),
  ])
  if (input.suppressed) {
    rows.push([input.labels.suppression, String(input.suppressionK ?? ANALYTICS_SUPPRESSION_K)])
  }
  for (const note of input.notes ?? []) rows.push([input.labels.note, note])
  rows.push([])
  return rows
}
