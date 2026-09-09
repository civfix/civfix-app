import type { DetailEntry } from "../nav"
import type { IconName } from "../typography"

export interface DetailTrailingAction {
  icon: IconName
  a11yKey: string
  push: DetailEntry
}

export function detailTrailingActionFor(active: DetailEntry | null): DetailTrailingAction | null {
  if (active === null) return null
  switch (active.kind) {
    case "profile":
      return { icon: "Settings", a11yKey: "a11y.settings", push: { kind: "settings" } }
    default:
      return null
  }
}
