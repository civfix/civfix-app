import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ContentReportReason } from "@civfix/shared"
import { PopoverMenu, type AnchorRect, type PopoverMenuItem } from "../primitives/PopoverMenu"
import { ReportContentSheet } from "../primitives/ReportContentSheet"
import { useToast } from "../primitives/Toast"
import { absoluteUrl } from "../primitives/share"
import { useAuthState, useMyProfile, useReportContent, useRequireAuth } from "../data"
import { useDeletePost, useRepost } from "../data/hooks/posts"
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

const noop = () => {}

export function PostOverflowMenu(props: PostOverflowMenuProps) {
  const [reportOpen, setReportOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [retained, setRetained] = useState(false)
  const active = props.visible || reportOpen || busy || confirmingDelete
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    if (active) setRetained(true)
  }, [active])
  const onSurfaceClosed = useCallback(() => {
    if (!activeRef.current) setRetained(false)
  }, [])

  if (!active && !retained) return null
  return (
    <PostOverflowMenuContent
      {...props}
      reportOpen={reportOpen}
      onReportOpenChange={setReportOpen}
      confirmingDelete={confirmingDelete}
      onConfirmingDeleteChange={setConfirmingDelete}
      onBusyChange={setBusy}
      onSurfaceClosed={onSurfaceClosed}
    />
  )
}

interface PostOverflowMenuContentProps extends PostOverflowMenuProps {
  reportOpen: boolean
  onReportOpenChange: (open: boolean) => void
  confirmingDelete: boolean
  onConfirmingDeleteChange: (confirming: boolean) => void
  onBusyChange: (busy: boolean) => void
  onSurfaceClosed: () => void
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
  onSurfaceClosed,
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
  const repost = subject.repost
  const isOwn = isAuthenticated && viewerId != null && viewerId === subject.authorId
  const canDelete = isOwn && repost === null
  const isOwnRepost = isAuthenticated && viewerId != null && repost !== null && viewerId === repost.authorId
  const undoRepost = useRepost(subjectId)

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

  const undoRepostMutate = undoRepost.mutate
  const runUndoRepost = useCallback(() => {
    undoRepostMutate(true, {
      onError: () => toast.show(t("post_card.menu.undo_repost_failed"), { variant: "error" }),
    })
  }, [t, toast, undoRepostMutate])

  // The delete's optimistic update removes the row this menu belongs to, and TanStack drops per-call
  // mutate callbacks once their observer unmounts, so the outcome is read from the promise instead.
  const deletePost = del.mutateAsync
  const runDelete = useCallback(() => {
    onBusyChange(true)
    deletePost(subjectId)
      .then(
        () => {
          toast.show(t("post_card.menu.deleted"))
          onDeleted?.()
        },
        () => toast.show(t("post_card.menu.delete_failed"), { variant: "error" }),
      )
      .finally(() => onBusyChange(false))
  }, [deletePost, onBusyChange, onDeleted, subjectId, t, toast])

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
      ...(isOwnRepost
        ? [
            {
              key: "undo-repost",
              label: t("post_card.menu.undo_repost"),
              icon: "Repeat2" as const,
              disabled: undoRepost.isPending,
              onPress: runUndoRepost,
            },
          ]
        : []),
      ...(canDelete
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
      canDelete,
      clipboard,
      copyLink,
      del.isPending,
      isOwnRepost,
      onConfirmingDeleteChange,
      onOpenOriginal,
      onOpenPerson,
      runUndoRepost,
      startReport,
      t,
      undoRepost.isPending,
    ],
  )

  return (
    <>
      <PopoverMenu
        visible={visible && !confirmingDelete}
        onClose={onClose}
        onClosed={onSurfaceClosed}
        anchorRect={anchorRect}
        items={items}
      />
      <PopoverMenu
        visible={confirmingDelete}
        onClose={closeConfirmDelete}
        onClosed={onSurfaceClosed}
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
        onClosed={onSurfaceClosed}
      />
    </>
  )
}
