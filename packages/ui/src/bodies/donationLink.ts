import type { CleanupDTO } from "@civfix/shared"
import { safeDonationUrl } from "../primitives/donationUrl"

export interface DonationLink {
  url: string
  ownerName: string
}

export type DonationLinkSource = Pick<CleanupDTO, "title" | "donationUrl" | "organization" | "organizer">

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
