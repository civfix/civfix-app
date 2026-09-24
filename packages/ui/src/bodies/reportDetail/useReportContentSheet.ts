import { useCallback } from "react"
import { useRequireAuth } from "../../data"
import { pathForEntry } from "../../nav"
import { useT } from "../../i18n"
import { useContentReportSheet } from "../useContentReportSheet"

export function useReportContentSheet(reportId: string) {
  const { t } = useT("report-detail")
  const requireAuth = useRequireAuth()
  const sheet = useContentReportSheet({ submittedToast: t("content_report.submitted_toast") })
  const { open } = sheet
  const onReportPhoto = useCallback(
    (mediaId: string) => open({ subjectType: "photo", subjectId: mediaId, label: t("subject_label.photo") }),
    [open, t],
  )
  const onReportGalleryPhoto = useCallback(
    (mediaId: string) =>
      requireAuth(() => onReportPhoto(mediaId), { next: pathForEntry({ kind: "pin", id: reportId }) }),
    [onReportPhoto, requireAuth, reportId],
  )

  return { ...sheet, onReportGalleryPhoto }
}
