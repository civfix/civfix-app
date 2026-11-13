import { useCallback, useEffect, useRef, useState } from "react"
import type { NotificationDTO } from "@civfix/contract"

/** How long a row keeps its "new" look after it is first shown; then it clears at once. */
export const UNREAD_LOOK_MS = 3000

/**
 * Viewing marks everything read, yet a row that was unread when it was first shown keeps its unread look for
 * a few seconds, so the reader still sees what was new. Each arrival gets its own timer: a row that comes
 * with a later refetch must not extend the seconds of the rows already showing.
 */
export function useUnreadLook(
  notifications: readonly NotificationDTO[],
): (item: NotificationDTO) => boolean {
  const [seen, setSeen] = useState<ReadonlySet<string>>(NO_IDS)
  const [lit, setLit] = useState<ReadonlySet<string>>(NO_IDS)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const fresh = notifications.filter((n) => !n.read && !seen.has(n.id)).map((n) => n.id)
    if (fresh.length === 0) return
    setSeen((prev) => new Set([...prev, ...fresh]))
    setLit((prev) => new Set([...prev, ...fresh]))
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setLit((prev) => new Set([...prev].filter((id) => !fresh.includes(id))))
    }, UNREAD_LOOK_MS)
    timers.current.add(timer)
  }, [notifications, seen])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending) clearTimeout(timer)
      pending.clear()
    }
  }, [])

  // Until the effect records a row, an unread one is new by definition: it is being shown for the first time.
  return useCallback(
    (item: NotificationDTO) => lit.has(item.id) || (!item.read && !seen.has(item.id)),
    [lit, seen],
  )
}

const NO_IDS: ReadonlySet<string> = new Set()
