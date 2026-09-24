import type { CleanupDTO, MessageThreadDTO, RoomKind } from "@civfix/shared"
import { useNavStore } from "./useNavStore"

export function isTopEntry(
  stack: ReadonlyArray<{ kind: string; id?: string }>,
  kind: string,
  id: string,
): boolean {
  const top = stack[stack.length - 1]
  return top !== undefined && top.kind === kind && top.id === id
}

export function openThread(thread: MessageThreadDTO): void {
  const roomId = thread.refId ?? thread.id
  if (isTopEntry(useNavStore.getState().stack, "thread", roomId)) return
  if (thread.kind === "dm") {
    useNavStore.getState().push({
      kind: "thread",
      id: roomId,
      roomKind: "dm",
      ...(thread.peer ? { peer: thread.peer } : {}),
    })
    return
  }
  if (thread.kind === "report") {
    useNavStore.getState().push({ kind: "thread", id: roomId, roomKind: "report" })
    return
  }
  if (thread.kind === "group") {
    useNavStore.getState().push({ kind: "thread", id: roomId, roomKind: "group", title: thread.title })
    return
  }
  useNavStore.getState().push({ kind: "thread", id: roomId, roomKind: "cleanup" })
}

export function openNewGroup(): void {
  useNavStore.getState().push({ kind: "new-group" })
}

export function openNewChannel(): void {
  useNavStore.getState().push({ kind: "new-channel" })
}

export function openGroupInfo(id: string): void {
  useNavStore.getState().push({ kind: "group-info", id })
}

export function openPinnedMessages(roomId: string, roomKind: RoomKind): void {
  useNavStore.getState().push({ kind: "pinned-messages", id: roomId, roomKind })
}

export function clearThreadJumpParam(roomId: string): void {
  const nav = useNavStore.getState()
  let changed = false
  const stack = nav.stack.map((entry) => {
    if (entry.kind !== "thread" || entry.id !== roomId || entry.jumpToMessageId === undefined) return entry
    changed = true
    const { jumpToMessageId: _consumed, ...rest } = entry
    void _consumed
    return rest
  })
  if (changed) nav.setStack(stack)
}

export function pushCleanup(c: CleanupDTO): void {
  useNavStore.getState().push({
    kind: "cleanup",
    id: c.id,
    title: c.title,
    lat: c.lat,
    lng: c.lng,
  })
}
