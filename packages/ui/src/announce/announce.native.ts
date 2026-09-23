import { AccessibilityInfo } from "react-native"

import type { AnnounceFn } from "./announce.types"

// iOS speaks a queued announcement after the current one; `queue: false` interrupts, which is what an
// assertive message needs. Android ignores the option.
export const announce: AnnounceFn = (message, opts) => {
  if (!message) return
  AccessibilityInfo.announceForAccessibilityWithOptions(message, {
    queue: (opts?.priority ?? "polite") === "polite",
  })
}
