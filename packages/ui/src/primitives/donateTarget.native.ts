import type { DonateTarget } from "./donateTarget.types"

export function openDonate(target: DonateTarget): void {
  const openExternal = target.openExternal
  if (!openExternal) return
  const inApp = openExternal.openInAppBrowser
  void (inApp ? inApp.call(openExternal, target.url) : openExternal.open(target.url))
}
