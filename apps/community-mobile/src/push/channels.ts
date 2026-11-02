import { NOTIFICATION_SECTIONS } from "@civfix/contract"
import type { AndroidImportance, NotificationChannelInput } from "expo-notifications"

// `default` carries pushes without a category (D7); the section ids are the backend's channel ids.
const CHANNEL_IDS = ["default", ...NOTIFICATION_SECTIONS.map((section) => section.id)]

const RETIRED_CHANNEL_IDS = ["host_broadcasts", "event_reminders"]

// The injected calls keep this file free of native imports, so node --test can run it; src/push/register.ts
// passes the real expo-notifications calls.
export interface AndroidChannelDeps {
  t(key: string): string
  defaultImportance: AndroidImportance
  lightColor: string
  setChannel(id: string, channel: NotificationChannelInput): Promise<unknown>
  deleteChannel(id: string): Promise<unknown>
}

// Every channel is DEFAULT importance: the epic asks for notifications that are calm by default, and a
// user can raise one in the system settings.
export async function syncAndroidChannels(deps: AndroidChannelDeps): Promise<void> {
  for (const id of CHANNEL_IDS) {
    try {
      await deps.setChannel(id, {
        name: deps.t(`notification_channel_${id}`),
        importance: deps.defaultImportance,
        lightColor: deps.lightColor,
      })
    } catch (err) {
      console.warn(`[push] notification channel ${id} could not be created`, err)
    }
  }
  for (const id of RETIRED_CHANNEL_IDS) {
    try {
      await deps.deleteChannel(id)
    } catch (err) {
      console.warn(`[push] retired notification channel ${id} could not be deleted`, err)
    }
  }
}
