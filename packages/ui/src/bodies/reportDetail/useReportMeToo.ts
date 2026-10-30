import { useCallback } from "react"
import { OPEN_REPORT_STATUSES, type ReportDTO } from "@civfix/contract"
import {
  useConfirmReport,
  useMarkReportFixed,
  useRequireAuth,
  useUnconfirmReport,
  useUnmarkReportFixed,
} from "../../data"
import { pathForEntry } from "../../nav"
import { useToast } from "../../primitives/toastContext"
import { useT } from "../../i18n"

// Both votes say whether someone else's problem is still there (#156 D2): never on your own report, never once
// it is resolved, whatever the caller voted before.
export function canMeToo(report: Pick<ReportDTO, "mine" | "status">): boolean {
  return !report.mine && OPEN_REPORT_STATUSES.includes(report.status)
}

/** "I see this too" and "This is fixed" on a report's page: one vote per account, so pressing one moves it. */
export function useReportMeToo(report: ReportDTO) {
  const { t } = useT("report-detail")
  const requireAuth = useRequireAuth()
  const toast = useToast()
  const { mutate: confirm } = useConfirmReport(report.id)
  const { mutate: unconfirm } = useUnconfirmReport(report.id)
  const { mutate: markFixed } = useMarkReportFixed(report.id)
  const { mutate: unmarkFixed } = useUnmarkReportFixed(report.id)
  const next = pathForEntry({ kind: "pin", id: report.referenceCode ?? report.id })
  const vote = useCallback(
    (send: typeof confirm) => {
      requireAuth(
        () =>
          send(undefined, { onError: () => toast.show(t("confirm.error"), { variant: "error" }) }),
        {
          next,
        },
      )
    },
    [requireAuth, toast, t, next],
  )
  const confirmed = report.confirmedByMe
  const fixed = report.fixedByMe
  const onSeen = useCallback(
    () => vote(confirmed ? unconfirm : confirm),
    [vote, confirmed, confirm, unconfirm],
  )
  const onFixed = useCallback(
    () => vote(fixed ? unmarkFixed : markFixed),
    [vote, fixed, markFixed, unmarkFixed],
  )
  return {
    visible: canMeToo(report),
    confirmCount: report.confirmCount,
    fixedCount: report.fixedCount,
    seen: { pressed: confirmed, onPress: onSeen },
    fixed: { pressed: fixed, onPress: onFixed },
  }
}
