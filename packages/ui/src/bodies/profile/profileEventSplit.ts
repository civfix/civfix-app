/**
 * Pure so the body can memoize it instead of re-filtering the lists four times on every keystroke.
 *
 * Two sources, not one: the profile carries `upcomingEvents` beside `pastEvents`, and `pastEvents` is
 * strictly past (DECISIONS section 20), so the upcoming buckets come from the upcoming
 * list and the past buckets from the past list, each split only by who organized it. The upcoming list is
 * viewer-scoped server-side: a PUBLIC viewer gets hosting only, the owner gets hosting AND attending, which
 * is why `upcomingGoing` is legitimately empty on someone else's profile and is not a bug to "fix" here.
 *
 * `upcomingEvents` stays optional in the contract, but every server since 0.38 sends it, so a missing list
 * only happens before the profile loads and reads as nothing upcoming.
 */
import type { CleanupDTO } from "@civfix/shared"

export type ProfileEventTab = "upcoming" | "past"

export interface ProfileEventSplit {
  upcomingHosting: CleanupDTO[]
  upcomingGoing: CleanupDTO[]
  pastHosted: CleanupDTO[]
  pastAttended: CleanupDTO[]
}

export function splitProfileEvents(
  pastEvents: readonly CleanupDTO[],
  upcomingEvents: readonly CleanupDTO[] | undefined,
  profileId: string,
): ProfileEventSplit {
  const split: ProfileEventSplit = {
    upcomingHosting: [],
    upcomingGoing: [],
    pastHosted: [],
    pastAttended: [],
  }

  for (const event of upcomingEvents ?? []) {
    const hosted = event.organizer.id === profileId
    ;(hosted ? split.upcomingHosting : split.upcomingGoing).push(event)
  }
  for (const event of pastEvents) {
    const hosted = event.organizer.id === profileId
    ;(hosted ? split.pastHosted : split.pastAttended).push(event)
  }
  return split
}
