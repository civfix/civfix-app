import type { PersonDTO, UserSearchResultDTO } from "@civfix/shared"
import { filterExcluded } from "../bodies/memberSelect"

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
