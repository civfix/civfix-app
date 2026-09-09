import { donateUrl } from "./externalUrls"
import type { DonateTarget } from "./donateTarget.types"

export function openDonate(target: DonateTarget): void {
  const url = donateUrl(target.orgSlug, target.eventId ?? null)
  const openExternal = target.openExternal
  if (!openExternal) return
  const inApp = openExternal.openInAppBrowser
  void (inApp ? inApp.call(openExternal, url) : openExternal.open(url))
}
