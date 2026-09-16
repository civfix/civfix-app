import type { OpenExternalCapability } from "../capabilities"

export interface DonateTarget {
  url: string
  openExternal?: OpenExternalCapability | undefined
}
