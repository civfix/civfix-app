import type { CheckinResultDTO } from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"

export interface SeatCheckInOutcome {
  done: string[]
  failed: number
  last: CheckinResultDTO | null
  firstError: unknown
}

/**
 * The contract checks in one seat per request, so a party is a sequence of calls. They run one at a
 * time and a failed seat does not stop the rest: the host sees how many landed, and the first error.
 */
export async function checkInSeats(
  api: Pick<ApiClient, "checkInEventSeat">,
  eventId: string,
  seatIds: readonly string[],
): Promise<SeatCheckInOutcome> {
  const done: string[] = []
  let failed = 0
  let last: CheckinResultDTO | null = null
  let firstError: unknown = null
  for (const seatId of seatIds) {
    try {
      last = await api.checkInEventSeat({ id: eventId, seatId, method: "manual" })
      done.push(seatId)
    } catch (err) {
      failed += 1
      if (firstError === null) firstError = err
    }
  }
  return { done, failed, last, firstError }
}
