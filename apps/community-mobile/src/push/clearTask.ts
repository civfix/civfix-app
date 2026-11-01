import { Platform } from "react-native"
import * as Notifications from "expo-notifications"
import * as TaskManager from "expo-task-manager"
import { decodePushMessageData } from "@civfix/contract"
import { errorName } from "@/lib/errorName"
import { decodeRemotePushData } from "@/push/clearDelivered"
import { clearNativeDelivered } from "@/push/register"

const CLEAR_DELIVERED_TASK = "civfix-clear-delivered-notifications"

// Defined and registered at module scope because expo-task-manager runs this bundle headless for a push
// that arrives while the app is in the background or not running, and no component mounts then.
TaskManager.defineTask<Notifications.NotificationTaskPayload>(
  CLEAR_DELIVERED_TASK,
  async ({ data, error }) => {
    if (error) {
      console.warn("[push] the notification task failed", errorName(error))
      return
    }
    // Android also runs the task for an action button pressed in the background.
    if ("actionIdentifier" in data) return
    const message = decodeRemotePushData(data.data, Platform.OS)
    if (message?.kind === "clear") await clearNativeDelivered(message)
  },
)

Notifications.registerTaskAsync(CLEAR_DELIVERED_TASK).catch((err: unknown) => {
  console.warn("[push] the notification task could not be registered", errorName(err))
})

// A clear that reaches the running app also arrives here; the task may run for it too, and dismissing a
// notification twice is harmless.
Notifications.addNotificationReceivedListener((notification) => {
  const message = decodePushMessageData(notification.request.content.data)
  if (message?.kind === "clear") void clearNativeDelivered(message)
})
