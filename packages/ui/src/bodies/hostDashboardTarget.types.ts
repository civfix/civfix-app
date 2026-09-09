import type { OpenExternalCapability } from "../capabilities"

export interface HostDashboardTarget {
  eventId: string
  openExternal?: OpenExternalCapability | undefined
}
