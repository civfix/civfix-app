import * as Clipboard from "expo-clipboard"
import type { ClipboardCapability } from "@civfix/ui/capabilities"

export const nativeClipboard: ClipboardCapability = {
  async setString(text: string): Promise<void> {
    await Clipboard.setStringAsync(text)
  },
}
