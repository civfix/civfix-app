import React from "react"
import { LinkedEventCard } from "../LinkedEventCard"
import { LinkedReportCard } from "../LinkedReportCard"
import type { PostComposerAttach } from "../usePostComposerAttach"

export function AttachedEventCard({ attach }: { attach: PostComposerAttach }) {
  const { attachedEvent } = attach
  if (!attachedEvent) return null
  return (
    <LinkedEventCard
      event={attachedEvent}
      cleanup={attach.attachedCleanup}
      layout="list"
      timeZone={attachedEvent.timezone ?? undefined}
      selectable
      selected
      onRemove={attach.detachEvent}
    />
  )
}

export function AttachedReportCard({ attach }: { attach: PostComposerAttach }) {
  if (!attach.attachedReport) return null
  return <LinkedReportCard report={attach.attachedReport} layout="list" headline="title" onRemove={attach.detachReport} />
}
