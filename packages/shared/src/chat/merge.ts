import type { ChatMessageDTO } from "../schemas/entities.js"


export type OutboxStatus = "sending" | "failed"

export interface OutboxEntry {
  clientId: string
  message: ChatMessageDTO
  status: OutboxStatus
}

export interface ChatItem {
  message: ChatMessageDTO
  pending: boolean
  failed: boolean
  mine: boolean
}

export const OUTBOX_MATCH_WINDOW_MS = 60_000

export function effectiveClientId(
  message: ChatMessageDTO,
  explicitClientId?: string,
): string | undefined {
  return explicitClientId ?? message.clientId
}

export function preserveViewerFields(
  local: ChatMessageDTO,
  inbound: ChatMessageDTO,
): ChatMessageDTO {
  let changed = false

  const inboundReactions = inbound.reactions ?? []
  const localReactions = local.reactions ?? []
  const reactions = inboundReactions.map((bucket) => {
    const mine = localReactions.find((b) => b.emoji === bucket.emoji)?.mine ?? false
    if (bucket.mine === mine) return bucket
    changed = true
    return { ...bucket, mine }
  })

  let poll = inbound.poll
  if (inbound.poll && local.poll) {
    const localPoll = local.poll
    const options = inbound.poll.options.map((option) => {
      const mine = localPoll.options.find((o) => o.idx === option.idx)?.mine ?? false
      return option.mine === mine ? option : { ...option, mine }
    })
    const optionsChanged = options.some((o, i) => o !== inbound.poll!.options[i])
    const myVoteChanged =
      inbound.poll.myVote.length !== localPoll.myVote.length ||
      inbound.poll.myVote.some((idx, i) => idx !== localPoll.myVote[i])
    if (optionsChanged || myVoteChanged) {
      changed = true
      poll = { ...inbound.poll, myVote: [...localPoll.myVote], options }
    }
  }

  const mineChanged = local.mine !== inbound.mine
  if (!changed && !mineChanged) return inbound

  const next: ChatMessageDTO = { ...inbound, reactions }
  if (poll !== inbound.poll) next.poll = poll
  if (local.mine !== undefined) next.mine = local.mine
  else delete next.mine
  return next
}

export function reconcileInbound(
  outbox: OutboxEntry[],
  liveMessages: ChatMessageDTO[],
  message: ChatMessageDTO,
  explicitClientId?: string,
  viewerTruth = false,
): { outbox: OutboxEntry[]; liveMessages: ChatMessageDTO[]; matchedClientId?: string } {
  const cid = effectiveClientId(message, explicitClientId)
  const stamped: ChatMessageDTO =
    cid && message.clientId !== cid ? { ...message, clientId: cid } : message

  const nextOutbox = cid ? outbox.filter((e) => e.clientId !== cid) : outbox

  const isSame = (m: ChatMessageDTO): boolean =>
    m.id === stamped.id || (cid !== undefined && m.clientId === cid)
  const nextLive = liveMessages.some(isSame)
    ? liveMessages.map((m) =>
        isSame(m) ? (viewerTruth ? stamped : preserveViewerFields(m, stamped)) : m,
      )
    : [...liveMessages, stamped]

  return { outbox: nextOutbox, liveMessages: nextLive, matchedClientId: cid }
}

export function isMine(message: ChatMessageDTO, myUserId: string | null): boolean {
  if (!message.from) return false
  if (myUserId && message.from.id === myUserId) return true
  return message.from.id === "me"
}

export function reconciledByContent(
  outbox: OutboxEntry[],
  confirmedMine: ChatMessageDTO[],
): Set<string> {
  const matched = new Set<string>()
  if (outbox.length === 0 || confirmedMine.length === 0) return matched
  const used = new Set<string>()
  for (const entry of outbox) {
    const body = (entry.message.body ?? "").trim()
    const at = Date.parse(entry.message.createdAt)
    const twin = confirmedMine.find((m) => {
      if (used.has(m.id)) return false
      if ((m.body ?? "").trim() !== body) return false
      const mAt = Date.parse(m.createdAt)
      if (Number.isNaN(at) || Number.isNaN(mAt)) return false
      return Math.abs(mAt - at) <= OUTBOX_MATCH_WINDOW_MS
    })
    if (twin) {
      used.add(twin.id)
      matched.add(entry.clientId)
    }
  }
  return matched
}

export function mergeChatItems(
  historyItems: ChatMessageDTO[],
  liveMessages: ChatMessageDTO[],
  outbox: OutboxEntry[],
  myUserId: string | null,
): ChatItem[] {
  const byId = new Map<string, ChatMessageDTO>()
  const seenClientIds = new Set<string>()
  const add = (m: ChatMessageDTO) => {
    if (m.clientId) seenClientIds.add(m.clientId)
    byId.set(m.id, m)
  }
  for (const m of historyItems) add(m)
  for (const m of liveMessages) add(m)

  const confirmedMessages = [...byId.values()]
  const confirmed: ChatItem[] = confirmedMessages.map((m) => ({
    message: m,
    pending: false,
    failed: false,
    mine: isMine(m, myUserId),
  }))

  const unmatchedByClientId = outbox.filter((e) => !seenClientIds.has(e.clientId))
  const confirmedMine = confirmedMessages.filter((m) => isMine(m, myUserId))
  const contentMatched = reconciledByContent(unmatchedByClientId, confirmedMine)

  const pending: ChatItem[] = unmatchedByClientId
    .filter((e) => !contentMatched.has(e.clientId))
    .map((e) => ({
      message: e.message,
      pending: e.status === "sending",
      failed: e.status === "failed",
      mine: true,
    }))

  const merged = [...confirmed, ...pending]
  const timeOf = new Map<ChatItem, number>()
  for (const item of merged) {
    const t = Date.parse(item.message.createdAt)
    timeOf.set(item, Number.isNaN(t) ? 0 : t)
  }
  merged.sort((a, b) => {
    const ta = timeOf.get(a) ?? 0
    const tb = timeOf.get(b) ?? 0
    if (ta !== tb) return ta - tb
    return a.message.id < b.message.id ? -1 : a.message.id > b.message.id ? 1 : 0
  })
  return merged
}
