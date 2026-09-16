import { SafeHttpsLinkSchema } from "@civfix/shared"

export function safeDonationUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const parsed = SafeHttpsLinkSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function donationUrlHost(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "")
}
