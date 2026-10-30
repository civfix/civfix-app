import type { ReportDTO, ReportFilingDTO, ReportStatus } from "@civfix/contract"
import type { TFunction } from "i18next"
import { type NodeKind, kindForStatus, citizenStatusLabel } from "../../primitives/reportTimelineLabels"
import { timelineEntryRender } from "../../primitives/reportTimelineModel"

export interface TimelineNode {
  key: string
  kind: NodeKind
  when: string
  text: string
  detail?: string | undefined
  caseId?: string
  caseUrl?: string
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
    key: "submitted",
    kind: "submitted",
    when: rel(report.createdAt),
    text: report.mine ? t("timeline.reported_by_you") : t("timeline.reported_by_neighbor"),
  })

  const filing = report.filing
  if (filing) {
    nodes.push(filedNode(filing, t, rel))
  } else if (report.gov) {
    nodes.push({
      key: "intake",
      kind: "forwarded",
      when: rel(report.publishedAt ?? report.createdAt),
      text: t("timeline.forwarded_to_city"),
    })
  } else {
    nodes.push({
      key: "intake",
      kind: "pending",
      when: rel(report.createdAt),
      text: t("timeline.pending_submission"),
      pending: true,
    })
  }

  let prevStatus: ReportStatus | null = null
  report.timeline.forEach((entry, i) => {
    // The log carries no id and only ever grows, so an entry's place in it is its identity.
    const key = `entry-${i}`
    const render = timelineEntryRender(entry, i, prevStatus)
    prevStatus = entry.status
    // The filed node stands for every routing of the report, including the "Sent to jurisdiction"
    // notes written before filings were recorded.
    if (filing && entry.kind === "route") return
    if (render === "skip") return
    if (render === "hidden") {
      nodes.push({ key, kind: "hidden", when: rel(entry.at), text: t("timeline.hidden_from_map") })
      return
    }
    if (render === "unhidden") {
      nodes.push({ key, kind: "unhidden", when: rel(entry.at), text: t("timeline.shown_on_map_again") })
      return
    }
    if (render === "reopened") {
      nodes.push({
        key,
        kind: "reopened",
        when: rel(entry.at),
        text: t("timeline.reopened"),
        detail: entry.note ?? undefined,
      })
      return
    }
    if (render === "reply") {
      nodes.push({
        key,
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
        key,
        kind: "note",
        when: rel(entry.at),
        text: t("timeline.update"),
        detail: entry.note ?? undefined,
      })
      return
    }
    nodes.push({
      key,
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
      key: `linked-${ev.id}`,
      kind: "linked",
      when: rel(ev.linkedAt),
      text: t("timeline.linked_to_cleanup", { title: ev.title }),
      detail: t("timeline.linked_to_cleanup_detail", { organizer: ev.organizer.name }),
    })
  }

  return nodes
}

function filedNode(
  filing: ReportFilingDTO,
  t: TFunction,
  rel: (iso: string) => string,
): TimelineNode {
  let text: string
  if (filing.linkedExisting) text = t("timeline.linked_existing")
  else if (filing.jurisdictionName) text = t("timeline.filed_with", { jurisdiction: filing.jurisdictionName })
  else text = t("timeline.filed_with_city")
  return {
    key: "intake",
    kind: "forwarded",
    when: rel(filing.filedAt),
    text,
    ...(filing.caseId ? { caseId: filing.caseId } : {}),
    // The server validated the URL; the client still opens nothing but https.
    ...(filing.caseUrl?.startsWith("https://") ? { caseUrl: filing.caseUrl } : {}),
  }
}
