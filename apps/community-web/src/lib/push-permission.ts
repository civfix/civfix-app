import type { PushPermissionCapability, PushPermissionStatus } from "@civfix/ui/capabilities"

// Read through globalThis at call time: the static export evaluates this module where neither exists.
function browserNotification(): typeof Notification | null {
  const g = globalThis as { Notification?: typeof Notification; PushManager?: unknown }
  return g.Notification && g.PushManager ? g.Notification : null
}

function fromBrowser(permission: NotificationPermission): PushPermissionStatus {
  return permission === "default" ? "undetermined" : permission
}

// request() shows the browser prompt, which browsers allow only from a click, so callers run it from a
// button handler.
export const webPushPermission: PushPermissionCapability = {
  async status(): Promise<PushPermissionStatus> {
    const notification = browserNotification()
    return notification ? fromBrowser(notification.permission) : "unsupported"
  },
  async request(): Promise<PushPermissionStatus> {
    const notification = browserNotification()
    return notification ? fromBrowser(await notification.requestPermission()) : "unsupported"
  },
}
