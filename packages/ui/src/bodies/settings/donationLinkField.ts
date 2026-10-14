import { HttpsUrlSchema } from "@civfix/shared"
import { safeDonationUrl } from "../../primitives/donationUrl"

export type DonationLinkFieldError = "invalid" | null

export function normalizeDonationLink(raw: string): string | null {
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function donationLinkFieldError(raw: string): DonationLinkFieldError {
  const value = normalizeDonationLink(raw)
  if (value === null) return null
  if (!HttpsUrlSchema.safeParse(value).success) return "invalid"
  return safeDonationUrl(value) === null ? "invalid" : null
}

export function donationLinkDirty(raw: string, saved: string | null | undefined): boolean {
  return normalizeDonationLink(raw) !== (saved ?? null)
}
