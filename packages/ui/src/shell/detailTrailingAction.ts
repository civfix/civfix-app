import type { DetailEntry } from "../nav"
import type { IconName } from "../typography"

export interface DetailTrailingAction {
  icon: IconName
  a11yKey: string
  push: DetailEntry
  /** Shows the unread dot while the server says a notification is unread. */
  unreadDot?: boolean
}

const NO_ACTIONS: readonly DetailTrailingAction[] = []

const PROFILE_ACTIONS: readonly DetailTrailingAction[] = [
  { icon: "Bell", a11yKey: "a11y.notifications", push: { kind: "activity" }, unreadDot: true },
  { icon: "Settings", a11yKey: "a11y.settings", push: { kind: "settings" } },
]

export function detailTrailingActionFor(active: DetailEntry | null): readonly DetailTrailingAction[] {
  if (active === null) return NO_ACTIONS
  switch (active.kind) {
    case "profile":
      return PROFILE_ACTIONS
    default:
      return NO_ACTIONS
  }
}
