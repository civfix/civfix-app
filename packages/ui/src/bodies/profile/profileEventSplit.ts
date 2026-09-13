/**
 * Split a profile's events into the four buckets the Events section renders. Pure + platform-neutral so the
 * body can memoize it instead of re-filtering the lists four times on every keystroke.
 *
 * TWO SOURCES, NOT ONE. Since contract 0.38 the profile carries `upcomingEvents` beside `pastEvents`, and
 * `pastEvents` is STRICTLY past (DECISIONS section 20) - so the upcoming buckets come from the upcoming
 * list and the past buckets from the past list, each split only by who organized it. The upcoming list is
 * viewer-scoped server-side: a PUBLIC viewer gets hosting only, the owner gets hosting AND attending, which
 * is why `upcomingGoing` is legitimately empty on someone else's profile and is not a bug to "fix" here.
 *
 * BACK-COMPAT: an older server sends no `upcomingEvents` at all, and its `pastEvents` still carries future
 * events too. `upcomingEvents === undefined` therefore selects the previous behaviour verbatim - one list,
 * split by `scheduledAt` against `now` - so the section never regresses against a 0.37 backend. An EMPTY
 * array is not the same signal as `undefined`: it means the server answered and this person has nothing
 * upcoming, and the past list must not be re-sliced by time in that case.
 */
import type { CleanupDTO } from "@civfix/shared"
import { hasEventEnded } from "@civfix/shared/host"

/**
 * The Events section's own Upcoming / Past selector. It lives beside the split it selects between (it used
 * to live in `bodies/profileViewModel.ts`, which the profile TAB BAR replaced) - the section builds its own
 * two-tab descriptor locally and no longer needs one handed down.
 */
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
      // An event that is UNDERWAY is upcoming here, matching the server's `ends_at > now()` window.
      const upcoming = !hasEventEnded(event, now)
      const hosted = event.organizer.id === profileId
      if (upcoming) {
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
