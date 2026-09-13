import { MESSAGE_BODY_MAX, type MessageThreadDTO, type PersonDTO } from "@civfix/shared"

export const SHARE_DM_MAX_RECIPIENTS = 10

export const SHARE_DM_RECENT_LIMIT = 20

export const SHARE_CLIENT_ID_MAX = 64

export interface ShareRecipient {
  id: string
  name: string
}

export interface SharePlanEntry {
  recipient: ShareRecipient
  clientId: string
}

export type ShareDeliveryOutcome = "sent" | "failed"

export type ShareRunStatus = "all" | "partial" | "none"

export interface ShareRunSummary {
  status: ShareRunStatus
  sent: ShareRecipient[]
  failed: ShareRecipient[]
  stopped: boolean
}

export interface RecipientChange {
  recipients: PersonDTO[]
  rejected: boolean
}

export function applyRecipientChange(
  current: readonly PersonDTO[],
  next: readonly PersonDTO[],
  max: number = SHARE_DM_MAX_RECIPIENTS,
): RecipientChange {
  if (next.length > max && next.length > current.length) {
    return { recipients: [...current], rejected: true }
  }
  return { recipients: [...next], rejected: false }
}

export function composeShareBody(note: string, url: string): string {
  const trimmed = note.trim()
  return trimmed.length > 0 ? `${trimmed}\n${url}` : url
}

export function shareNoteMaxLength(url: string): number {
  return Math.max(0, MESSAGE_BODY_MAX - url.length - 1)
}

export function toShareRecipient(person: PersonDTO): ShareRecipient {
  return { id: person.id, name: person.name }
}

export function buildSharePlan(
  recipients: readonly ShareRecipient[],
  newClientId: (index: number) => string,
  max: number = SHARE_DM_MAX_RECIPIENTS,
): SharePlanEntry[] {
  const seen = new Set<string>()
  const entries: SharePlanEntry[] = []
  for (const recipient of recipients) {
    if (recipient.id.length === 0 || seen.has(recipient.id)) continue
    seen.add(recipient.id)
    entries.push({
      recipient,
      clientId: newClientId(entries.length).slice(0, SHARE_CLIENT_ID_MAX),
    })
    if (entries.length === max) break
  }
  return entries
}

export function summarizeShareRun(
  entries: readonly SharePlanEntry[],
  outcomes: ReadonlyMap<string, ShareDeliveryOutcome>,
  stopped = false,
): ShareRunSummary {
  const sent: ShareRecipient[] = []
  const failed: ShareRecipient[] = []
  for (const entry of entries) {
    if (outcomes.get(entry.clientId) === "sent") sent.push(entry.recipient)
    else failed.push(entry.recipient)
  }
  const status: ShareRunStatus =
    sent.length > 0 && failed.length === 0 ? "all" : sent.length === 0 ? "none" : "partial"
  return { status, sent, failed, stopped }
}

export function retryEntries(
  entries: readonly SharePlanEntry[],
  failed: readonly ShareRecipient[],
): SharePlanEntry[] {
  const ids = new Set(failed.map((recipient) => recipient.id))
  return entries.filter((entry) => ids.has(entry.recipient.id))
}

export function recipientNames(recipients: readonly ShareRecipient[]): string {
  return recipients.map((recipient) => recipient.name).join(", ")
}

export function dmThreadIdsByPeer(
  pages: readonly { items?: readonly MessageThreadDTO[] | null }[] | undefined,
): Map<string, string> {
  const byPeer = new Map<string, string>()
  for (const page of pages ?? []) {
    for (const thread of page.items ?? []) {
      if (thread?.kind !== "dm") continue
      const peerId = thread.peer?.id
      const roomId = thread.refId ?? thread.id
      if (!peerId || !roomId || byPeer.has(peerId)) continue
      byPeer.set(peerId, roomId)
    }
  }
  return byPeer
}

export function recentDmPeers(
  pages: readonly { items?: readonly MessageThreadDTO[] | null }[] | undefined,
  limit: number = SHARE_DM_RECENT_LIMIT,
): PersonDTO[] {
  const seen = new Set<string>()
  const peers: PersonDTO[] = []
  for (const page of pages ?? []) {
    for (const thread of page.items ?? []) {
      if (thread?.kind !== "dm") continue
      const peer = thread.peer
      if (!peer || peer.id.length === 0 || peer.deleted === true || seen.has(peer.id)) continue
      seen.add(peer.id)
      peers.push(peer)
      if (peers.length === limit) return peers
    }
  }
  return peers
}
