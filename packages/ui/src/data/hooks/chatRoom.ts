import type {
  ChatHistoryResponse,
  ChatMessageDTO,
  MediaKind,
  ReactionEmoji,
  RoomKind,
} from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"
import type { InfiniteData } from "@tanstack/react-query"

const CHAT_PAGE_SIZE = 30

export type ChatHistoryData = InfiniteData<ChatHistoryResponse>

export interface ChatRoomError {
  code: string
  message: string
}

export interface ComposerMedia {
  uploadId: string
  kind: MediaKind
  localUri: string
  posterUri?: string | null
}

export interface ChatPageCursor {
  before?: string
  around?: string
}

export interface ChatRoomEndpoints {
  page: (cursor?: ChatPageCursor) => Promise<ChatHistoryResponse>
  toggleReaction: (messageId: string, emoji: ReactionEmoji) => Promise<ChatMessageDTO>
  deleteMessage: (messageId: string) => Promise<ChatMessageDTO>
}

/** Each room kind has its own history, reaction and delete routes; group reactions use the generic route. */
export function roomEndpoints(api: ApiClient, roomKind: RoomKind, roomId: string): ChatRoomEndpoints {
  return {
    page: (cursor = {}) => {
      if (roomKind === "dm") return api.dmMessages({ threadId: roomId, ...cursor, limit: CHAT_PAGE_SIZE })
      if (roomKind === "report") return api.reportMessages({ id: roomId, ...cursor, limit: CHAT_PAGE_SIZE })
      if (roomKind === "group") return api.groupMessages({ id: roomId, ...cursor, limit: CHAT_PAGE_SIZE })
      return api.cleanupMessages({ cleanupId: roomId, ...cursor, limit: CHAT_PAGE_SIZE })
    },
    toggleReaction: (messageId, emoji) => {
      if (roomKind === "group") return api.toggleMessageReaction({ roomKind: "group", roomId, messageId, emoji })
      if (roomKind === "dm") return api.toggleDmMessageReaction({ threadId: roomId, messageId, emoji })
      if (roomKind === "report") return api.toggleReportMessageReaction({ id: roomId, messageId, emoji })
      return api.toggleCleanupMessageReaction({ cleanupId: roomId, messageId, emoji })
    },
    deleteMessage: (messageId) => {
      if (roomKind === "dm") return api.deleteDmMessage({ threadId: roomId, messageId })
      if (roomKind === "report") return api.deleteReportMessage({ id: roomId, messageId })
      if (roomKind === "group") return api.deleteGroupMessage({ id: roomId, messageId })
      return api.deleteCleanupMessage({ cleanupId: roomId, messageId })
    },
  }
}
