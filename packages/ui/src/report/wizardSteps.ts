import type { LayoutMode } from "../theme"
import type { DraftReport } from "./draftStore"

export type Step = "capture" | "location" | "category" | "details" | "review"

export const STEP_ORDER_EXPANDED: Step[] = ["capture", "category", "details", "review"]
export const STEP_ORDER_COMPACT: Step[] = ["capture", "location", "category", "details", "review"]

export interface StepOrderOptions {
  skipLocation?: boolean
}

export function stepOrderFor(mode: LayoutMode, opts?: StepOrderOptions): Step[] {
  if (mode !== "compact") return STEP_ORDER_EXPANDED
  return opts?.skipLocation ? STEP_ORDER_COMPACT.filter((s) => s !== "location") : STEP_ORDER_COMPACT
}

export function resumeStep(
  draft: Pick<DraftReport, "media" | "lat" | "lng" | "reportTypeId" | "title">,
  mode: LayoutMode,
): Step {
  if (draft.media.length === 0) return "capture"
  const hasLocation = draft.lat != null && draft.lng != null
  if (mode === "compact" && !hasLocation) return "location"
  if (draft.reportTypeId === null) return "category"
  if (draft.title.trim().length === 0) return "details"
  return "review"
}

export function stepAfterCapture(
  draft: Pick<DraftReport, "media" | "lat" | "lng" | "reportTypeId" | "title">,
  mode: LayoutMode,
  order: Step[],
): Step {
  const resumed = resumeStep(draft, mode)
  if (resumed !== "capture" && order.includes(resumed)) return resumed
  const i = order.indexOf("capture")
  return (order[i + 1] as Step | undefined) ?? "capture"
}

export interface StepReadiness {
  hasMedia: boolean
  hasLocation: boolean
  hasReportType: boolean
  hasTitle: boolean
}

/** Whether the footer's Continue (or, on review, the submit) is enabled on `step`. */
export function canAdvanceStep(step: Step, ready: StepReadiness): boolean {
  switch (step) {
    case "capture":
      return ready.hasMedia
    case "location":
      return ready.hasLocation
    case "category":
      return ready.hasReportType
    case "details":
      return ready.hasTitle
    case "review":
      return ready.hasLocation
    default:
      return false
  }
}

export function showsWizardFooter(step: Step, hasMedia: boolean): boolean {
  return step === "capture" ? hasMedia : true
}

export type WizardHeaderMode = "tab-root" | "detail"

export function wizardHeaderMode(
  mode: LayoutMode,
  showBack: boolean,
  atViewRoot: boolean,
): WizardHeaderMode {
  if (mode === "expanded") return atViewRoot ? "tab-root" : "detail"
  return showBack ? "detail" : "tab-root"
}

export function rendersEmbeddedViewfinder(
  step: Step,
  hasMedia: boolean,
  hasViewfinder: boolean,
  mode: LayoutMode,
): boolean {
  return mode === "compact" && hasViewfinder && step === "capture" && !hasMedia
}

export function showsCaptureCard(
  step: Step,
  hasMedia: boolean,
  hasViewfinder: boolean,
  mode: LayoutMode,
): boolean {
  return step === "capture" && !hasMedia && !rendersEmbeddedViewfinder(step, hasMedia, hasViewfinder, mode)
}

export function viewfinderSessionActive(
  step: Step,
  viewfinderMounted: boolean,
  coveredByDetail: boolean,
  isReportView: boolean,
): boolean {
  return viewfinderMounted && step === "capture" && !coveredByDetail && isReportView
}

export function viewfinderResumeGraceEligible(
  step: Step,
  viewfinderMounted: boolean,
  coveredByDetail: boolean,
  isReportView: boolean,
): boolean {
  return !isReportView && viewfinderSessionActive(step, viewfinderMounted, coveredByDetail, true)
}

export function pickLayerVisible(
  picking: boolean,
  coveredByDetail: boolean,
  isReportView: boolean,
): boolean {
  return picking && !coveredByDetail && isReportView
}

// These refusals come back identical however often the same draft is re-sent, so a bare retry loops.
const DEFINITIVE_SUBMIT_CODES: ReadonlySet<string> = new Set([
  "VALIDATION",
  "GPS_IMPLAUSIBLE",
  "MEDIA_REJECTED",
  "NOT_ROUTABLE",
])

const FIELD_STEPS: Readonly<Record<string, Step>> = {
  mediaUploadIds: "capture",
  media: "capture",
  category: "category",
  type: "category",
  title: "details",
  description: "details",
  lat: "location",
  lng: "location",
  geomSource: "location",
  addr: "review",
}

const CODE_STEPS: Readonly<Record<string, Step>> = {
  MEDIA_REJECTED: "capture",
  GPS_IMPLAUSIBLE: "location",
  NOT_ROUTABLE: "location",
}

export interface SubmitRecovery {
  retryable: boolean
  editStep: Step
}

export function submitErrorRecovery(
  code: string | undefined,
  fields: Record<string, string> | undefined,
  order: readonly Step[],
): SubmitRecovery {
  const fieldKeys = Object.keys(fields ?? {}).map((key) => key.split(".")[0] ?? key)
  const fieldStep = fieldKeys.map((key) => FIELD_STEPS[key]).find((s): s is Step => s !== undefined)
  const wanted = fieldStep ?? (code !== undefined ? CODE_STEPS[code] : undefined) ?? "review"
  const editStep = order.includes(wanted) ? wanted : "review"
  const staleUploads = code === "VALIDATION" && fieldKeys.includes("mediaUploadIds")
  const retryable = code === undefined || !DEFINITIVE_SUBMIT_CODES.has(code) || staleUploads
  return { retryable, editStep }
}
