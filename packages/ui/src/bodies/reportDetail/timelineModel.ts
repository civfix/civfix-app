import type { ReportDTO, ReportStatus } from "@civfix/shared"
import type { TFunction } from "i18next"
import { type NodeKind, kindForStatus, citizenStatusLabel } from "../../primitives/reportTimelineLabels"
import { timelineEntryRender } from "../../primitives/reportTimelineModel"

export interface TimelineNode {
  kind: NodeKind
  when: string
  text: string
  detail?: string
  pending?: boolean
  note?: string
  body?: string
}

export function buildTimeline(
  report: ReportDTO,
  t: TFunction,
  rel: (iso: string) => string,
): TimelineNode[] {
  const nodes: TimelineNode[] = []
  nodes.push({
    kind: "submitted",
    when: rel(report.createdAt),
    text: report.mine ? t("timeline.reported_by_you") : t("timeline.reported_by_neighbor"),
  })

  if (report.gov) {
    nodes.push({
      kind: "forwarded",
      when: rel(report.publishedAt ?? report.createdAt),
      text: t("timeline.forwarded_to_city"),
    })
  } else {
    nodes.push({
      kind: "pending",
      when: rel(report.createdAt),
      text: t("timeline.pending_submission"),
      pending: true,
    })
  }

  let prevStatus: ReportStatus | null = null
  report.timeline.forEach((entry, i) => {
    const render = timelineEntryRender(entry, i, prevStatus)
    prevStatus = entry.status
    if (render === "skip") return
    if (render === "hidden") {
      nodes.push({ kind: "hidden", when: rel(entry.at), text: t("timeline.hidden_from_map") })
      return
    }
    if (render === "unhidden") {
      nodes.push({ kind: "unhidden", when: rel(entry.at), text: t("timeline.shown_on_map_again") })
      return
    }
    if (render === "reopened") {
      nodes.push({
        kind: "reopened",
        when: rel(entry.at),
        text: t("timeline.reopened"),
        detail: entry.note ?? undefined,
      })
      return
    }
    if (render === "reply") {
      nodes.push({
        kind: "forwarded",
        when: rel(entry.at),
        text: t("timeline.reply_from_city"),
        detail: entry.note ?? undefined,
        ...(entry.body !== undefined ? { body: entry.body } : {}),
      })
      return
    }
    if (render === "note") {
      nodes.push({
        kind: "note",
        when: rel(entry.at),
        text: t("timeline.update"),
        detail: entry.note ?? undefined,
      })
      return
    }
    nodes.push({
      kind: kindForStatus(entry.status),
      when: rel(entry.at),
      text: citizenStatusLabel(t, entry.status),
      detail: entry.note ?? undefined,
    })
  })

  const linked = [...report.linkedEvents].sort(
    (a, b) => new Date(a.linkedAt).getTime() - new Date(b.linkedAt).getTime(),
  )
  for (const ev of linked) {
    nodes.push({
      kind: "linked",
      when: rel(ev.linkedAt),
      text: t("timeline.linked_to_cleanup", { title: ev.title }),
      detail: t("timeline.linked_to_cleanup_detail", { organizer: ev.organizer.name }),
    })
  }

  return nodes
}
