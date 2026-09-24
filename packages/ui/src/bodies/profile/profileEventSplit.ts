/**
 * Pure so the body can memoize it instead of re-filtering the lists four times on every keystroke.
 *
 * Two sources, not one: the profile carries `upcomingEvents` beside `pastEvents`, and `pastEvents` is
 * strictly past (DECISIONS section 20), so the upcoming buckets come from the upcoming
 * list and the past buckets from the past list, each split only by who organized it. The upcoming list is
 * viewer-scoped server-side: a PUBLIC viewer gets hosting only, the owner gets hosting AND attending, which
 * is why `upcomingGoing` is legitimately empty on someone else's profile and is not a bug to "fix" here.
 *
 * BACK-COMPAT: an older server sends no `upcomingEvents` at all, and its `pastEvents` still carries future
 * events too. `upcomingEvents === undefined` therefore selects the single-list behaviour (one list split
 * by `scheduledAt` against `now`), so the section never regresses against a 0.37 backend. An EMPTY
 * array is not the same signal as `undefined`: it means the server answered and this person has nothing
 * upcoming, and the past list must not be re-sliced by time in that case.
 */
import type { CleanupDTO } from "@civfix/shared"
import { hasEventEnded } from "@civfix/shared/host"

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
  now: number,
): ProfileEventSplit {
  const split: ProfileEventSplit = {
    upcomingHosting: [],
    upcomingGoing: [],
    pastHosted: [],
    pastAttended: [],
  }

  if (upcomingEvents === undefined) {
    for (const event of pastEvents) {
      const notYetOver = !hasEventEnded(event, now)
      const hosted = event.organizer.id === profileId
      if (notYetOver) {
        ;(hosted ? split.upcomingHosting : split.upcomingGoing).push(event)
      } else {
        ;(hosted ? split.pastHosted : split.pastAttended).push(event)
      }
    }
    return split
  }

  for (const event of upcomingEvents) {
    const hosted = event.organizer.id === profileId
    ;(hosted ? split.upcomingHosting : split.upcomingGoing).push(event)
  }
  for (const event of pastEvents) {
    const hosted = event.organizer.id === profileId
    ;(hosted ? split.pastHosted : split.pastAttended).push(event)
  }
  return split
}
