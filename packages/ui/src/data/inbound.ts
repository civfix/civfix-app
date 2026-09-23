import {
  ErrorCode,
  effectiveClientId,
  preserveViewerFields,
  reconcileInbound,
  type ChatHistoryResponse,
  type ChatMessageDTO,
  type OutboxEntry,
  type RoomKind,
} from "@civfix/shared"

export interface InboundFrame {
  message: ChatMessageDTO
  explicitClientId?: string
  viewerTruth?: boolean
}

export function foldInboundBatch(
  outbox: OutboxEntry[],
  liveMessages: ChatMessageDTO[],
  batch: readonly InboundFrame[],
): { outbox: OutboxEntry[]; liveMessages: ChatMessageDTO[] } {
  let nextOutbox = outbox
  for (const { message, explicitClientId, viewerTruth } of batch) {
    nextOutbox = reconcileInbound(nextOutbox, [], message, explicitClientId, viewerTruth).outbox
  }
  let nextLive = liveMessages
  for (const { message, explicitClientId, viewerTruth } of batch) {
    nextLive = reconcileInbound([], nextLive, message, explicitClientId, viewerTruth).liveMessages
  }
  return { outbox: nextOutbox, liveMessages: nextLive }
}

function oldestCachedAt(pages: readonly ChatHistoryResponse[]): number | null {
  let oldest: number | null = null
  for (const page of pages) {
    for (const item of page.items) {
      const at = Date.parse(item.createdAt)
      if (Number.isNaN(at)) continue
      if (oldest === null || at < oldest) oldest = at
    }
  }
  return oldest
}

function isKnownMessageId(pages: readonly ChatHistoryResponse[], id: string): boolean {
  return pages.some((p) => p.items.some((m) => m.id === id))
}

export function foldInboundIntoPages(
  pages: ChatHistoryResponse[],
  batch: readonly InboundFrame[],
): ChatHistoryResponse[] {
  let next = pages
  const windowFloor = oldestCachedAt(pages)
  for (const { message, explicitClientId, viewerTruth } of batch) {
    const cid = effectiveClientId(message, explicitClientId)
    const stamped: ChatMessageDTO =
      cid && message.clientId !== cid ? { ...message, clientId: cid } : message
    if (windowFloor !== null && !isKnownMessageId(next, stamped.id)) {
      const at = Date.parse(stamped.createdAt)
      if (!Number.isNaN(at) && at < windowFloor) continue
    }
    next = upsertMessageIntoPages(next, stamped, viewerTruth !== true)
  }
  return next
}

export function foldHistoryIntoPages(
  pages: ChatHistoryResponse[],
  items: readonly ChatMessageDTO[],
): ChatHistoryResponse[] {
  let next = pages
  for (const message of items) {
    next = upsertMessageIntoPages(next, message, false)
  }
  return next
}

function upsertMessageIntoPages(
  pages: ChatHistoryResponse[],
  message: ChatMessageDTO,
  preserveViewer: boolean,
): ChatHistoryResponse[] {
  const first = pages[0]
  if (!first) return pages
  let replaced = false
  let changed = false
  const nextPages = pages.map((page) => {
    const idx = page.items.findIndex((m) => m.id === message.id)
    if (idx === -1) return page
    replaced = true
    const local = page.items[idx]!
    const stored = preserveViewer ? preserveViewerFields(local, message) : message
    if (stored === local) return page
    changed = true
    const items = page.items.slice()
    items[idx] = stored
    return { ...page, items }
  })
  if (replaced) return changed ? nextPages : pages
  return [{ ...first, items: [...first.items, message] }, ...pages.slice(1)]
}

export function patchMessageInPages(
  pages: ChatHistoryResponse[],
  messageId: string,
  patch: Partial<ChatMessageDTO>,
): ChatHistoryResponse[] {
  let changed = false
  const next = pages.map((page) => {
    const inItems = page.items.some((m) => m.id === messageId)
    const inPins = (page.pins ?? []).some((m) => m.id === messageId)
    if (!inItems && !inPins) return page
    changed = true
    return {
      ...page,
      items: inItems
        ? page.items.map((m) => (m.id === messageId ? { ...m, ...patch } : m))
        : page.items,
      ...(page.pins && inPins
        ? { pins: page.pins.map((m) => (m.id === messageId ? { ...m, ...patch } : m)) }
        : {}),
    }
  })
  return changed ? next : pages
}

export function shouldResetToNewestPage(
  pages: readonly ChatHistoryResponse[],
  fetched: ChatHistoryResponse,
): boolean {
  if (fetched.items.length === 0) return false
  if (fetched.nextCursor == null) return false
  return !fetched.items.some((m) => isKnownMessageId(pages, m.id))
}

export interface HistoryCacheData {
  pages: ChatHistoryResponse[]
  pageParams: unknown[]
}

export type HistoryCacheOp =
  | { kind: "frames"; frames: InboundFrame[] }
  | { kind: "patch"; messageId: string; patch: Partial<ChatMessageDTO> }
  | { kind: "newestPage"; page: ChatHistoryResponse }

export function applyHistoryCacheOps(
  data: HistoryCacheData,
  ops: readonly HistoryCacheOp[],
): HistoryCacheData {
  let pages = data.pages
  let pageParams = data.pageParams
  for (const op of ops) {
    if (op.kind === "frames") {
      pages = foldInboundIntoPages(pages, op.frames)
    } else if (op.kind === "patch") {
      pages = patchMessageInPages(pages, op.messageId, op.patch)
    } else if (shouldResetToNewestPage(pages, op.page)) {
      pages = [op.page]
      pageParams = [undefined]
    } else {
      pages = foldHistoryIntoPages(pages, op.page.items)
    }
  }
  if (pages === data.pages && pageParams === data.pageParams) return data
  return { pages, pageParams }
}

export function prunableFrameIds(
  ops: readonly HistoryCacheOp[],
  pages: readonly ChatHistoryResponse[],
): Set<string> {
  const ids = new Set<string>()
  for (const op of ops) {
    if (op.kind !== "frames") continue
    for (const frame of op.frames) {
      if (!isKnownMessageId(pages, frame.message.id)) continue
      ids.add(frame.message.id)
      const cid = effectiveClientId(frame.message, frame.explicitClientId)
      if (cid) ids.add(cid)
    }
  }
  return ids
}

export const MAX_JOURNALED_FRAMES = 300

export function journalFrames(
  ops: readonly HistoryCacheOp[],
  frames: readonly InboundFrame[],
  maxFrames = MAX_JOURNALED_FRAMES,
): HistoryCacheOp[] {
  const next = [...ops]
  const last = next[next.length - 1]
  if (last && last.kind === "frames") {
    next[next.length - 1] = { kind: "frames", frames: [...last.frames, ...frames] }
  } else {
    next.push({ kind: "frames", frames: [...frames] })
  }
  let total = 0
  for (const op of next) {
    if (op.kind === "frames") total += op.frames.length
  }
  if (total <= maxFrames) return next
  let excess = total - maxFrames
  const bounded: HistoryCacheOp[] = []
  for (const op of next) {
    if (op.kind !== "frames" || excess === 0) {
      bounded.push(op)
      continue
    }
    const drop = Math.min(excess, op.frames.length)
    excess -= drop
    if (drop < op.frames.length) {
      bounded.push({ kind: "frames", frames: op.frames.slice(drop) })
    }
  }
  return bounded
}

const FATAL_ROOM_ERROR_CODES: ReadonlySet<string> = new Set([
  ErrorCode.FORBIDDEN,
  ErrorCode.NOT_FOUND,
  ErrorCode.UNAUTHORIZED,
])

// Room ids are unique only within a kind, and the server omits `roomKind` on cleanup-room frames.
export function frameInRoom(
  frame: { cleanupId?: string; roomKind?: RoomKind },
  roomId: string,
  roomKind: RoomKind,
): boolean {
  return frame.cleanupId === roomId && (frame.roomKind ?? "cleanup") === roomKind
}

export function isFatalRoomErrorCode(code: string): boolean {
  return FATAL_ROOM_ERROR_CODES.has(code)
}

const SEND_REJECTION_ERROR_CODES: ReadonlySet<string> = new Set([
  "BAD_FRAME",
  "BLOCKED",
  ErrorCode.RATE_LIMITED,
  ErrorCode.VALIDATION,
  "channel_read_only",
  "reply_wrong_room",
  "reply_deleted_target",
])

export function isSendRejectionErrorCode(code: string): boolean {
  return SEND_REJECTION_ERROR_CODES.has(code)
}

export function replayableEntries(
  outbox: readonly OutboxEntry[],
  offlineFailed: ReadonlySet<string>,
  coreQueued: ReadonlySet<string> = new Set(),
): OutboxEntry[] {
  return outbox.filter(
    (e) =>
      !coreQueued.has(e.clientId) &&
      (e.status === "sending" || (e.status === "failed" && offlineFailed.has(e.clientId))),
  )
}
