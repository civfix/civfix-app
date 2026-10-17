import { useCallback } from "react"
import { OPEN_REPORT_STATUSES, type ReportDTO } from "@civfix/contract"
import { useConfirmReport, useRequireAuth } from "../../data"
import { pathForEntry } from "../../nav"
import { useToast } from "../../primitives/toastContext"
import { useT } from "../../i18n"

// Me too is a signal that someone else's problem is real and still open (#156 D2): never on your own
// report, never once it is resolved, whatever confirmedByMe says.
export function canMeToo(report: Pick<ReportDTO, "mine" | "status">): boolean {
  return !report.mine && OPEN_REPORT_STATUSES.includes(report.status)
}

export function useReportMeToo(report: ReportDTO) {
  const { t } = useT("report-detail")
  const requireAuth = useRequireAuth()
  const toast = useToast()
  const confirm = useConfirmReport(report.id)
  const { mutate } = confirm
  const pressed = report.confirmedByMe
  const onPress = useCallback(() => {
    requireAuth(
      () =>
        mutate(!pressed, {
          onError: () => toast.show(t("confirm.error"), { variant: "error" }),
        }),
      { next: pathForEntry({ kind: "pin", id: report.referenceCode ?? report.id }) },
    )
  }, [requireAuth, mutate, pressed, toast, t, report.referenceCode, report.id])
  return {
    visible: canMeToo(report),
    pressed,
    count: report.confirmCount,
    onPress,
  }
}
