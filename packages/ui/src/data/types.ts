import type {
  GeomSource,
  ReportCategory,
  ReportType,
  RoomKind,
  UserDTO,
  WsClientMessage,
  WsServerMessage,
} from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"

/** A list envelope's array as a real array of non-null entries; the client does not validate responses. */
export function listItems<T>(list: ReadonlyArray<T | null | undefined> | null | undefined): T[] {
  return Array.isArray(list) ? list.filter((item): item is T => item != null) : []
}

export interface ReportSubmission {
  idempotencyKey: string
  category: ReportCategory
  type: ReportType
  lat: number
  lng: number
  geomSource: GeomSource
  mediaUploadIds: string[]
  title?: string
  description?: string
  addr?: string
}

export interface ReportSubmitResult {
  reportId: string
  lat: number
  lng: number
  category?: ReportCategory
  status?: "held" | "published"
  claimCode?: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: UserDTO | null
  isPending: boolean
  guestSmsEnabled?: boolean
}

export interface RawAuthSignals {
  authed: boolean
  pending: boolean
  user: UserDTO | null
  guestSmsEnabled?: boolean
}

export function normalizeAuthState({
  authed,
  pending,
  user,
  guestSmsEnabled,
}: RawAuthSignals): AuthState {
  const isAuthenticated = authed && !pending && user !== null
  return {
    isAuthenticated,
    user,
    isPending: pending,
    ...(guestSmsEnabled === undefined ? {} : { guestSmsEnabled }),
  }
}

export interface DataContextValue {
  api: ApiClient
  useAuthState: () => AuthState
  requireAuth: (action: () => void, opts?: { next?: string }) => void
  logout: () => void | Promise<void>
  onUserUpdated?: (user: UserDTO) => void
  submitReport?: (submission: ReportSubmission) => Promise<ReportSubmitResult>
  getTurnstileToken?: (action: string) => Promise<string>
  /** Publishable CARTO basemap api key; absent means the shared maps request keyless (watermarked) tiles. */
  cartoApiKey?: string
  chatSocket: ChatSocketLike
}

export type ChatConnState = "connecting" | "open" | "closed"

export type ChatSendOutcome = "sent" | "queued" | "dropped"

export type LegacySendDeliveredResult = true | void
export type LegacySendDroppedResult = false
export type ChatSendResult = ChatSendOutcome | LegacySendDeliveredResult | LegacySendDroppedResult

export function chatSendOutcome(result: ChatSendResult): ChatSendOutcome {
  if (result === "sent" || result === "queued" || result === "dropped") return result
  const legacyDropped: LegacySendDroppedResult = false
  return result === legacyDropped ? "dropped" : "sent"
}

export interface ChatSocketLike {
  retain: () => void
  release: () => void
  join: (roomId: string, roomKind: RoomKind) => void
  leave: (roomId: string, roomKind: RoomKind) => void
  send: (frame: WsClientMessage) => ChatSendResult
  markRoomRejected: (roomId: string, roomKind: RoomKind) => void
  subscribe: (handler: (frame: WsServerMessage) => void) => () => void
  onStatus: (handler: (status: ChatConnState) => void) => () => void
  getStatus: () => ChatConnState
}
