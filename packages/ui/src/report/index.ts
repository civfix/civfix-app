// @civfix/ui/report barrel - the shared report-wizard state + submit pipeline + the report-type taxonomy
// (UI-unification Stage 4 slice 7). The unified ReportFlowBody (../bodies/ReportFlowBody) reads/writes the
// draft store and runs `useReportSubmit`; both hosts' deep-link entry points re-point here. The actual
// native camera + byte preparation live behind the CAMERA capability seam (../capabilities), not here, so
// this module stays platform-neutral (no expo-* / next import).
export { useDraftReportStore } from "./draftStore"
export type {
  DraftReport,
  DraftMedia,
  DraftMediaInput,
  DraftFlags,
  DraftCategory,
  GeomSource,
} from "./draftStore"

export { useReportSubmit } from "./submit"

export { REPORT_TYPES, reportTypeById } from "./reportTypes"
export type { ReportType } from "./reportTypes"
