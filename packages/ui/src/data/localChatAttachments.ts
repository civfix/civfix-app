import type { ChatItem, ChatMessageDTO, MediaDTO } from "@civfix/shared"

const MAX_LOCAL_MESSAGES = 30

const byKey = new Map<string, MediaDTO[]>()

function touch(key: string, attachments: MediaDTO[]): void {
  if (byKey.has(key)) byKey.delete(key)
  byKey.set(key, attachments)
  while (byKey.size > MAX_LOCAL_MESSAGES) {
    const oldest = byKey.keys().next().value
    if (oldest === undefined) break
    byKey.delete(oldest)
  }
}

export function rememberLocalChatAttachments(clientId: string, attachments: MediaDTO[]): void {
  if (attachments.length === 0) return
  touch(clientId, attachments)
}

export function linkLocalChatAttachments(clientId: string, messageId: string): void {
  if (clientId === messageId) return
  const local = byKey.get(clientId)
  if (!local) return
  byKey.delete(clientId)
  touch(messageId, local)
}

export function localChatAttachments(message: ChatMessageDTO): MediaDTO[] | null {
  return byKey.get(message.id) ?? (message.clientId ? byKey.get(message.clientId) ?? null : null)
}

function settled(media: MediaDTO): boolean {
  return media.status !== "validating"
}

export function mergeLocalAttachments(local: MediaDTO[], server: MediaDTO[]): MediaDTO[] {
  if (server.length >= local.length) return server
  if (server.length === 0) return local
  if (server.every(settled)) return server
  const serverById = new Map(server.map((m) => [m.id, m]))
  const merged = local.map((m) => serverById.get(m.id) ?? m)
  for (const m of server) {
    if (!local.some((l) => l.id === m.id)) merged.push(m)
  }
  return merged
}

export function withLocalChatAttachments(message: ChatMessageDTO): ChatMessageDTO {
  const local = localChatAttachments(message)
  if (!local) return message
  const server = message.attachments ?? []
  const merged = mergeLocalAttachments(local, server)
  return merged === server ? message : { ...message, attachments: merged }
}

export function restoreLocalChatAttachments(items: ChatItem[]): ChatItem[] {
  let changed = false
  const next = items.map((item) => {
    const message = withLocalChatAttachments(item.message)
    if (message === item.message) return item
    changed = true
    return { ...item, message }
  })
  return changed ? next : items
}

export function clearLocalChatAttachments(): void {
  byKey.clear()
}
