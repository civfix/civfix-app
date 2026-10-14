/** The selection logic behind MemberPicker, kept RN-free so it unit-tests directly under vitest. */
import type { PersonDTO, UserSearchResultDTO } from "@civfix/shared"

/**
 * Toggle `person` in `selected`:
 *   - already selected (by id)  -> removed.
 *   - excluded (excludeIds)     -> no-op (the row should not be selectable; defensive here too).
 *   - otherwise                 -> appended once (dedupe by id - a double-tap can never add twice).
 * Returns the SAME array reference on a no-op so React state setters can skip the update.
 */
export function toggleMember(
  selected: PersonDTO[],
  person: PersonDTO,
  excludeIds?: readonly string[],
): PersonDTO[] {
  if (selected.some((p) => p.id === person.id)) {
    return selected.filter((p) => p.id !== person.id)
  }
  if (excludeIds?.includes(person.id)) return selected
  return [...selected, person]
}

export function removeMember(selected: PersonDTO[], id: string): PersonDTO[] {
  if (!selected.some((p) => p.id === id)) return selected
  return selected.filter((p) => p.id !== id)
}

export function filterExcluded<T extends { id: string }>(
  results: readonly T[],
  excludeIds?: readonly string[],
): T[] {
  if (!excludeIds || excludeIds.length === 0) return [...results]
  return results.filter((r) => !excludeIds.includes(r.id))
}

export function personToSearchResult(p: PersonDTO): UserSearchResultDTO {
  return {
    id: p.id,
    handle: p.handle ?? "",
    displayName: p.name,
    avatar: p.avatar,
    avatarUrl: p.avatarUrl ?? null,
  }
}

/**
 * A @handle search hit as a PersonDTO (the picker's selection currency and what CreateChatGroup /
 * AddGroupMembers callers thread through). The social counts are not part of the search DTO; they are
 * zero-filled - the picker only renders id/name/handle/avatar.
 */
export function searchResultToPerson(r: UserSearchResultDTO): PersonDTO {
  return {
    id: r.id,
    name: r.displayName,
    handle: r.handle,
    avatar: r.avatar,
    avatarUrl: r.avatarUrl ?? null,
    followers: 0,
    following: 0,
    isFollowing: false,
  }
}
