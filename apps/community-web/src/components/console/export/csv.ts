import { downloadBlob } from "@/lib/download-blob"

export type CsvValue = string | number | boolean | null | undefined

export type CsvRow = readonly CsvValue[]

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return ""
  if (typeof value !== "string") return String(value)
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`
  return guarded
}

export function csvString(rows: readonly CsvRow[]): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n")
}

export function downloadCsv(filename: string, rows: readonly CsvRow[]): void {
  const name = filename.endsWith(".csv") ? filename : `${filename}.csv`
  downloadBlob(name, new Blob([`﻿${csvString(rows)}`], { type: "text/csv;charset=utf-8" }))
}

export function csvFilename(parts: readonly string[], now: Date): string {
  const stamp = now.toISOString().slice(0, 10)
  const slug = parts
    .map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter((part) => part.length > 0)
    .join("-")
  return `${slug || "civfix-export"}-${stamp}.csv`
}
