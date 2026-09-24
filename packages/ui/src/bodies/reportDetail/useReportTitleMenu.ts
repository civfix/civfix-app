import { useCallback, useState } from "react"
import type { ReportDTO } from "@civfix/shared"
import { usePopoverAnchor, useToast } from "../../primitives"
import type { AnchorRect, PopoverMenuItem } from "../../primitives"
import { shareLink, absoluteUrl } from "../../primitives/share"
import { useRequireAuth, useUnlistReport } from "../../data"
import type { IconName } from "../../typography"
import { useNavStore } from "../../nav"
import { useT } from "../../i18n"
import type { ContentReportTarget } from "../useContentReportSheet"

export function useReportTitleMenu(
  report: ReportDTO,
  title: string,
  openReport: (target: ContentReportTarget) => void,
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
