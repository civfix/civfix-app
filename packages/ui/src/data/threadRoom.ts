import type { MessageThreadDTO, RoomKind } from "@civfix/shared"

/** A thread row is keyed by the room it fronts (the report, event or group id); only a DM has no ref. */
export function threadRoomId(thread: Pick<MessageThreadDTO, "id" | "refId">): string {
  return thread.refId ?? thread.id
}

/** Room ids are unique per kind only, so a lookup matches on both. */
export function threadMatchesRoom(thread: MessageThreadDTO, roomKind: RoomKind, roomId: string): boolean {
  return thread.kind === roomKind && threadRoomId(thread) === roomId
}
