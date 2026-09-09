import { AccessibilityInfo } from "react-native"

import type { AnnounceFn } from "./announce.types"

export const announce: AnnounceFn = (message) => {
  if (!message) return
  try {
    AccessibilityInfo.announceForAccessibility(message)
  } catch {
    /* screen reader unavailable */
  }
}
