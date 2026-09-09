import { Platform, Share } from "react-native"
import { classifyWebShareRejection, type ShareResult } from "./shareResult"

export { WEB_ORIGIN } from "./externalUrls"
import { WEB_ORIGIN } from "./externalUrls"

export function absoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location &&
    window.location.origin
  ) {
    return window.location.origin + p
  }
  return WEB_ORIGIN + p
}

export { classifyWebShareRejection } from "./shareResult"
export type { ShareResult } from "./shareResult"

export interface ShareLinkOptions {
  title: string
  path: string
  message?: string
}

export async function shareLink(opts: ShareLinkOptions): Promise<ShareResult> {
  const url = absoluteUrl(opts.path)

  if (Platform.OS === "web") {
    const nav: Navigator | undefined = typeof navigator !== "undefined" ? navigator : undefined
    if (nav && typeof nav.share === "function") {
      try {
        await nav.share({ title: opts.title, url })
        return "shared"
      } catch (err) {
        if (classifyWebShareRejection(err) === "cancelled") return "cancelled"
      }
    }
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
      try {
        await nav.clipboard.writeText(url)
        return "copied"
      } catch {
        return "unavailable"
      }
    }
    return "unavailable"
  }

  try {
    await Share.share({ title: opts.title, message: opts.message ?? `${opts.title}\n${url}`, url })
    return "shared"
  } catch {
    return "unavailable"
  }
}
