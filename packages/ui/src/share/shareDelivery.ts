import { chatSendOutcome, type ChatSocketLike } from "../data/types"
import {
  summarizeShareRun,
  type ShareDeliveryOutcome,
  type SharePlanEntry,
  type ShareRunSummary,
} from "./shareToDm"

export const SHARE_SOCKET_OPEN_TIMEOUT_MS = 8_000

export type AckVerdict = "acked" | "rejected" | "timeout" | "transport" | "aborted"

export interface ShareDeliveryDeps {
  socket: ChatSocketLike
  resolveRoom: (recipientId: string) => Promise<string | null>
  ackTimeoutMs: number
  queuedAckTimeoutMs?: number
  openTimeoutMs?: number
  signal?: AbortSignal
}

export interface ShareDeliveryInput {
  entries: readonly SharePlanEntry[]
  body: string
}

export interface ShareRunResult {
  summary: ShareRunSummary
  rooms: string[]
  resolved: Map<string, string>
}

export interface ShareRunToken {
  readonly aborted: boolean
  readonly signal: AbortSignal
}

export interface ShareRuns {
  begin: () => ShareRunToken
  end: (token: ShareRunToken) => void
  abortAll: () => void
  readonly busy: boolean
}

// One token per run, so starting a run can never clear the abort of another that is still in flight.
export function makeShareRuns(): ShareRuns {
  const live = new Map<ShareRunToken, AbortController>()
  return {
    begin: () => {
      const controller = new AbortController()
      const token: ShareRunToken = {
        get aborted() {
          return controller.signal.aborted
        },
        signal: controller.signal,
      }
      live.set(token, controller)
      return token
    },
    end: (token) => {
      live.delete(token)
    },
    abortAll: () => {
      for (const controller of live.values()) controller.abort()
    },
    get busy() {
      return live.size > 0
    },
  }
}

const ABORTED: unique symbol = Symbol("aborted")

// The abandoned work keeps its rejection handler, so a late failure after an abort is not unhandled.
function unlessAborted<T>(work: Promise<T>, signal: AbortSignal | undefined): Promise<T | typeof ABORTED> {
  if (!signal) return work
  return new Promise<T | typeof ABORTED>((resolve, reject) => {
    const onAbort = (): void => resolve(ABORTED)
    if (signal.aborted) onAbort()
    else signal.addEventListener("abort", onAbort, { once: true })
    work.then(
      (value) => {
        signal.removeEventListener("abort", onAbort)
        resolve(value)
      },
      (err: unknown) => {
        signal.removeEventListener("abort", onAbort)
        reject(err)
      },
    )
  })
}

export function waitForSocketOpen(
  socket: ChatSocketLike,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false)
  if (socket.getStatus() === "open") return Promise.resolve(true)
  return new Promise<boolean>((resolve) => {
    let settled = false
    let off: (() => void) | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    const onAbort = (): void => finish(false)
    const finish = (open: boolean): void => {
      if (settled) return
      settled = true
      signal?.removeEventListener("abort", onAbort)
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
    signal?.addEventListener("abort", onAbort, { once: true })
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
  extend: (timeoutMs: number) => void
}

export function ackWaiter(
  socket: ChatSocketLike,
  clientId: string,
  roomId: string,
  timeoutMs: number,
  signal?: AbortSignal,
): AckWaiter {
  let resolveSettled: ((verdict: AckVerdict) => void) | null = null
  const settled = new Promise<AckVerdict>((resolve) => {
    resolveSettled = resolve
  })
  let off: (() => void) | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const onAbort = (): void => finish("aborted")
  const finish = (verdict: AckVerdict): void => {
    signal?.removeEventListener("abort", onAbort)
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
  const arm = (ms: number): void => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => finish("timeout"), ms)
  }
  arm(timeoutMs)
  if (signal?.aborted) finish("aborted")
  else signal?.addEventListener("abort", onAbort, { once: true })
  return {
    settled,
    cancel: () => finish("timeout"),
    extend: (ms) => {
      if (resolveSettled !== null) arm(ms)
    },
  }
}

export async function runShareToDm(
  deps: ShareDeliveryDeps,
  { entries, body }: ShareDeliveryInput,
): Promise<ShareRunResult> {
  const outcomes = new Map<string, ShareDeliveryOutcome>()
  const rooms = new Set<string>()
  const resolved = new Map<string, string>()
  const openTimeoutMs = deps.openTimeoutMs ?? SHARE_SOCKET_OPEN_TIMEOUT_MS
  const aborted = (): boolean => deps.signal?.aborted === true
  let stopped = false

  if (entries.length === 0) {
    return { summary: summarizeShareRun(entries, outcomes, false), rooms: [], resolved }
  }

  deps.socket.retain()
  try {
    for (const entry of entries) {
      if (aborted()) {
        stopped = true
        break
      }
      const roomId = await unlessAborted(deps.resolveRoom(entry.recipient.id), deps.signal)
      if (roomId === ABORTED) {
        stopped = true
        break
      }
      if (roomId === null) {
        outcomes.set(entry.clientId, "failed")
        continue
      }
      resolved.set(entry.recipient.id, roomId)
      if (aborted()) {
        stopped = true
        break
      }
      if (!(await waitForSocketOpen(deps.socket, openTimeoutMs, deps.signal))) {
        stopped = true
        break
      }
      const waiter = ackWaiter(deps.socket, entry.clientId, roomId, deps.ackTimeoutMs, deps.signal)
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
      // A queued frame is flushed on reconnect and usually lands; give it the composer's longer window
      // rather than reporting a failure for a message the recipient then receives.
      if (outcome === "queued") waiter.extend(deps.queuedAckTimeoutMs ?? deps.ackTimeoutMs)
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

  return { summary: summarizeShareRun(entries, outcomes, stopped), rooms: [...rooms], resolved }
}
