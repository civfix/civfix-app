import { avatarColor, monogram, type MessageThreadDTO, type PersonDTO } from "@civfix/shared"

export type ThreadAvatarPeer = Pick<PersonDTO, "id" | "name" | "avatarUrl" | "avatar">

export type ThreadAvatarInput = Pick<MessageThreadDTO, "id" | "kind" | "title" | "refId"> & {
  peer?: ThreadAvatarPeer | null
}

export interface ResolvedThreadAvatar {
  isGroup: boolean
  photoUrl: string | null
  name: string
  seed: string
  gradient: readonly [string, string] | null
  color: string
  letter: string
}

export function resolveThreadAvatar(thread: ThreadAvatarInput): ResolvedThreadAvatar {
  const isGroup = thread.kind === "group" || thread.kind === "cleanup" || thread.kind === "report"
  // A group never shows a peer photo; ignore any peer attached to a non-DM thread.
  const peer = isGroup ? null : thread.peer ?? null
  const seed = peer?.id ?? thread.refId ?? thread.id
  const gradient = peer?.avatar ?? null
  const color = gradient?.[0] ?? avatarColor(seed)
  return {
    isGroup,
    photoUrl: peer?.avatarUrl ?? null,
    name: peer?.name ?? thread.title,
    seed,
    gradient,
    color,
    letter: monogram(peer?.name ?? thread.title),
  }
}
