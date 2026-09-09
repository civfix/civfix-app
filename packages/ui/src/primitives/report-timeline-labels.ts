import type { ReportStatus } from "@civfix/shared"
import { themeFor, type ColorSchemeName } from "../theme"
import type { IconName } from "../typography"
import type { TFunction } from "i18next"

export type NodeKind =
  | "submitted"
  | "forwarded"
  | "pending"
  | "progress"
  | "resolved"
  | "rejected"
  | "linked"
  | "reopened"
  | "hidden"
  | "unhidden"
  | "note"

export const NODE_GLYPH: Record<NodeKind, IconName> = {
  submitted: "MapPin",
  forwarded: "Mail",
  pending: "Clock",
  progress: "Building2",
  resolved: "CheckCheck",
  rejected: "Close",
  linked: "Link2",
  reopened: "RefreshCw",
  hidden: "Lock",
  unhidden: "MapPin",
  note: "Info",
}

export function nodeColor(kind: NodeKind, scheme: ColorSchemeName): string {
  const colors = themeFor(scheme).colors
  switch (kind) {
    case "submitted":
    case "resolved":
    case "linked":
      return colors.brand.moss
    case "forwarded":
    case "reopened":
    case "hidden":
    case "unhidden":
    case "note":
      return colors.textSubtle
    case "pending":
      return colors.brand.sun
    case "rejected":
      return colors.brand.bloom
    case "progress":
    default:
      return colors.brand.sky
  }
}

export function kindForStatus(status: ReportStatus): NodeKind {
  switch (status) {
    case "submitted":
    case "held":
      return "submitted"
    case "published":
    case "acknowledged":
      return "forwarded"
    case "in_progress":
      return "progress"
    case "resolved":
      return "resolved"
    case "rejected":
      return "rejected"
    default:
      return "progress"
  }
}

export function citizenStatusLabel(t: TFunction, status: ReportStatus): string {
  switch (status) {
    case "resolved":
      return t("timeline.status.resolved")
    case "in_progress":
    case "acknowledged":
      return t("timeline.status.in_progress")
    case "held":
      return t("timeline.status.under_review")
    case "rejected":
      return t("timeline.status.removed")
    case "submitted":
    case "published":
    default:
      return t("timeline.status.not_forwarded")
  }
}
