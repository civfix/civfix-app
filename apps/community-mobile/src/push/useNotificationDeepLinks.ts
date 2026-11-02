import { useEffect, useRef } from "react"
import * as Notifications from "expo-notifications"
import { api } from "@/api/client"
import { usePrefsStore } from "@/store/prefsStore"
import { useAuthStore } from "@/store/authStore"
import { errorName } from "@/lib/errorName"
import { toInternalHref } from "@/lib/links"
import { applyInternalHref } from "@/components/MobileNavAdapter"
import {
  openNotificationResponse,
  type NotificationResponseDeps,
} from "@/push/notificationResponse"
import { ensureNotificationCategories, syncNativeAndroidChannels } from "@/push/register"

export function useNotificationDeepLinks(dismissToShell: () => void) {
  const handledResponseIdsRef = useRef(new Set<string>())
  const locale = usePrefsStore((state) => state.locale)

  useEffect(() => {
    void ensureNotificationCategories()
    void syncNativeAndroidChannels()
  }, [locale])

  useEffect(() => {
    const deps: NotificationResponseDeps = {
      authStatus: () => useAuthStore.getState().status,
      onAuthStatus: (listener) => useAuthStore.subscribe((state) => listener(state.status)),
      markRead: (ids) => api.markNotificationsRead({ ids }),
      open: (link) => {
        const href = toInternalHref(link)
        if (!href) return
        setTimeout(() => {
          const applied = applyInternalHref(href as string)
          if (applied?.dismissToShell) dismissToShell()
        }, 0)
      },
      handled: handledResponseIdsRef.current,
    }
    const handle = (response: Notifications.NotificationResponse | null | undefined) => {
      if (response) void openNotificationResponse(response, deps)
    }

    const sub = Notifications.addNotificationResponseReceivedListener(handle)

    try {
      handle(Notifications.getLastNotificationResponse())
      Notifications.clearLastNotificationResponse()
    } catch (err) {
      console.warn(
        "[push] the notification that launched the app could not be read",
        errorName(err),
      )
    }

    return () => sub.remove()
  }, [dismissToShell])
}
