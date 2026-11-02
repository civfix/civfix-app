import { ErrorCode, isAppErrorLike } from "@civfix/contract"

import { api } from "@/lib/api"
import { webPushPermission } from "@/lib/push-permission"
import { warnPush } from "@/push/log"
import { webPushKey } from "@/push/web-push-key"

/** How long a sign-out waits for pushUnregister before it signs out anyway. */
const PUSH_UNREGISTER_TIMEOUT_MS = 3_000

export function serviceWorkerContainer(): ServiceWorkerContainer | null {
  return typeof navigator !== "undefined" && navigator.serviceWorker
    ? navigator.serviceWorker
    : null
}

async function currentSubscription(
  container: ServiceWorkerContainer,
): Promise<PushSubscription | null> {
  const registration = await container.getRegistration("/")
  return registration ? registration.pushManager.getSubscription() : null
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

function sameBytes(buffer: ArrayBuffer | null, bytes: Uint8Array): boolean {
  if (buffer === null || buffer.byteLength !== bytes.length) return false
  const view = new Uint8Array(buffer)
  return view.every((byte, i) => byte === bytes[i])
}

async function subscribe(
  registration: ServiceWorkerRegistration,
  key: string,
): Promise<PushSubscription> {
  const applicationServerKey = decodeBase64Url(key)
  const existing = await registration.pushManager.getSubscription()
  // A browser refuses a second key for the same site, so a subscription to an old key goes first.
  if (existing && !sameBytes(existing.options.applicationServerKey, applicationServerKey)) {
    await existing.unsubscribe()
  }
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
}

const registerSubscription = (subscription: PushSubscription) =>
  api.registerPush({ platform: "web", token: JSON.stringify(subscription) })

/**
 * Subscribes this browser and registers it for the signed-in account, when push is allowed and the
 * backend has a key. `stillWanted` stops it between steps once the session it ran for has ended.
 */
export async function syncSubscription(
  registration: ServiceWorkerRegistration,
  stillWanted: () => boolean,
): Promise<void> {
  if ((await webPushPermission.status()) !== "granted") return
  const key = await webPushKey()
  if (key === null || !stillWanted()) return
  const subscription = await subscribe(registration, key)
  if (!stillWanted()) return
  try {
    await registerSubscription(subscription)
  } catch (err) {
    if (!isAppErrorLike(err) || err.code !== ErrorCode.CONFLICT) throw err
    // Another account still holds this subscription (its sign-out never reached the server), so this
    // browser starts over with a fresh one. A second CONFLICT is not retried.
    await subscription.unsubscribe()
    if (!stillWanted()) return
    await registerSubscription(await subscribe(registration, key))
  }
}

/** Removes this browser's subscription, so the next person here gets no push meant for the last. */
export async function unsubscribeBrowser(container: ServiceWorkerContainer): Promise<void> {
  const subscription = await currentSubscription(container)
  if (subscription) await subscription.unsubscribe()
}

/**
 * Asks the server to stop sending to this browser's subscription, for at most
 * PUSH_UNREGISTER_TIMEOUT_MS, and resolves with the subscription so the caller can drop it once signed
 * out. Never rejects: a sign-out goes ahead whatever happens here.
 */
export async function unregisterSubscription(
  container: ServiceWorkerContainer,
): Promise<PushSubscription | null> {
  let subscription: PushSubscription | null
  try {
    subscription = await currentSubscription(container)
  } catch (err) {
    warnPush("reading the subscription", err)
    return null
  }
  if (!subscription) return null

  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve()
    }, PUSH_UNREGISTER_TIMEOUT_MS)
  })
  const request = api
    .pushUnregister(
      { platform: "web", token: JSON.stringify(subscription) },
      { signal: controller.signal },
    )
    .then(
      () => undefined,
      (err: unknown) => warnPush("unregistering the subscription", err),
    )
  await Promise.race([request, deadline])
  clearTimeout(timer)
  return subscription
}
