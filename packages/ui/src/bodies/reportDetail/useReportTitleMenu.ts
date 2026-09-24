import { useCallback, useState } from "react"
import type { ContentReportReason, ContentReportSubject, ReportDTO } from "@civfix/shared"
import { usePopoverAnchor, useToast } from "../../primitives"
import type { AnchorRect, PopoverMenuItem } from "../../primitives"
import { shareLink, absoluteUrl } from "../../primitives/share"
import { useRequireAuth, useReportContent, useUnlistReport } from "../../data"
import type { IconName } from "../../typography"
import { useNavStore } from "../../nav"
import { useT } from "../../i18n"

interface ReportTarget {
  subjectType: ContentReportSubject
  subjectId: string
  label: string
}

export function useReportContentSheet(reportId: string) {
  const { t } = useT("report-detail")
  const requireAuth = useRequireAuth()
  const reportContent = useReportContent()
  const toast = useToast()
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null)
  const openReport = useCallback(
    (target: ReportTarget) => {
      reportContent.reset()
      setReportTarget(target)
    },
    [reportContent],
  )
  const onReportPhoto = useCallback(
    (mediaId: string) =>
      openReport({ subjectType: "photo", subjectId: mediaId, label: t("subject_label.photo") }),
    [openReport, t],
  )
  const onReportGalleryPhoto = useCallback(
    (mediaId: string) =>
      requireAuth(() => onReportPhoto(mediaId), { next: `/pin/${reportId}` }),
    [onReportPhoto, requireAuth, reportId],
  )
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
            toast.show(t("content_report.submitted_toast"), { variant: "success" })
          },
        },
      )
    },
    [reportTarget, reportContent, toast, t],
  )

  return {
    reportTarget,
    pending: reportContent.isPending,
    failed: reportContent.isError,
    openReport,
    onReportGalleryPhoto,
    closeReport,
    onSubmitReport,
  }
}

export function useReportTitleMenu(
  report: ReportDTO,
  title: string,
  openReport: (target: ReportTarget) => void,
) {
  const { t } = useT("report-detail")
  const requireAuth = useRequireAuth()
  const toast = useToast()
  const unlist = useUnlistReport(report.id)
  const [titleMenuOpen, setTitleMenuOpen] = useState(false)
  const [titleMenuRect, setTitleMenuRect] = useState<AnchorRect | null>(null)
  const { ref: titleMenuAnchorRef, measure: measureTitleMenu } = usePopoverAnchor(setTitleMenuRect)
  const sharePath = `/pin/${report.referenceCode ?? report.id}`
  const onShare = useCallback(() => {
    void shareLink({
      title,
      path: sharePath,
      message: t("common-share:sheet.message", { title, url: absoluteUrl(sharePath) }),
    }).then((result) => {
      if (result === "copied") {
        toast.show(t("common-share:button.copied"), { variant: "success" })
      }
    })
  }, [title, sharePath, t, toast])
  const onHostEvent = useCallback(() => {
    requireAuth(
      () => useNavStore.getState().push({ kind: "create-cleanup", reportId: report.id }),
      { next: "/host" },
    )
  }, [requireAuth, report.id])

  const titleMenuItems: PopoverMenuItem[] = [
    {
      key: "share",
      label: t("common-share:button.label"),
      icon: "Share",
      onPress: onShare,
    },
    {
      key: "host-event",
      label: t("actions.host_event"),
      icon: "Megaphone",
      onPress: onHostEvent,
    },
    ...(report.mine
      ? [
          {
            key: report.visibility === "hidden" ? "relist" : "unlist",
            label:
              report.visibility === "hidden"
                ? t("title_menu.show_on_map_again")
                : t("title_menu.hide_from_map"),
            icon: (report.visibility === "hidden" ? "MapPin" : "Lock") as IconName,
            onPress: () => unlist.mutate(report.visibility !== "hidden"),
          },
        ]
      : []),
    {
      key: "report",
      label: t("title_menu.report_this"),
      icon: "Flag",
      onPress: () =>
        requireAuth(
          () =>
            openReport({
              subjectType: "report",
              subjectId: report.id,
              label: t("subject_label.report"),
            }),
          { next: `/pin/${report.id}` },
        ),
    },
  ]

  const openTitleMenu = useCallback(() => {
    measureTitleMenu()
    setTitleMenuOpen(true)
  }, [measureTitleMenu])
  const closeTitleMenu = useCallback(() => setTitleMenuOpen(false), [])

  return {
    titleMenuItems,
    titleMenuOpen,
    titleMenuRect,
    titleMenuAnchorRef,
    openTitleMenu,
    closeTitleMenu,
  }
}
