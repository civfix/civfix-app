import { managePath } from "../primitives/externalUrls"
import type { HostDashboardTarget } from "./hostDashboardTarget.types"

export function openHostDashboard(target: HostDashboardTarget): void {
  const path = managePath(target.eventId)
  if (typeof window !== "undefined" && window.location) {
    window.location.assign(path)
    return
  }
  void target.openExternal?.open(path)
}
