import type { OpenExternalCapability } from "../capabilities"

export interface DonateTarget {
  orgSlug: string
  eventId?: string | null
  openExternal?: OpenExternalCapability | undefined
}
