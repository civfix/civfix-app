import { useCallback, useState } from "react"
import type { ContentReportReason } from "@civfix/shared"
import { usePopoverAnchor, useToast } from "../../primitives"
import type { AnchorRect } from "../../primitives"
import { useBlockUser, useUnblockUser, useReportContent, useRequireAuth } from "../../data"
import { useNavStore } from "../../nav"
import { useT } from "../../i18n"

export function usePersonModeration(profileId: string | undefined, profilePath: string) {
  const { t } = useT("profile-person")
  const requireAuth = useRequireAuth()
  const blockUser = useBlockUser()
  const unblockUser = useUnblockUser()
  const reportContent = useReportContent()
  const toast = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuRect, setMenuRect] = useState<AnchorRect | null>(null)
  const { ref: menuAnchorRef, measure: measureMenu } = usePopoverAnchor(setMenuRect)
  const [confirmingBlock, setConfirmingBlock] = useState(false)
  const [reporting, setReporting] = useState(false)

  const startBlock = useCallback(() => {
    setConfirmingBlock(true)
  }, [])
  const closeBlockConfirm = useCallback(() => {
    setConfirmingBlock(false)
  }, [])
  const confirmBlock = useCallback(() => {
    const blockId = profileId
    if (!blockId) return
    requireAuth(
      () =>
        blockUser.mutate(blockId, {
          onError: () => toast.show(t("block.error"), { variant: "error" }),
          onSuccess: () => {
            setConfirmingBlock(false)
            useNavStore.getState().back()
          },
        }),
      { next: profilePath },
    )
  }, [requireAuth, blockUser, profileId, profilePath, toast, t])
  const onUnblock = useCallback(() => {
    const targetId = profileId
    if (!targetId) return
    requireAuth(
      () =>
        unblockUser.mutate(targetId, {
          onError: () => toast.show(t("blocked.unblock_error"), { variant: "error" }),
        }),
      { next: profilePath },
    )
  }, [requireAuth, unblockUser, profileId, profilePath, toast, t])
  const startReport = useCallback(() => {
    requireAuth(
      () => {
        reportContent.reset()
        setReporting(true)
      },
      { next: profilePath },
    )
  }, [requireAuth, reportContent, profilePath])
  const closeReport = useCallback(() => {
    if (reportContent.isPending) return
    setReporting(false)
  }, [reportContent.isPending])
  const onSubmitReport = useCallback(
    (reason: ContentReportReason, details?: string) => {
      const subjectId = profileId
      if (!subjectId) return
      reportContent.mutate(
        { subjectType: "profile", subjectId, reason, ...(details ? { details } : {}) },
        {
          onSuccess: () => {
            setReporting(false)
            toast.show(t("report.toast_submitted"), { variant: "success" })
          },
        },
      )
    },
    [reportContent, profileId, toast, t],
  )
  const openMenu = useCallback(() => {
    measureMenu()
    setMenuOpen(true)
  }, [measureMenu])
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  return {
    blockUser,
    unblockUser,
    reportContent,
    menuOpen,
    menuRect,
    menuAnchorRef,
    openMenu,
    closeMenu,
    confirmingBlock,
    startBlock,
    closeBlockConfirm,
    confirmBlock,
    onUnblock,
    reporting,
    startReport,
    closeReport,
    onSubmitReport,
  }
}

export type PersonModeration = ReturnType<typeof usePersonModeration>
