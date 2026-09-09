/**
 * Native CLIPBOARD capability impl - the platform-seam realization of `@civfix/ui/capabilities`
 * ClipboardCapability for the mobile app (mirrors src/lib/nativePush.ts). It wraps expo-clipboard so
 * shared bodies (chat P1: the message context-menu "Copy message") can write plain text to the system
 * clipboard without a native import crossing into the shared source. The web host registers the
 * navigator.clipboard-backed `webClipboardCapability` instead.
 */
import * as Clipboard from "expo-clipboard"
import type { ClipboardCapability } from "@civfix/ui/capabilities"

/** The native ClipboardCapability singleton (built once for the app lifetime). */
export const nativeClipboard: ClipboardCapability = {
  async setString(text: string): Promise<void> {
    // setStringAsync resolves a boolean; the capability contract is Promise<void>, so discard it.
    await Clipboard.setStringAsync(text)
  },
}
