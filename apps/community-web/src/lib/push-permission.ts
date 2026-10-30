import type { PushPermissionCapability, PushPermissionStatus } from "@civfix/ui/capabilities"

import { warnPush } from "@/push/log"
import { knownWebPushKey, webPushKey } from "@/push/web-push-key"

// Read through globalThis at call time: the static export evaluates this module where neither exists.
function browserNotification(): typeof Notification | null {
  const g = globalThis as { Notification?: typeof Notification; PushManager?: unknown }
  return g.Notification && g.PushManager ? g.Notification : null
}

function fromBrowser(permission: NotificationPermission): PushPermissionStatus {
  return permission === "default" ? "undetermined" : permission
}

/** A backend that cannot be asked for its key cannot be subscribed to either, so it reads as no key. */
function serverKey(): Promise<string | null> {
  return webPushKey().catch((err: unknown) => {
    warnPush("reading the web push config", err)
    return null
  })
}

const grantListeners = new Set<() => void>()

/** Called after a request() the browser granted, so the page subscribes without waiting for a reload. */
export function onPushPermissionGranted(listener: () => void): () => void {
  grantListeners.add(listener)
  return () => {
    grantListeners.delete(listener)
  }
}

async function ask(
  notification: typeof Notification,
  key: string | null,
): Promise<PushPermissionStatus> {
  if (key === null) return "unsupported"
  const status = fromBrowser(await notification.requestPermission())
  if (status === "granted") for (const listener of grantListeners) listener()
  return status
}

// request() shows the browser prompt, which browsers allow only from a click, so callers run it from a
// button handler.
export const webPushPermission: PushPermissionCapability = {
  async status(): Promise<PushPermissionStatus> {
    const notification = browserNotification()
    if (!notification) return "unsupported"
    return (await serverKey()) === null ? "unsupported" : fromBrowser(notification.permission)
  },
  request(): Promise<PushPermissionStatus> {
    const notification = browserNotification()
    if (!notification) return Promise.resolve("unsupported")
    // Safari honours requestPermission only within the click itself, so a key status() already read is
    // used without awaiting anything first.
    const key = knownWebPushKey()
    return key !== undefined
      ? ask(notification, key)
      : serverKey().then((read) => ask(notification, read))
  },
}
