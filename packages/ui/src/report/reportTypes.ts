/**
 * The shared report-type taxonomy shown on the unified wizard's "What is it?" step (UI-unification Stage 4
 * slice 7). Reconciles the mobile `REPORT_TYPES` (the design `report.jsx` rows, with sub-lines) and the
 * web `ISSUE_TYPES` / `WEB_REPORT_TYPES` (which carry the canonical category + LA agency routing) onto ONE
 * list both hosts render. Each row maps to a canonical `ReportCategory` (which drives the pin color, the
 * city routing, and the submit payload). The label (`enums:reportType.<id>`, doubling as the draft's default
 * title) and the one-line sub (`report-wizard:types.<id>.sub`) come from the locale catalogs, so they follow
 * the reporter's language. `glyph: true` marks the neutral "Other" row (a "+" circle, no single category color).
 *
 * The taxonomy itself is now SOURCED from the shared package (the canonical fine report-type contract): the
 * row `id` is the `ReportType` enum value and the `category` is taken from `REPORT_TYPE_TO_CATEGORY` so this
 * table can never diverge from the contract's type->category mapping. This file keeps ONLY the UI-only
 * presentation flag (the neutral "Other" glyph) and no copy; the category glyph
 * itself comes from ../primitives/category-icons (shared UI).
 */
import { REPORT_TYPE_TO_CATEGORY, type ReportCategory, type ReportType as ReportTypeId } from "@civfix/shared"

export interface ReportType {
  /** The canonical `ReportType` enum value (mirrors REPORT_TYPE_VALUES). */
  id: ReportTypeId
  /** Canonical category for color + routing + the submit payload (from REPORT_TYPE_TO_CATEGORY[id]). */
  category: ReportCategory
  /** "Other": render the neutral + glyph circle rather than a category teardrop. */
  glyph?: boolean
}

/**
 * The UI-only presentation per fine report type (the neutral-glyph flag for "Other"). The canonical
 * category is NOT hard-coded here - it is derived below from REPORT_TYPE_TO_CATEGORY so the two never
 * drift. Keyed by the `ReportType` enum value (REPORT_TYPE_VALUES), in display order.
 */
const REPORT_TYPE_PRESENTATION: Record<ReportTypeId, { glyph?: boolean }> = {
  dump: {},
  encampment: {},
  graffiti: {},
  infrastructure: {},
  pavement: {},
  vegetation: {},
  other: { glyph: true },
}

export const REPORT_TYPES: readonly ReportType[] = (
  Object.keys(REPORT_TYPE_PRESENTATION) as ReportTypeId[]
).map((id) => ({
  id,
  category: REPORT_TYPE_TO_CATEGORY[id],
  ...REPORT_TYPE_PRESENTATION[id],
}))

export function reportTypeById(id: string | null | undefined): ReportType | undefined {
  return REPORT_TYPES.find((t) => t.id === id)
}
