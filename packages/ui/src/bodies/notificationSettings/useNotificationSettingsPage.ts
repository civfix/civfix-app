import { useCallback, useState } from "react"
import {
  NOTIFICATION_SECTIONS,
  type NotificationCategory,
  type NotificationCategorySetting,
  type NotificationSettingsDTO,
} from "@civfix/contract"
import { useNotificationSettings, useUpdateNotificationSettings } from "../../data"
import { usePushPermission, type PushPermissionStatus } from "../../capabilities"
import { useToast } from "../../primitives"
import { useT } from "../../i18n"

/**
 * What the push-off banner shows. `ask` can still raise the system or browser prompt; `blocked` can only
 * send the person to settings (the phone opens them, web explains where they are); `unsupported` has no
 * button at all.
 */
export type PushBanner = "none" | "ask" | "blocked" | "unsupported"

function pushBannerFor(status: PushPermissionStatus | null): PushBanner {
  switch (status) {
    case null:
    case "granted":
      return "none"
    case "undetermined":
      return "ask"
    case "denied":
      return "blocked"
    case "unsupported":
      return "unsupported"
  }
}

export interface NotificationSettingsPage {
  query: ReturnType<typeof useNotificationSettings>
  settings: NotificationSettingsDTO | undefined
  sections: typeof NOTIFICATION_SECTIONS
  pushBanner: PushBanner
  /** True once Turn on was pressed where the browser can no longer ask. */
  showSiteSettingsHelp: boolean
  pushDisabled: boolean
  emailDisabled: boolean
  turnOnPush: () => void
  change: (category: NotificationCategory, change: Partial<NotificationCategorySetting>) => void
}

export function useNotificationSettingsPage(): NotificationSettingsPage {
  const { t } = useT("notifications-prefs")
  const toast = useToast()
  const query = useNotificationSettings()
  const update = useUpdateNotificationSettings()
  const push = usePushPermission()
  const [showSiteSettingsHelp, setShowSiteSettingsHelp] = useState(false)

  const pushBanner = pushBannerFor(push.status)

  const turnOnPush = useCallback(() => {
    if (pushBanner === "ask") {
      void push.request()
      return
    }
    if (pushBanner !== "blocked") return
    if (push.openSettings) void push.openSettings()
    else setShowSiteSettingsHelp(true)
  }, [pushBanner, push])

  // mutate()'s per-call onError fires only for the latest call, so an earlier press that failed while a
  // later one was in flight would roll back silently; each call's own promise always settles.
  const save = update.mutateAsync
  const change = useCallback(
    (category: NotificationCategory, next: Partial<NotificationCategorySetting>) => {
      save({ category, change: next }).catch(() =>
        toast.show(t("save_error"), { variant: "error" }),
      )
    },
    [save, toast, t],
  )

  return {
    query,
    settings: query.data,
    sections: NOTIFICATION_SECTIONS,
    pushBanner,
    showSiteSettingsHelp,
    // Disabled until the device has said granted, so a box never takes a press it is about to refuse.
    pushDisabled: push.status !== "granted",
    emailDisabled: query.data?.emailAvailable === false,
    turnOnPush,
    change,
  }
}
