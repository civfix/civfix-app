/**
 * The two pure state machines of the event LIFECYCLE region on the event detail (P2):
 *
 *   - `eventCompletionState`  - should the host see "Mark completed", and is it armed yet?
 *   - `hoursReceiptState`     - what does an ATTENDEE see about the hours the host credited?
 *
 * `now` is INJECTED into both. Nothing in this file reads the clock, so a body can memoize on a
 * ticking `now` and the tests never need fake timers (the `bodies/__tests__` house pattern -
 * profileEventSplit / eventBlendScore).
 */
import type { CleanupStatus } from "@civfix/shared"

export type EventCompletionState =
  /** Not an acting host, or the event is already done / cancelled - render nothing. */
  | "hidden"
  /** Acting host, but the event has not started yet - the affordance is visible and disarmed. */
  | "too-early"
  /** Acting host, the start time has passed, status is upcoming|active - the action is armed. */
  | "ready"

/**
 * Mirrors the server gate on `completeCleanup` exactly: acting host (organizer OR cohost),
 * `status !== "cancelled"`, `scheduledAt <= now`. Keeping the two in step is the point of this
 * function - a "ready" that the server would 409 is worse than a button that says "not yet".
 *
 * BOUNDARY: `scheduledAt === now` is "ready" (the server's gate is `<=`, not `<`).
 *
 * An UNPARSEABLE `scheduledAt` fails CLOSED to "too-early": we cannot show it has started, and
 * arming an irreversible action on a date we could not read would just produce a server rejection.
 */
export function eventCompletionState(input: {
  actsAsHost: boolean
  status: CleanupStatus
  scheduledAt: string
  now: number
}): EventCompletionState {
  if (!input.actsAsHost) return "hidden"
  if (input.status === "done" || input.status === "cancelled") return "hidden"
  const at = new Date(input.scheduledAt).getTime()
  if (Number.isNaN(at)) return "too-early"
  return at <= input.now ? "ready" : "too-early"
}

export type HoursReceiptState =
  /** Event not done, the viewer is an acting host, or the viewer never joined - render nothing. */
  | "hidden"
  /** Done + attended, and the host has logged nothing at all yet. */
  | "pending"
  /** Done + attended, and the viewer has a credited row. */
  | "credited"
  /** Done + attended, hours WERE logged for this event, but not for the viewer. */
  | "not-credited"

/**
 * The attendee-facing receipt. Hosts are excluded deliberately: they get the logged-hours summary
 * card (their own editor) instead, and a host reading a "the host hasn't logged yet" line about
 * themselves is nonsense.
 *
 * `anyLogged` comes from `EventHoursResponse.anyLogged`, which the server sets on the `scope: "self"`
 * branch from a cheap EXISTS probe. It is `.optional()` on the wire, so callers pass
 * `res.anyLogged ?? false`: an OLDER server (which omits it) degrades to `pending` rather than lying
 * to an uncredited attendee with `not-credited`. That is why this parameter is a plain `boolean` and
 * the `?? false` lives at the call site - the degrade is a wire concern, not a state-machine one.
 *
 * (This supersedes the design doc's earlier "scope self cannot know this - pass false" note, which
 * made `not-credited` unreachable for the exact viewer the copy was written for.)
 *
 * `myHours` must be > 0 to count as credited: a zero-hour row is not a credit, and printing
 * "you were credited 0.0 hours" would be worse than the honest `not-credited` line.
 */
export function hoursReceiptState(input: {
  status: CleanupStatus
  actsAsHost: boolean
  joined: boolean
  myHours: number | null
  anyLogged: boolean
}): HoursReceiptState {
  if (input.status !== "done") return "hidden"
  if (input.actsAsHost) return "hidden"
  if (!input.joined) return "hidden"
  if (input.myHours !== null && input.myHours > 0) return "credited"
  return input.anyLogged ? "not-credited" : "pending"
}

export const EVENT_END_GRACE_MS = 24 * 60 * 60 * 1000

export interface EventWindow {
  scheduledAt: string
  endsAt?: string | null
}

export function hasEventEnded(event: EventWindow, now: number): boolean {
  const ends = event.endsAt == null ? Number.NaN : Date.parse(event.endsAt)
  if (!Number.isNaN(ends)) return ends < now
  const starts = Date.parse(event.scheduledAt)
  if (Number.isNaN(starts)) return true
  return starts + EVENT_END_GRACE_MS < now
}
