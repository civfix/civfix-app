import { donatePath } from "./externalUrls"
import type { DonateTarget } from "./donateTarget.types"

export function openDonate(target: DonateTarget): void {
  const path = donatePath(target.orgSlug, target.eventId ?? null)
  if (typeof window !== "undefined" && window.location) {
    window.location.assign(path)
    return
  }
  void target.openExternal?.open(path)
}
