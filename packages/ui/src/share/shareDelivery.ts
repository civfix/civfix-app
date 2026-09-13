import { chatSendOutcome, type ChatSocketLike } from "../data/types"
import {
  summarizeShareRun,
  type ShareDeliveryOutcome,
  type SharePlanEntry,
  type ShareRunSummary,
} from "./shareToDm"

export const SHARE_SOCKET_OPEN_TIMEOUT_MS = 8_000

export type AckVerdict = "acked" | "rejected" | "timeout" | "transport"

export interface ShareDeliveryDeps {
  socket: ChatSocketLike
  resolveRoom: (recipientId: string) => Promise<string | null>
  ackTimeoutMs: number
  openTimeoutMs?: number
  isAborted?: () => boolean
}

export interface ShareDeliveryInput {
  entries: readonly SharePlanEntry[]
  body: string
}

export interface ShareRunResult {
  summary: ShareRunSummary
  rooms: string[]
}

export function waitForSocketOpen(socket: ChatSocketLike, timeoutMs: number): Promise<boolean> {
  if (socket.getStatus() === "open") return Promise.resolve(true)
  return new Promise<boolean>((resolve) => {
    let settled = false
    let off: (() => void) | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    const finish = (open: boolean): void => {
      if (settled) return
      settled = true
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      if (off !== null) {
        off()
        off = null
      }
      resolve(open)
    }
    timer = setTimeout(() => finish(false), timeoutMs)
    const unsubscribe = socket.onStatus((status) => {
      if (status === "open") finish(true)
    })
    if (settled) unsubscribe()
    else off = unsubscribe
  })
}

interface AckWaiter {
  settled: Promise<AckVerdict>
  cancel: () => void
}

export function ackWaiter(
  socket: ChatSocketLike,
  clientId: string,
  roomId: string,
  timeoutMs: number,
): AckWaiter {
  let resolveSettled: ((verdict: AckVerdict) => void) | null = null
  const settled = new Promise<AckVerdict>((resolve) => {
    resolveSettled = resolve
  })
  let off: (() => void) | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const finish = (verdict: AckVerdict): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (off !== null) {
      off()
      off = null
    }
    const resolve = resolveSettled
    resolveSettled = null
    if (resolve) resolve(verdict)
  }
  off = socket.subscribe((frame) => {
    if (frame.type === "ack" && frame.clientId === clientId) finish("acked")
    else if (frame.type === "error" && frame.cleanupId === roomId) finish("rejected")
    else if (frame.type === "error" && frame.cleanupId == null) finish("transport")
  })
  timer = setTimeout(() => finish("timeout"), timeoutMs)
  return { settled, cancel: () => finish("timeout") }
}

export async function runShareToDm(
  deps: ShareDeliveryDeps,
  { entries, body }: ShareDeliveryInput,
): Promise<ShareRunResult> {
  const outcomes = new Map<string, ShareDeliveryOutcome>()
  const rooms = new Set<string>()
  const openTimeoutMs = deps.openTimeoutMs ?? SHARE_SOCKET_OPEN_TIMEOUT_MS
  const aborted = (): boolean => deps.isAborted?.() === true
  let stopped = false

  if (entries.length === 0) {
    return { summary: summarizeShareRun(entries, outcomes, false), rooms: [] }
  }

  deps.socket.retain()
  try {
    for (const entry of entries) {
      if (aborted()) {
        stopped = true
        break
      }
      const roomId = await deps.resolveRoom(entry.recipient.id)
      if (roomId === null) {
        outcomes.set(entry.clientId, "failed")
        continue
      }
      if (aborted()) {
        stopped = true
        break
      }
      if (!(await waitForSocketOpen(deps.socket, openTimeoutMs))) {
        stopped = true
        break
      }
      const waiter = ackWaiter(deps.socket, entry.clientId, roomId, deps.ackTimeoutMs)
      const outcome = chatSendOutcome(
        deps.socket.send({
          type: "send",
          cleanupId: roomId,
          roomKind: "dm",
          clientId: entry.clientId,
          body,
        }),
      )
      if (outcome === "dropped") {
        waiter.cancel()
        stopped = true
        break
      }
      const verdict = await waiter.settled
      if (verdict === "acked") {
        outcomes.set(entry.clientId, "sent")
        rooms.add(roomId)
        continue
      }
      if (verdict === "rejected") {
        outcomes.set(entry.clientId, "failed")
        continue
      }
      stopped = true
      break
    }
  } finally {
    deps.socket.release()
  }

  return { summary: summarizeShareRun(entries, outcomes, stopped), rooms: [...rooms] }
}
