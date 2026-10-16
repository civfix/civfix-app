import { useCallback } from "react"
import { PUBLIC_REPORT_STATUSES, type ReportDTO } from "@civfix/contract"
import { useRequireAuth } from "../../data"
import { pathForEntry, useNavStore } from "../../nav"
import { usePostComposerStore } from "../postComposerStore"
import { buildComposerReportRef } from "../postComposerModel"

// Only a report everyone can already see can be reposted; the owner's hidden or
// moderated report never offers it.
export function canRepostReport(report: Pick<ReportDTO, "visibility" | "status">): boolean {
  return report.visibility === "public" && PUBLIC_REPORT_STATUSES.includes(report.status)
}

export function useReportRepost(report: ReportDTO) {
  const requireAuth = useRequireAuth()
  const visible = canRepostReport(report)
  const onRepost = useCallback(() => {
    requireAuth(
      () => {
        usePostComposerStore.getState().setAttachedReport(buildComposerReportRef(report))
        useNavStore.getState().push({ kind: "composer" })
      },
      { next: pathForEntry({ kind: "pin", id: report.referenceCode ?? report.id }) },
    )
  }, [report, requireAuth])
  return { visible, onRepost }
}
