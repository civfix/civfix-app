import React, { useCallback, useEffect, useMemo, useState } from "react"
import type { ContentReportReason } from "@civfix/shared"
import { PopoverMenu, type AnchorRect, type PopoverMenuItem } from "../primitives/PopoverMenu"
import { ReportContentSheet } from "../primitives/ReportContentSheet"
import { useToast } from "../primitives/Toast"
import { absoluteUrl } from "../primitives/share"
import { useAuthState, useMyProfile, useReportContent, useRequireAuth } from "../data"
import { useDeletePost } from "../data/hooks/posts"
import { useClipboard } from "../capabilities"
import { useT } from "../i18n"
import type { PostMenuSubject } from "./postCardModel"

export interface PostOverflowMenuProps {
  visible: boolean
  subject: PostMenuSubject
  onClose: () => void
  onOpenPerson: (personId: string) => void
  anchorRect?: AnchorRect | null
  onOpenOriginal?: () => void
  onDeleted?: () => void
}

const RELEASE_AFTER_CLOSE_MS = 400

const noop = () => {}

export function PostOverflowMenu(props: PostOverflowMenuProps) {
  const [reportOpen, setReportOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [retained, setRetained] = useState(false)
  const active = props.visible || reportOpen || busy || confirmingDelete

  useEffect(() => {
    if (active) {
      setRetained(true)
      return
    }
    const timer = setTimeout(() => setRetained(false), RELEASE_AFTER_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [active])

  if (!active && !retained) return null
  return (
    <PostOverflowMenuContent
      {...props}
      reportOpen={reportOpen}
      onReportOpenChange={setReportOpen}
      confirmingDelete={confirmingDelete}
      onConfirmingDeleteChange={setConfirmingDelete}
      onBusyChange={setBusy}
    />
  )
}

interface PostOverflowMenuContentProps extends PostOverflowMenuProps {
  reportOpen: boolean
  onReportOpenChange: (open: boolean) => void
  confirmingDelete: boolean
  onConfirmingDeleteChange: (confirming: boolean) => void
  onBusyChange: (busy: boolean) => void
}

function PostOverflowMenuContent({
  visible,
  subject,
  onClose,
  onOpenPerson,
  anchorRect,
  onOpenOriginal,
  onDeleted,
  reportOpen,
  onReportOpenChange,
  confirmingDelete,
  onConfirmingDeleteChange,
  onBusyChange,
}: PostOverflowMenuContentProps) {
  const { t } = useT("home-feed")
  const { isAuthenticated } = useAuthState()
  const requireAuth = useRequireAuth()
  const viewerId = useMyProfile().data?.profile?.id
  const del = useDeletePost()
  const toast = useToast()
  const clipboard = useClipboard()
  const reportContent = useReportContent()

  const subjectId = subject.id
  const subjectPath = `/post/${subjectId}`
  const isOwn = isAuthenticated && viewerId != null && viewerId === subject.authorId

  const submitReport = useCallback(
    (reason: ContentReportReason, details?: string) => {
      reportContent.mutate(
        { subjectType: "post", subjectId, reason, ...(details ? { details } : {}) },
        {
          onSuccess: () => {
            onReportOpenChange(false)
            toast.show(t("post_card.menu.reported"))
          },
        },
      )
    },
    [onReportOpenChange, subjectId, reportContent, t, toast],
  )

  const startReport = useCallback(
    () => requireAuth(() => onReportOpenChange(true), { next: subjectPath }),
    [requireAuth, onReportOpenChange, subjectPath],
  )

  const copyLink = useCallback(() => {
    if (!clipboard) return
    clipboard
      .setString(absoluteUrl(subjectPath))
      .then(() => toast.show(t("post_card.menu.link_copied")))
      .catch(() => toast.show(t("post_card.menu.link_copy_failed"), { variant: "error" }))
  }, [clipboard, subjectPath, t, toast])

  const runDelete = useCallback(() => {
    onBusyChange(true)
    del.mutate(subjectId, {
      onSuccess: () => {
        toast.show(t("post_card.menu.deleted"))
        onDeleted?.()
      },
      onError: () => toast.show(t("post_card.menu.delete_failed"), { variant: "error" }),
      onSettled: () => onBusyChange(false),
    })
  }, [del, onBusyChange, onDeleted, subjectId, t, toast])

  const closeConfirmDelete = useCallback(
    () => onConfirmingDeleteChange(false),
    [onConfirmingDeleteChange],
  )

  const confirmDeleteItems: PopoverMenuItem[] = [
    { key: "cancel", label: t("post_card.menu.cancel"), onPress: noop },
    {
      key: "confirm-delete",
      label: t("post_card.menu.delete_confirm"),
      icon: "Trash2",
      destructive: true,
      disabled: del.isPending,
      onPress: runDelete,
    },
  ]

  const authorId = subject.authorId
  const items: PopoverMenuItem[] = useMemo(
    () => [
      ...(onOpenOriginal
        ? [
            {
              key: "original",
              label: t("post_card.menu.go_to_original"),
              icon: "Repeat2" as const,
              onPress: onOpenOriginal,
            },
          ]
        : []),
      {
        key: "copy",
        label: t("post_card.menu.copy_link"),
        icon: "Copy" as const,
        disabled: !clipboard,
        onPress: copyLink,
      },
      ...(isOwn
        ? [
            {
              key: "delete",
              label: t("post_card.menu.delete"),
              icon: "Trash2" as const,
              destructive: true,
              disabled: del.isPending,
              onPress: () => onConfirmingDeleteChange(true),
            },
          ]
        : [
            ...(authorId
              ? [
                  {
                    key: "profile",
                    label: t("post_card.menu.view_profile"),
                    icon: "User" as const,
                    onPress: () => onOpenPerson(authorId),
                  },
                ]
              : []),
            {
              key: "report",
              label: t("post_card.menu.report"),
              icon: "Flag" as const,
              onPress: startReport,
            },
          ]),
    ],
    [
      authorId,
      clipboard,
      copyLink,
      del.isPending,
      isOwn,
      onConfirmingDeleteChange,
      onOpenOriginal,
      onOpenPerson,
      startReport,
      t,
    ],
  )

  return (
    <>
      <PopoverMenu
        visible={visible && !confirmingDelete}
        onClose={onClose}
        anchorRect={anchorRect}
        items={items}
      />
      <PopoverMenu
        visible={confirmingDelete}
        onClose={closeConfirmDelete}
        anchorRect={anchorRect}
        items={confirmDeleteItems}
      />
      <ReportContentSheet
        visible={reportOpen}
        subjectLabel={t("post_card.menu.report_subject")}
        pending={reportContent.isPending}
        error={reportContent.isError ? t("post_card.menu.report_failed") : null}
        onSubmit={submitReport}
        onClose={() => onReportOpenChange(false)}
      />
    </>
  )
}
