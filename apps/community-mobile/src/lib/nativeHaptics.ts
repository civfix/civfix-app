import * as Haptics from "expo-haptics"
import type { HapticsCapability } from "@civfix/ui/capabilities"

// Haptics are optional feedback: a device without a haptic engine, or with haptics off, rejects, and
// that must never reach the action that asked for the tap.
function ignoreRejection(feedback: Promise<void>): void {
  feedback.catch(() => undefined)
}

export const nativeHaptics: HapticsCapability = {
  selection(): void {
    ignoreRejection(Haptics.selectionAsync())
  },
  impactLight(): void {
    ignoreRejection(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
  },
  success(): void {
    ignoreRejection(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
  },
  error(): void {
    ignoreRejection(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))
  },
}
