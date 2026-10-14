import { useEffect, useRef } from "react"
import * as Notifications from "expo-notifications"
import { usePrefsStore } from "@/store/prefsStore"
import { errorName } from "@/lib/errorName"
import { applyInternalHref } from "@/components/MobileNavAdapter"
import { ensureNotificationCategories, linkFromNotificationResponse } from "@/push/register"

export function useNotificationDeepLinks(dismissToShell: () => void) {
  const handledResponseIdRef = useRef<string | null>(null)
  const locale = usePrefsStore((state) => state.locale)

  useEffect(() => {
    void ensureNotificationCategories()
  }, [locale])

  useEffect(() => {
    const handle = (response: Notifications.NotificationResponse | null | undefined) => {
      const id = response?.notification?.request?.identifier
      if (!id || handledResponseIdRef.current === id) return
      const href = linkFromNotificationResponse(response)
      if (!href) return
      handledResponseIdRef.current = id
      setTimeout(() => {
        const applied = applyInternalHref(href as string)
        if (applied?.dismissToShell) dismissToShell()
      }, 0)
    }

    const sub = Notifications.addNotificationResponseReceivedListener(handle)

    try {
      handle(Notifications.getLastNotificationResponse())
      Notifications.clearLastNotificationResponse()
    } catch (err) {
      console.warn("[push] the notification that launched the app could not be read", errorName(err))
    }

    return () => sub.remove()
  }, [dismissToShell])
}
