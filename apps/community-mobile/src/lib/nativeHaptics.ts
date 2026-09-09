import * as Haptics from "expo-haptics"
import type { HapticsCapability } from "@civfix/ui/capabilities"

export const nativeHaptics: HapticsCapability = {
  selection(): void {
    void Haptics.selectionAsync().catch(() => {})
  },
  impactLight(): void {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  },
  success(): void {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
  },
  error(): void {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
  },
}
