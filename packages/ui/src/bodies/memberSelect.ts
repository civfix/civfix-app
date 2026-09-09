/**
 * memberSelect (P4 Task 4.7) - the PURE selection logic behind MemberPicker: toggling a person in the
 * selected list (dedupe by id), and filtering excluded ids out of both the selection and the search
 * results. Kept RN-free so it unit-tests directly under vitest (like chatPowers / pinCycle).
 */
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

/** Remove one selected member by id (the chip's X). Same-reference no-op when absent. */
export function removeMember(selected: PersonDTO[], id: string): PersonDTO[] {
  if (!selected.some((p) => p.id === id)) return selected
  return selected.filter((p) => p.id !== id)
}

/** Search results minus the excluded ids (e.g. people already in the group when adding members). */
export function filterExcluded<T extends { id: string }>(
  results: readonly T[],
  excludeIds?: readonly string[],
): T[] {
  if (!excludeIds || excludeIds.length === 0) return [...results]
  return results.filter((r) => !excludeIds.includes(r.id))
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
