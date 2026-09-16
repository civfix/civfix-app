import { SOCIAL_PLATFORMS, type SocialLinks, type SocialPlatform } from "@civfix/shared"

export interface SocialLinkEntry {
  platform: SocialPlatform
  value: string
}

export function presentSocialPlatforms(links: SocialLinks | null | undefined): SocialLinkEntry[] {
  if (!links) return []
  return SOCIAL_PLATFORMS.flatMap((platform) => {
    const value = links[platform]
    if (typeof value !== "string") return []
    const trimmed = value.trim()
    return trimmed.length > 0 ? [{ platform, value: trimmed }] : []
  })
}
