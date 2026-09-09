import { z } from "zod"
import { ReportCategorySchema } from "../common.js"

/**
 * Analytics aggregates: one response schema per analytics endpoint (enumeration 3 #56-#66). All
 * derived from reports / cleanups / jurisdictions / users / mail over the relevant window. by-category
 * and resolution-by-category use the 6 real report categories (the design's "cleanup" category is the
 * Events domain, not a report category). Heatmap + retention are the spec-required Phase 2 additions
 * not present in the prototype.
 */

// ---------------------------------------------------------------------------
// #56 KPIs
// ---------------------------------------------------------------------------

/** One KPI cell: a label, a value, a delta, and the delta direction (for the up/down arrow). */
export const AnalyticsKpiSchema = z
  .object({
    label: z.string(),
    num: z.number(),
    delta: z.string(),
    dir: z.enum(["up", "down", "flat"]),
  })
  .strict()
export type AnalyticsKpi = z.infer<typeof AnalyticsKpiSchema>

export const AnalyticsKpisResponseSchema = z
  .object({
    kpis: z.array(AnalyticsKpiSchema),
  })
  .strict()
export type AnalyticsKpisResponse = z.infer<typeof AnalyticsKpisResponseSchema>

// ---------------------------------------------------------------------------
// #57 pins-by-week
// ---------------------------------------------------------------------------

export const AnalyticsPinsByWeekResponseSchema = z
  .object({
    weeks: z.array(z.number()),
    labels: z.array(z.string()),
  })
  .strict()
export type AnalyticsPinsByWeekResponse = z.infer<typeof AnalyticsPinsByWeekResponseSchema>

// ---------------------------------------------------------------------------
// #58 by-category
// ---------------------------------------------------------------------------

/** Per-category report count + share of total (the 6 canonical categories). */
export const AnalyticsCategoryRowSchema = z
  .object({
    cat: ReportCategorySchema,
    count: z.number().int().nonnegative(),
    pct: z.number(),
  })
  .strict()
export type AnalyticsCategoryRow = z.infer<typeof AnalyticsCategoryRowSchema>

export const AnalyticsByCategoryResponseSchema = z
  .object({
    rows: z.array(AnalyticsCategoryRowSchema),
  })
  .strict()
export type AnalyticsByCategoryResponse = z.infer<typeof AnalyticsByCategoryResponseSchema>

// ---------------------------------------------------------------------------
// #59 funnel
// ---------------------------------------------------------------------------

/** One funnel stage (pin dropped -> routed to gov -> acknowledged -> resolved). */
export const AnalyticsFunnelStageSchema = z
  .object({
    stage: z.string(),
    count: z.number().int().nonnegative(),
    pct: z.number(),
  })
  .strict()
export type AnalyticsFunnelStage = z.infer<typeof AnalyticsFunnelStageSchema>

export const AnalyticsFunnelResponseSchema = z
  .object({
    stages: z.array(AnalyticsFunnelStageSchema),
  })
  .strict()
export type AnalyticsFunnelResponse = z.infer<typeof AnalyticsFunnelResponseSchema>

// ---------------------------------------------------------------------------
// #60 coverage
// ---------------------------------------------------------------------------

export const AnalyticsCoverageResponseSchema = z
  .object({
    pct: z.number(),
    mapped: z.number().int().nonnegative(),
    needsMapping: z.number().int().nonnegative(),
  })
  .strict()
export type AnalyticsCoverageResponse = z.infer<typeof AnalyticsCoverageResponseSchema>

// ---------------------------------------------------------------------------
// #61 resolution-by-category
// ---------------------------------------------------------------------------

/** Median resolution hours per category. */
export const AnalyticsResolutionRowSchema = z
  .object({
    cat: ReportCategorySchema,
    hours: z.number().nonnegative(),
  })
  .strict()
export type AnalyticsResolutionRow = z.infer<typeof AnalyticsResolutionRowSchema>

export const AnalyticsResolutionByCategoryResponseSchema = z
  .object({
    rows: z.array(AnalyticsResolutionRowSchema),
  })
  .strict()
export type AnalyticsResolutionByCategoryResponse = z.infer<
  typeof AnalyticsResolutionByCategoryResponseSchema
>

// ---------------------------------------------------------------------------
// #62 events
// ---------------------------------------------------------------------------

export const AnalyticsEventsResponseSchema = z
  .object({
    thisMonth: z.number().int().nonnegative(),
    volunteers: z.number().int().nonnegative(),
    bags: z.number().int().nonnegative(),
    byMonth: z.array(z.number()),
    monthLabels: z.array(z.string()),
  })
  .strict()
export type AnalyticsEventsResponse = z.infer<typeof AnalyticsEventsResponseSchema>

// ---------------------------------------------------------------------------
// #63 top-jurisdictions
// ---------------------------------------------------------------------------

/** A top-jurisdiction row (org + pin volume + resolved %). */
export const AnalyticsTopJurisdictionRowSchema = z
  .object({
    org: z.string(),
    pins: z.number().int().nonnegative(),
    resolved: z.number(),
  })
  .strict()
export type AnalyticsTopJurisdictionRow = z.infer<typeof AnalyticsTopJurisdictionRowSchema>

export const AnalyticsTopJurisdictionsResponseSchema = z
  .object({
    rows: z.array(AnalyticsTopJurisdictionRowSchema),
  })
  .strict()
export type AnalyticsTopJurisdictionsResponse = z.infer<
  typeof AnalyticsTopJurisdictionsResponseSchema
>

// ---------------------------------------------------------------------------
// #64 top-contributors
// ---------------------------------------------------------------------------

/** A top-contributor row (neighbor + reports + cleanups). */
export const AnalyticsTopContributorRowSchema = z
  .object({
    name: z.string(),
    city: z.string(),
    reports: z.number().int().nonnegative(),
    cleanups: z.number().int().nonnegative(),
  })
  .strict()
export type AnalyticsTopContributorRow = z.infer<typeof AnalyticsTopContributorRowSchema>

export const AnalyticsTopContributorsResponseSchema = z
  .object({
    rows: z.array(AnalyticsTopContributorRowSchema),
  })
  .strict()
export type AnalyticsTopContributorsResponse = z.infer<
  typeof AnalyticsTopContributorsResponseSchema
>

// ---------------------------------------------------------------------------
// #65 heatmap (Phase 2 addition)
// ---------------------------------------------------------------------------

/** Per-jurisdiction pin density (geoid + name + pin count, for the heatmap). */
export const AnalyticsHeatmapCellSchema = z
  .object({
    geoid: z.string(),
    name: z.string(),
    density: z.number().nonnegative(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .strict()
export type AnalyticsHeatmapCell = z.infer<typeof AnalyticsHeatmapCellSchema>

export const AnalyticsHeatmapResponseSchema = z
  .object({
    cells: z.array(AnalyticsHeatmapCellSchema),
  })
  .strict()
export type AnalyticsHeatmapResponse = z.infer<typeof AnalyticsHeatmapResponseSchema>

// ---------------------------------------------------------------------------
// #66 retention (Phase 2 addition)
// ---------------------------------------------------------------------------

/** One cohort row: the cohort label + per-period retention values (period 0..N). */
export const AnalyticsRetentionCohortSchema = z
  .object({
    cohort: z.string(),
    size: z.number().int().nonnegative(),
    values: z.array(z.number()),
  })
  .strict()
export type AnalyticsRetentionCohort = z.infer<typeof AnalyticsRetentionCohortSchema>

export const AnalyticsRetentionResponseSchema = z
  .object({
    cohorts: z.array(AnalyticsRetentionCohortSchema),
    periodLabels: z.array(z.string()),
  })
  .strict()
export type AnalyticsRetentionResponse = z.infer<typeof AnalyticsRetentionResponseSchema>
