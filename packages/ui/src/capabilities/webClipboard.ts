// navigator.clipboard needs a secure context (https or localhost); outside one, or without the async
// clipboard API, `setString` rejects and the caller degrades its copy affordance as it would for an
// unregistered capability.
import type { ClipboardCapability } from "./types"

export const webClipboardCapability: ClipboardCapability = {
  setString(text: string): Promise<void> {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text)
    }
    return Promise.reject(new Error("webClipboardCapability: clipboard API unavailable"))
  },
}
