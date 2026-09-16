import type { CleanupDTO, CleanupStatus } from "@civfix/shared"
import { safeDonationUrl } from "../primitives/donationUrl"

export interface DonationLink {
  url: string
  ownerName: string
}

export type DonationLinkSource = Pick<CleanupDTO, "title" | "donationUrl" | "organization" | "organizer">

export interface DonationViewer {
  /** The event's derived status. Only `cancelled` withdraws the ask. */
  status: CleanupStatus
  /** The viewer runs this event: the card would be asking them to donate to themselves. */
  actsAsHost: boolean
}

/**
 * The donation card for an event page. A DONE event KEEPS it - donating after the day is the point of
 * a receipt-shaped page - but a cancelled event and the host's own view lose it.
 */
export function eventDonationLinkFor(
  cleanup: DonationLinkSource,
  viewer: DonationViewer,
): DonationLink | null {
  if (viewer.status === "cancelled" || viewer.actsAsHost) return null
  return donationLinkFor(cleanup)
}

export function donationLinkFor(cleanup: DonationLinkSource): DonationLink | null {
  const orgName = cleanup.organization?.name.trim() ?? ""
  const organizerName = cleanup.organizer.name.trim()
  const eventOwner = orgName || organizerName || cleanup.title
  const candidates: ReadonlyArray<readonly [string | null | undefined, string]> = [
    [cleanup.donationUrl, eventOwner],
    [cleanup.organization?.donationUrl, orgName || eventOwner],
    [cleanup.organizer.donationUrl, organizerName || eventOwner],
  ]
  for (const [raw, ownerName] of candidates) {
    const url = safeDonationUrl(raw)
    if (url) return { url, ownerName }
  }
  return null
}
