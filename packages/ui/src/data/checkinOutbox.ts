import type { CheckinOutcome } from "@civfix/shared"
import { ErrorCode } from "@civfix/shared"
import type { PersistenceCapability, SecureStoreCapability } from "../capabilities"

export type OutboxStore = PersistenceCapability | SecureStoreCapability

export const CHECKIN_OUTBOX_KEY = "civfix.checkin.outbox.v1"

export function checkinOutboxKey(ownerId: string): string {
  return `${CHECKIN_OUTBOX_KEY}.${ownerId}`
}

export const CHECKIN_OUTBOX_TTL_MS = 48 * 60 * 60 * 1000

export const CHECKIN_OUTBOX_MAX = 500

const CHECKIN_REPLAY_BATCH = 25

const CHECKIN_RETRY_BACKOFF_MS: readonly number[] = [0, 5_000, 30_000, 120_000, 600_000]

export type CheckinOutboxMethod = "scan" | "manual"

export interface CheckinOutboxEntry {
  id: string
  cleanupId: string
  method: CheckinOutboxMethod
  token: string | null
  seatId: string | null
  queuedAt: number
  attempts: number
  nextAttemptAt: number
}

export interface CheckinOutboxState {
  entries: readonly CheckinOutboxEntry[]
}

export interface CheckinOutboxInput {
  cleanupId: string
  method: CheckinOutboxMethod
  token?: string | null
  seatId?: string | null
}

export const EMPTY_CHECKIN_OUTBOX: CheckinOutboxState = { entries: [] }

export function checkinEntryId(input: CheckinOutboxInput): string {
  const subject = input.seatId ?? input.token ?? ""
  return `${input.cleanupId}:${input.method === "manual" ? "seat" : "token"}:${subject}`
}

function isLive(entry: CheckinOutboxEntry, now: number): boolean {
  return now - entry.queuedAt < CHECKIN_OUTBOX_TTL_MS
}

export function pruneExpired(state: CheckinOutboxState, now: number): CheckinOutboxState {
  const kept = state.entries.filter((entry) => isLive(entry, now))
  return kept.length === state.entries.length ? state : { entries: kept }
}

export function enqueue(
  state: CheckinOutboxState,
  input: CheckinOutboxInput,
  now: number,
): CheckinOutboxState {
  const subject = input.seatId ?? input.token ?? null
  if (subject === null || subject.length === 0) return state
  const id = checkinEntryId(input)
  const pruned = pruneExpired(state, now)
  if (pruned.entries.some((entry) => entry.id === id)) return pruned
  const entry: CheckinOutboxEntry = {
    id,
    cleanupId: input.cleanupId,
    method: input.method,
    token: input.token ?? null,
    seatId: input.seatId ?? null,
    queuedAt: now,
    attempts: 0,
    nextAttemptAt: now,
  }
  const next = [...pruned.entries, entry]
  return { entries: next.length > CHECKIN_OUTBOX_MAX ? next.slice(next.length - CHECKIN_OUTBOX_MAX) : next }
}

export function mergeQueued(
  stored: CheckinOutboxState,
  arrivals: readonly CheckinOutboxInput[],
  now: number,
): CheckinOutboxState {
  let next = stored
  for (const input of arrivals) next = enqueue(next, input, now)
  return next
}

export interface OutboxScope {
  cleanupId?: string | undefined
  limit?: number
}

export function dequeueReady(
  state: CheckinOutboxState,
  now: number,
  scope: OutboxScope = {},
): readonly CheckinOutboxEntry[] {
  const limit = scope.limit ?? CHECKIN_REPLAY_BATCH
  const out: CheckinOutboxEntry[] = []
  for (const entry of state.entries) {
    if (out.length >= limit) break
    if (scope.cleanupId !== undefined && entry.cleanupId !== scope.cleanupId) continue
    if (!isLive(entry, now)) continue
    if (entry.nextAttemptAt > now) continue
    out.push(entry)
  }
  return out
}

export function markSent(state: CheckinOutboxState, id: string): CheckinOutboxState {
  const kept = state.entries.filter((entry) => entry.id !== id)
  return kept.length === state.entries.length ? state : { entries: kept }
}

export function markFailed(
  state: CheckinOutboxState,
  id: string,
  now: number,
  options: { retryable: boolean } = { retryable: true },
): CheckinOutboxState {
  if (!options.retryable) return markSent(state, id)
  let changed = false
  const entries = state.entries.map((entry) => {
    if (entry.id !== id) return entry
    changed = true
    const attempts = entry.attempts + 1
    const step = Math.min(attempts, CHECKIN_RETRY_BACKOFF_MS.length - 1)
    const delay = CHECKIN_RETRY_BACKOFF_MS[step] ?? 0
    return { ...entry, attempts, nextAttemptAt: now + delay }
  })
  return changed ? pruneExpired({ entries }, now) : state
}

export function pending(state: CheckinOutboxState, now: number, cleanupId?: string): number {
  return state.entries.reduce((count, entry) => {
    if (cleanupId !== undefined && entry.cleanupId !== cleanupId) return count
    return isLive(entry, now) ? count + 1 : count
  }, 0)
}

export type ReplayDisposition = "sent" | "retry" | "hold" | "drop"

export type ReplayDropReason = "forbidden" | "refused"

export interface ReplayOutcome {
  disposition: ReplayDisposition
  dropReason: ReplayDropReason | null
}

export function replayOutcome(errorCode: string | undefined): ReplayOutcome {
  if (errorCode === undefined || errorCode === ErrorCode.CONFLICT) {
    return { disposition: "sent", dropReason: null }
  }
  if (errorCode === ErrorCode.RATE_LIMITED || errorCode === ErrorCode.INTERNAL) {
    return { disposition: "retry", dropReason: null }
  }
  if (errorCode === ErrorCode.UNAUTHORIZED) return { disposition: "hold", dropReason: null }
  if (errorCode === ErrorCode.FORBIDDEN) return { disposition: "drop", dropReason: "forbidden" }
  return { disposition: "drop", dropReason: "refused" }
}

export type ReplayEvent =
  | { kind: "settled"; outcome: CheckinOutcome }
  | { kind: "conflict" }
  | { kind: "held" }
  | { kind: "forbidden" }
  | { kind: "discarded" }
  | { kind: "retry" }

export interface ReplayRefusal {
  outcome: CheckinOutcome
  count: number
}

export interface CheckinReplayReport {
  sent: number
  refusals: readonly ReplayRefusal[]
  held: number
  forbidden: number
  discarded: number
  retry: number
}

const REPLAY_OUTCOME_KIND: Record<CheckinOutcome, "sent" | "refused"> = {
  checked_in: "sent",
  already: "sent",
  cancelled: "refused",
  wrong_event: "refused",
  waitlisted: "refused",
  no_show: "refused",
  unknown_token: "refused",
}

const REFUSAL_ORDER: readonly CheckinOutcome[] = (
  Object.keys(REPLAY_OUTCOME_KIND) as CheckinOutcome[]
).filter((outcome) => REPLAY_OUTCOME_KIND[outcome] === "refused")

export function summarizeReplay(events: readonly ReplayEvent[]): CheckinReplayReport {
  const refused = new Map<CheckinOutcome, number>()
  let sent = 0
  let held = 0
  let forbidden = 0
  let discarded = 0
  let retry = 0
  for (const event of events) {
    switch (event.kind) {
      case "settled":
        if (REPLAY_OUTCOME_KIND[event.outcome] === "sent") sent += 1
        else refused.set(event.outcome, (refused.get(event.outcome) ?? 0) + 1)
        break
      case "conflict":
        sent += 1
        break
      case "held":
        held += 1
        break
      case "forbidden":
        forbidden += 1
        break
      case "discarded":
        discarded += 1
        break
      case "retry":
        retry += 1
        break
    }
  }
  const refusals = REFUSAL_ORDER.flatMap((outcome) => {
    const count = refused.get(outcome) ?? 0
    return count > 0 ? [{ outcome, count }] : []
  })
  return { sent, refusals, held, forbidden, discarded, retry }
}

export function replayReportNotable(report: CheckinReplayReport): boolean {
  return (
    report.refusals.length > 0 || report.held > 0 || report.forbidden > 0 || report.discarded > 0
  )
}

export type ReplaySubject = { kind: "scan"; token: string } | { kind: "manual"; seatId: string }

export function replaySubject(entry: CheckinOutboxEntry): ReplaySubject | null {
  if (entry.method === "scan" && entry.token !== null && entry.token.length > 0) {
    return { kind: "scan", token: entry.token }
  }
  if (entry.seatId !== null && entry.seatId.length > 0) {
    return { kind: "manual", seatId: entry.seatId }
  }
  return null
}

export type ReplayAttempt =
  | { status: "ok"; outcome: CheckinOutcome }
  | { status: "error"; code: string }

export interface ReplayDeps {
  now: () => number
  onState?: (next: CheckinOutboxState) => void
  scope?: OutboxScope
}

export interface ReplayRun {
  state: CheckinOutboxState
  events: readonly ReplayEvent[]
  report: CheckinReplayReport
  sentAny: boolean
}

export async function runReplay(
  state: CheckinOutboxState,
  batch: readonly CheckinOutboxEntry[],
  send: (entry: CheckinOutboxEntry, subject: ReplaySubject) => Promise<ReplayAttempt>,
  deps: ReplayDeps,
): Promise<ReplayRun> {
  let next = state
  const events: ReplayEvent[] = []
  let sentAny = false
  const apply = (updated: CheckinOutboxState) => {
    next = updated
    deps.onState?.(updated)
  }
  for (const entry of batch) {
    const subject = replaySubject(entry)
    if (subject === null) {
      events.push({ kind: "discarded" })
      apply(markSent(next, entry.id))
      continue
    }
    const attempt = await send(entry, subject)
    const outcome = replayOutcome(attempt.status === "ok" ? undefined : attempt.code)
    if (outcome.disposition === "hold") {
      const waiting = pending(next, deps.now(), deps.scope?.cleanupId)
      for (let rest = 0; rest < waiting; rest++) events.push({ kind: "held" })
      break
    }
    if (outcome.disposition === "sent") {
      sentAny = true
      events.push(
        attempt.status === "ok" ? { kind: "settled", outcome: attempt.outcome } : { kind: "conflict" },
      )
      apply(markSent(next, entry.id))
    } else if (outcome.disposition === "drop") {
      events.push(
        outcome.dropReason === "forbidden" ? { kind: "forbidden" } : { kind: "discarded" },
      )
      apply(markFailed(next, entry.id, deps.now(), { retryable: false }))
    } else {
      events.push({ kind: "retry" })
      apply(markFailed(next, entry.id, deps.now(), { retryable: true }))
    }
  }
  return { state: next, events, report: summarizeReplay(events), sentAny }
}

function isEntry(value: unknown): value is CheckinOutboxEntry {
  if (value === null || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === "string" &&
    typeof v.cleanupId === "string" &&
    (v.method === "scan" || v.method === "manual") &&
    (v.token === null || typeof v.token === "string") &&
    (v.seatId === null || typeof v.seatId === "string") &&
    typeof v.queuedAt === "number" &&
    Number.isFinite(v.queuedAt) &&
    typeof v.attempts === "number" &&
    Number.isFinite(v.attempts) &&
    typeof v.nextAttemptAt === "number" &&
    Number.isFinite(v.nextAttemptAt)
  )
}

export function parseOutbox(raw: string | null, now: number, ownerId: string): CheckinOutboxState {
  if (raw === null || raw.length === 0) return EMPTY_CHECKIN_OUTBOX
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return EMPTY_CHECKIN_OUTBOX
  }
  if (parsed === null || typeof parsed !== "object") return EMPTY_CHECKIN_OUTBOX
  if ((parsed as { owner?: unknown }).owner !== ownerId) return EMPTY_CHECKIN_OUTBOX
  const list = (parsed as { entries?: unknown }).entries
  if (!Array.isArray(list)) return EMPTY_CHECKIN_OUTBOX
  const entries = list.filter(isEntry)
  return pruneExpired({ entries }, now)
}

export function serializeOutbox(state: CheckinOutboxState, ownerId: string): string {
  return JSON.stringify({ owner: ownerId, entries: state.entries })
}

async function dropLegacyOutbox(persistence: OutboxStore): Promise<void> {
  try {
    await persistence.del(CHECKIN_OUTBOX_KEY)
  } catch {
    return
  }
}

export async function loadOutbox(
  persistence: OutboxStore,
  now: number,
  ownerId: string,
): Promise<CheckinOutboxState> {
  await dropLegacyOutbox(persistence)
  try {
    return parseOutbox(await persistence.get(checkinOutboxKey(ownerId)), now, ownerId)
  } catch {
    return EMPTY_CHECKIN_OUTBOX
  }
}

export async function saveOutbox(
  persistence: OutboxStore,
  state: CheckinOutboxState,
  ownerId: string,
): Promise<void> {
  const key = checkinOutboxKey(ownerId)
  try {
    if (state.entries.length === 0) await persistence.del(key)
    else await persistence.set(key, serializeOutbox(state, ownerId))
  } catch {
    return
  }
}
