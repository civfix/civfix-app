import { Platform, Share } from "react-native"
import { classifyWebShareRejection, nativeShareResult, type ShareResult } from "./shareResult"
import { nativeShareContent } from "./shareContent"
import { webOrigin } from "./externalUrls"

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
  return webOrigin() + p
}

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
    const shared = await Share.share(
      nativeShareContent(Platform.OS, { title: opts.title, message: opts.message, url }),
    )
    return nativeShareResult(shared.action, Share.dismissedAction)
  } catch {
    return "unavailable"
  }
}
