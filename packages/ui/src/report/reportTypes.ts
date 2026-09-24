import { REPORT_TYPE_TO_CATEGORY, type ReportCategory, type ReportType as ReportTypeId } from "@civfix/shared"

export interface ReportType {
  id: ReportTypeId
  category: ReportCategory
  /** "Other": render the neutral + glyph circle rather than a category teardrop. */
  glyph?: boolean
}

/**
 * UI-only presentation, in display order. The category is derived from REPORT_TYPE_TO_CATEGORY rather than
 * written here, so the wizard can never diverge from the contract's type-to-category mapping.
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
