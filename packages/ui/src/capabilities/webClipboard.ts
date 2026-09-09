/**
 * Web default ClipboardCapability (P1 Task 1.4).
 *
 * There is no central "web defaults" bundle in @civfix/ui - each host app assembles its own
 * PlatformCapabilities object and passes it to <CapabilitiesProvider> at its root (the web app builds
 * its bundle in civfix-web; mobile in civfix-mobile). This const is the ready-made web impl for the
 * `clipboard` slot: the web host spreads it into its bundle (`clipboard: webClipboardCapability`);
 * the mobile host instead registers an expo-clipboard wrapper (Task 1.7). Safe to IMPORT anywhere
 * (no top-level platform access); calling `setString` off-web rejects.
 *
 * navigator.clipboard requires a secure context (https / localhost); outside one - or on a browser
 * without the async clipboard API - `setString` rejects and the caller keeps its copy affordance
 * degraded (same contract as an unregistered capability).
 */
import type { ClipboardCapability } from "./types"

export const webClipboardCapability: ClipboardCapability = {
  setString(text: string): Promise<void> {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text)
    }
    return Promise.reject(new Error("webClipboardCapability: clipboard API unavailable"))
  },
}
