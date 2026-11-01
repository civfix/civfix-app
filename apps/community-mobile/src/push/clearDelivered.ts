import {
  decodePushMessageData,
  type NotificationCategory,
  type NotificationDTO,
  type PushMessageData,
} from "@civfix/contract"
import type { NotificationBehavior } from "expo-notifications"

export type ClearMessage = Extract<PushMessageData, { kind: "clear" }>

/** The slice of an expo-notifications `Notification` this file reads. */
export interface DeliveredNotification {
  request: { identifier: string; content: { data?: unknown } }
}

// The injected calls keep this file free of native imports, so node --test can run it; src/push/register.ts
// passes the real expo-notifications calls and the first page of listNotifications.
export interface DeliveredDeps {
  presented(): Promise<readonly DeliveredNotification[]>
  dismiss(identifier: string): Promise<unknown>
  listFirstPage(): Promise<readonly Pick<NotificationDTO, "id" | "read">[]>
}

// D8: a chat push is removed only by a clear naming it (its conversation was read), never on `all` or in
// reconcile.
const CHAT_CATEGORIES: ReadonlySet<NotificationCategory> = new Set<NotificationCategory>([
  "directMessages",
  "groupChats",
  "reportDiscussions",
])

// Android's FCM SDK displays a push itself while the app is not in the foreground; expo-notifications then
// reports it with this identifier and no data, so its tag (the notification id, D7) is all there is.
const FOREIGN_PREFIX = "expo-notifications://foreign_notifications?"

type Delivered =
  | { kind: "push"; identifier: string; id: string; pageCategory: boolean }
  | { kind: "foreign"; identifier: string; id: string }

function foreignTag(identifier: string): string | null {
  if (!identifier.startsWith(FOREIGN_PREFIX)) return null
  for (const pair of identifier.slice(FOREIGN_PREFIX.length).split("&")) {
    const [key, value] = pair.split("=")
    if (key === "tag" && value) {
      try {
        return decodeURIComponent(value)
      } catch {
        return null
      }
    }
  }
  return null
}

function classify(notification: DeliveredNotification): Delivered | null {
  const { identifier, content } = notification.request
  const data = decodePushMessageData(content.data)
  if (data?.kind === "notification") {
    const pageCategory = data.category === null || !CHAT_CATEGORIES.has(data.category)
    return { kind: "push", identifier, id: data.notificationId, pageCategory }
  }
  const tag = foreignTag(identifier)
  return tag === null ? null : { kind: "foreign", identifier, id: tag }
}

async function deliveredNotifications(deps: DeliveredDeps): Promise<Delivered[]> {
  try {
    return (await deps.presented()).flatMap((notification) => classify(notification) ?? [])
  } catch (err) {
    console.warn("[push] delivered notifications could not be read", err)
    return []
  }
}

async function dismissAll(deps: DeliveredDeps, delivered: readonly Delivered[]): Promise<void> {
  for (const notification of delivered) {
    try {
      await deps.dismiss(notification.identifier)
    } catch (err) {
      console.warn("[push] a delivered notification could not be dismissed", err)
    }
  }
}

async function firstPage(deps: DeliveredDeps): Promise<ReadonlyMap<string, boolean> | null> {
  try {
    return new Map((await deps.listFirstPage()).map((item) => [item.id, item.read]))
  } catch (err) {
    console.warn("[push] the notifications list could not be read to clear delivered ones", err)
    return null
  }
}

// The first page never holds chat types, so a system-displayed notification listed there is a
// notifications-page one; one not listed may be a chat push and stays.
function readForeign(delivered: readonly Delivered[], page: ReadonlyMap<string, boolean>) {
  return delivered.filter((n) => n.kind === "foreign" && page.get(n.id) === true)
}

/**
 * Removes the delivered notifications a clear push names: by id (chat ones included), or on `all` every
 * notifications-page one.
 */
export async function clearDelivered(message: ClearMessage, deps: DeliveredDeps): Promise<void> {
  const delivered = await deliveredNotifications(deps)
  if (message.ids) {
    const ids = new Set(message.ids)
    await dismissAll(
      deps,
      delivered.filter((n) => ids.has(n.id)),
    )
    return
  }
  await dismissAll(
    deps,
    delivered.filter((n) => n.kind === "push" && n.pageCategory),
  )
  const foreign = delivered.filter((n) => n.kind === "foreign")
  if (foreign.length === 0) return
  const page = await firstPage(deps)
  if (page) await dismissAll(deps, readForeign(foreign, page))
}

/**
 * Apple throttles silent pushes and never wakes a force-quit app, so every launch and return to the
 * foreground removes delivered notifications-page notifications that are read or gone from the first page.
 */
export async function reconcileDelivered(deps: DeliveredDeps): Promise<void> {
  const candidates = (await deliveredNotifications(deps)).filter(
    (n) => n.kind === "foreign" || n.pageCategory,
  )
  if (candidates.length === 0) return
  const page = await firstPage(deps)
  if (!page) return
  await dismissAll(deps, [
    ...candidates.filter((n) => n.kind === "push" && page.get(n.id) !== false),
    ...readForeign(candidates, page),
  ])
}

/** On iOS the push data sits under the payload's `body`; on Android it is the payload itself. */
export function decodeRemotePushData(payload: unknown, os: string): PushMessageData | null {
  if (typeof payload !== "object" || payload === null) return null
  return decodePushMessageData(os === "ios" ? (payload as { body?: unknown }).body : payload)
}

// No app icon badge anywhere (D8), and a clear exists only to remove others, so it is never shown.
export function notificationPresentation(data: unknown): NotificationBehavior {
  const shown = decodePushMessageData(data)?.kind !== "clear"
  return {
    shouldShowBanner: shown,
    shouldShowList: shown,
    shouldPlaySound: shown,
    shouldSetBadge: false,
  }
}
