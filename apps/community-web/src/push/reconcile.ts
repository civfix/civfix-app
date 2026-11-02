import type { NotificationCategory } from "@civfix/contract"
import { INBOX_LIMIT } from "@civfix/ui/data"

import { api } from "@/lib/api"

// D8: a chat push is removed only when its conversation is read, never by this pass.
const CHAT_CATEGORIES: ReadonlySet<NotificationCategory> = new Set<NotificationCategory>([
  "directMessages",
  "groupChats",
  "reportDiscussions",
])

interface DeliveredData {
  notificationId?: unknown
  category?: unknown
}

/**
 * Browsers get no silent pushes to clear notifications read elsewhere, so a focused tab closes this
 * browser's delivered notifications-page ones whose ids are read or gone from the first page.
 */
export async function closeReadNotifications(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  const delivered = (await registration.getNotifications()).filter((notification) => {
    const { category } = (notification.data ?? {}) as DeliveredData
    return !CHAT_CATEGORIES.has(category as NotificationCategory)
  })
  if (delivered.length === 0) return
  const { items } = await api.listNotifications({ limit: INBOX_LIMIT })
  const unread = new Set(items.filter((item) => !item.read).map((item) => item.id))
  for (const notification of delivered) {
    const { notificationId } = (notification.data ?? {}) as DeliveredData
    const id = typeof notificationId === "string" ? notificationId : notification.tag
    if (!unread.has(id)) notification.close()
  }
}
