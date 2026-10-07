/**
 * The attendee-facing state machine of the event detail's lifecycle region. "Is it over" belongs to the
 * shared clock; this module only re-exports it so the detail surfaces keep one import site.
 */
import type { CleanupStatus } from "@civfix/shared"

export { hasEventEnded } from "@civfix/shared/host"

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
