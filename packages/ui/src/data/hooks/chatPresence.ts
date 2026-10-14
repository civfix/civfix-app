import { useState } from "react"

export function withPresenceChange(
  prev: ReadonlySet<string>,
  userId: string,
  state: "join" | "leave",
): Set<string> {
  const next = new Set(prev)
  if (state === "join") next.add(userId)
  else next.delete(userId)
  return next
}

/** The room's online members; the count excludes the viewer. */
export function useChatPresence(myUserId: string | null) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set())
  const onlineCount =
    myUserId && onlineUserIds.has(myUserId) ? onlineUserIds.size - 1 : onlineUserIds.size
  return { onlineCount, setOnlineUserIds }
}
