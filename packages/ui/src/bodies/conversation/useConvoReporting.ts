import { useCallback } from "react"
import { useT } from "../../i18n"
import { useContentReportSheet } from "../useContentReportSheet"

export function useConvoReporting() {
  const { t } = useT("conversation")
  const sheet = useContentReportSheet({ submittedToast: t("report.submitted") })
  const { open } = sheet
  const onReportMessage = useCallback((messageId: string) => {
    open({ subjectType: "message", subjectId: messageId, label: t("report.subject_message") })
  }, [open, t])
  const onReportPhoto = useCallback((mediaId: string) => {
    open({ subjectType: "photo", subjectId: mediaId, label: t("report.subject_photo") })
  }, [open, t])
  return { ...sheet, onReportMessage, onReportPhoto }
}
