import { RoomKindSchema } from "@civfix/shared"
import type { RoomKind } from "@civfix/shared"

export function parseRoomKind(raw: string | string[] | undefined): RoomKind {
  const value = Array.isArray(raw) ? raw[0] : raw
  const result = RoomKindSchema.safeParse(value)
  return result.success ? result.data : "cleanup"
}
