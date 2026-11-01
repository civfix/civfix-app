import type { AndroidImportance, NotificationChannelInput } from "expo-notifications"

export interface AndroidChannelDeps {
  t(key: string): string
  defaultImportance: AndroidImportance
  lightColor: string
  setChannel(id: string, channel: NotificationChannelInput): Promise<unknown>
  deleteChannel(id: string): Promise<unknown>
}

export function syncAndroidChannels(_deps: AndroidChannelDeps): Promise<void> {
  throw new Error("not implemented")
}
