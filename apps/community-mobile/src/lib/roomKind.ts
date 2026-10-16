import { RoomKindSchema } from "@civfix/contract"
import type { RoomKind } from "@civfix/contract"

export function parseRoomKind(raw: string | string[] | undefined): RoomKind {
  const value = Array.isArray(raw) ? raw[0] : raw
  const result = RoomKindSchema.safeParse(value)
  return result.success ? result.data : "cleanup"
}
