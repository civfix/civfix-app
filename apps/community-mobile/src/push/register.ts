import { Platform, LogBox } from "react-native"
import * as Notifications from "expo-notifications"
import * as Linking from "expo-linking"
import * as SecureStore from "expo-secure-store"
import * as Crypto from "expo-crypto"
import { tokens } from "@civfix/tokens"
import type { PushPermissionStatus } from "@civfix/ui/capabilities"
import { INBOX_LIMIT } from "@civfix/ui/data"
import { createI18n } from "@civfix/ui/i18n"
import { api } from "@/api/client"
import { APP_ID } from "@/config"
import { resolveActiveLocale } from "@/lib/locale"
import { resolveDeviceId, type DeviceIdStore } from "@/lib/deviceId"
import { storage } from "@/lib/mmkv"
import { makeNativePushPermission } from "@/lib/pushPermission"
import { makeSerialPushSync, promptForPushAtSignIn, syncPushToken } from "@/lib/pushTokenSync"
import { syncAndroidChannels } from "@/push/channels"
import {
  clearDelivered,
  notificationPresentation,
  reconcileDelivered,
  type ClearMessage,
  type DeliveredDeps,
} from "@/push/clearDelivered"
import { useAuthStore } from "@/store/authStore"

function systemT(): (key: string) => string {
  return createI18n(resolveActiveLocale(null)).getFixedT(null, "mobile-system")
}

LogBox.ignoreLogs(["Error reading persisted server registration info", "getRegistrationInfoAsync"])

Notifications.setNotificationHandler({
  handleNotification: async (notification) =>
    notificationPresentation(notification.request.content.data),
})

export async function syncNativeAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return
  await syncAndroidChannels({
    t: systemT(),
    defaultImportance: Notifications.AndroidImportance.DEFAULT,
    lightColor: tokens.color.brand.bloom,
    setChannel: (id, channel) => Notifications.setNotificationChannelAsync(id, channel),
    deleteChannel: (id) => Notifications.deleteNotificationChannelAsync(id),
  })
}

const NOTIFICATION_CATEGORY_TICKET = "ticket"
const NOTIFICATION_CATEGORY_HOST_BROADCAST = "host_broadcast"

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

const serialPushSync = makeSerialPushSync(async (rotated) => {
  if (useAuthStore.getState().status !== "authed") return
  const result = await syncPushToken(
    {
      permission: nativePushPermission,
      getDevicePushToken: () => Notifications.getDevicePushTokenAsync(),
      deviceId: () => resolveDeviceId(secureStore, () => Crypto.randomUUID()),
      registerPush: (body) => api.registerPush(body),
      store: storage,
    },
    rotated,
  )
  // registerPush allows 10 a minute per account, so a failure waits for the next launch, return to the
  // app, grant or rotation instead of retrying.
  if (result.status === "conflict" || result.status === "error") {
    console.warn(`[push] registration not completed: ${result.status}`, result.reason)
  }
})

/** Registers this device's token while signed in with push allowed; `rotated` is a token FCM or APNs reissued. */
export function syncNativePushToken(rotated?: Notifications.DevicePushToken): Promise<void> {
  return serialPushSync(rotated)
}

export const nativePushPermission = makeNativePushPermission({
  appId: APP_ID,
  getPermissionsAsync: Notifications.getPermissionsAsync,
  requestPermissionsAsync: () => Notifications.requestPermissionsAsync(),
  openSettings: Linking.openSettings,
  onGranted: () => {
    void syncNativePushToken()
  },
})

export function promptForNativePush(): Promise<PushPermissionStatus> {
  return promptForPushAtSignIn({ permission: nativePushPermission, store: storage })
}

// In a background task `api` reads the stored session itself; when that fails, the next foreground
// reconcile removes what this pass could not.
const nativeDelivered: DeliveredDeps = {
  presented: () => Notifications.getPresentedNotificationsAsync(),
  dismiss: (identifier) => Notifications.dismissNotificationAsync(identifier),
  listFirstPage: async () => (await api.listNotifications({ limit: INBOX_LIMIT })).items,
}

export function clearNativeDelivered(message: ClearMessage): Promise<void> {
  return clearDelivered(message, nativeDelivered)
}

export function reconcileNativeDelivered(): Promise<void> {
  return reconcileDelivered(nativeDelivered)
}
