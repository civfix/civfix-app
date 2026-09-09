import { Platform, LogBox } from "react-native"
import * as Notifications from "expo-notifications"
import Constants from "expo-constants"
import * as SecureStore from "expo-secure-store"
import * as Crypto from "expo-crypto"
import type { Href } from "expo-router"
import { tokens } from "@civfix/shared/tokens"
import { createI18n } from "@civfix/ui/i18n"
import { api } from "@/api/client"
import { toInternalHref } from "@/lib/links"
import { resolveActiveLocale } from "@/lib/locale"
import { resolveDeviceId, type DeviceIdStore } from "@/lib/deviceId"
import { storage } from "@/lib/mmkv"
import { rememberPushRegistration } from "@/lib/pushRegistration"

function systemT(): (key: string) => string {
  return createI18n(resolveActiveLocale(null)).getFixedT(null, "mobile-system")
}

LogBox.ignoreLogs([
  "Error reading persisted server registration info",
  "getRegistrationInfoAsync",
])

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export type PushRegistrationResult =
  | { status: "registered"; token: string }
  | { status: "denied" }
  | { status: "unsupported"; reason: string }
  | { status: "error"; reason: string }

function pushPlatform(): "ios" | "android" | "web" | null {
  if (Platform.OS === "ios") return "ios"
  if (Platform.OS === "android") return "android"
  if (Platform.OS === "web") return "web"
  return null
}

const PLACEHOLDER_PROJECT_ID = "00000000-0000-0000-0000-000000000000"

function isRealProjectId(id: string | undefined): id is string {
  return typeof id === "string" && id.length > 0 && id !== PLACEHOLDER_PROJECT_ID
}

function easProjectId(): string | undefined {
  const fromExtra = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
    ?.eas?.projectId
  const fromEas = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig
    ?.projectId
  if (isRealProjectId(fromEas)) return fromEas
  if (isRealProjectId(fromExtra)) return fromExtra
  return undefined
}

export async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return
  const t = systemT()
  const lightColor = tokens.color.brand.bloom
  const channels: [string, Notifications.NotificationChannelInput][] = [
    [
      "default",
      {
        name: t("notification_channel_default"),
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor,
      },
    ],
    [
      "host_broadcasts",
      {
        name: t("notification_channel_host_broadcasts"),
        importance: Notifications.AndroidImportance.HIGH,
        lightColor,
      },
    ],
    [
      "event_reminders",
      {
        name: t("notification_channel_event_reminders"),
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor,
      },
    ],
  ]
  for (const [id, config] of channels) {
    try {
      await Notifications.setNotificationChannelAsync(id, config)
    } catch (err) {
      console.warn(`[push] notification channel ${id} could not be created`, err)
    }
  }
}

export const NOTIFICATION_CATEGORY_TICKET = "ticket"
export const NOTIFICATION_CATEGORY_HOST_BROADCAST = "host_broadcast"

export async function ensureNotificationCategories(): Promise<void> {
  if (Platform.OS === "web") return
  const t = systemT()
  try {
    await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_TICKET, [
      {
        identifier: "open",
        buttonTitle: t("notification_action_view_ticket"),
        options: { opensAppToForeground: true },
      },
    ])
    await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_HOST_BROADCAST, [
      {
        identifier: "open",
        buttonTitle: t("notification_action_open_event"),
        options: { opensAppToForeground: true },
      },
    ])
  } catch (err) {
    console.warn("[push] notification categories could not be registered", err)
  }
}

const secureStore: DeviceIdStore = {
  read: (key) => SecureStore.getItemAsync(key),
  write: (key, value) => SecureStore.setItemAsync(key, value),
}

async function getDeviceId(): Promise<string | null> {
  return resolveDeviceId(secureStore, () => Crypto.randomUUID())
}

export async function registerForPushNotifications(
  deviceId?: string,
): Promise<PushRegistrationResult> {
  const platform = pushPlatform()
  if (!platform) return { status: "unsupported", reason: "unknown platform" }

  try {
    await ensureAndroidChannels()

    const existing = await Notifications.getPermissionsAsync()
    let granted = existing.granted
    if (!granted && existing.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync()
      granted = requested.granted
    }
    if (!granted) return { status: "denied" }

    const projectId = easProjectId()
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )
    const token = tokenResponse.data
    if (!token) return { status: "error", reason: "empty push token" }

    const resolvedDeviceId = deviceId ?? (await getDeviceId()) ?? undefined

    await api.registerPush({
      platform,
      token,
      ...(resolvedDeviceId ? { deviceId: resolvedDeviceId } : {}),
    })

    rememberPushRegistration(storage, { platform, token })

    return { status: "registered", token }
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error"
    return { status: "error", reason }
  }
}

export function linkFromNotificationResponse(
  response: Notifications.NotificationResponse | null | undefined,
): Href | null {
  const data = response?.notification?.request?.content?.data
  if (!data || typeof data !== "object") return null
  return toInternalHref((data as { link?: unknown }).link)
}
