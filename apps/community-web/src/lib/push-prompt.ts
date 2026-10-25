import { safeGet, safeSet } from "./browser-storage"

// Per browser, not per account: the browser's own permission is per browser too.
const ASKED_KEY = "civfix.pushPromptSeen"

export function pushPromptSeen(): boolean {
  return safeGet("local", ASKED_KEY) === "1"
}

/** Not now, a denial and closing the card all end here: the card never shows again in this browser. */
export function markPushPromptSeen(): void {
  safeSet("local", ASKED_KEY, "1")
}
