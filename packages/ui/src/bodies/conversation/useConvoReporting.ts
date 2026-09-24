import { useCallback, useState } from "react"
import type { ContentReportReason, ContentReportSubject } from "@civfix/shared"
import { useToast } from "../../primitives"
import { useReportContent } from "../../data"
import { useT } from "../../i18n"

interface ReportTarget {
  subjectType: ContentReportSubject
  subjectId: string
  label: string
}

export function useConvoReporting() {
  const { t } = useT("conversation")
  const toast = useToast()
  const reportContent = useReportContent()
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null)
  const onReportMessage = useCallback((messageId: string) => {
    reportContent.reset()
    setReportTarget({ subjectType: "message", subjectId: messageId, label: t("report.subject_message") })
  }, [reportContent, t])
  const onReportPhoto = useCallback((mediaId: string) => {
    reportContent.reset()
    setReportTarget({ subjectType: "photo", subjectId: mediaId, label: t("report.subject_photo") })
  }, [reportContent, t])
  const closeReport = useCallback(() => {
    if (reportContent.isPending) return
    setReportTarget(null)
  }, [reportContent.isPending])
  const onSubmitReport = useCallback(
    (reason: ContentReportReason, details?: string) => {
      if (!reportTarget) return
      reportContent.mutate(
        {
          subjectType: reportTarget.subjectType,
          subjectId: reportTarget.subjectId,
          reason,
          ...(details ? { details } : {}),
        },
        {
          onSuccess: () => {
            setReportTarget(null)
            toast.show(t("report.submitted"), { variant: "success" })
          },
        },
      )
    },
    [reportTarget, reportContent, toast, t],
  )
  return { reportTarget, reportContent, onReportMessage, onReportPhoto, closeReport, onSubmitReport }
}
