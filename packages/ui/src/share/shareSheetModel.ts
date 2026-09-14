import type { PersonDTO, UserSearchResultDTO } from "@civfix/shared"
import { filterExcluded } from "../bodies/memberSelect"
import type { IconName } from "../typography"

export type SharePeopleMode = "recent" | "results" | "prompt"

export interface SharePeopleView {
  mode: SharePeopleMode
  rows: UserSearchResultDTO[]
}

export function sharePeopleView(input: {
  query: string
  suggested: readonly UserSearchResultDTO[]
  results: readonly UserSearchResultDTO[]
  excludeIds?: readonly string[]
}): SharePeopleView {
  if (input.query.length > 0) {
    return { mode: "results", rows: filterExcluded(input.results, input.excludeIds) }
  }
  const recent = filterExcluded(input.suggested, input.excludeIds)
  return recent.length > 0 ? { mode: "recent", rows: recent } : { mode: "prompt", rows: [] }
}

export type ShareSheetFooter = "compose" | "actions"

export function shareSheetFooter(isAuthenticated: boolean, selectedCount: number): ShareSheetFooter {
  return isAuthenticated && selectedCount > 0 ? "compose" : "actions"
}

export function isShareRecipient(selected: readonly PersonDTO[], id: string): boolean {
  return selected.some((person) => person.id === id)
}

export type ShareCopyState = "idle" | "copied" | "failed"

export type ShareTileTone = "default" | "success" | "danger"

export interface ShareTileFace {
  icon: IconName
  label: string
  tone: ShareTileTone
}

export interface ShareCopyLabels {
  idle: string
  copied: string
  failed: string
}

export function shareCopyTileFace(state: ShareCopyState, labels: ShareCopyLabels): ShareTileFace {
  switch (state) {
    case "copied":
      return { icon: "Check", label: labels.copied, tone: "success" }
    case "failed":
      return { icon: "Close", label: labels.failed, tone: "danger" }
    default:
      return { icon: "Copy", label: labels.idle, tone: "default" }
  }
}
