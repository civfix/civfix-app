import { useCallback } from "react"
import { AppError, ErrorCode, type ChatMessageDTO, type ReactionEmoji, type RoomKind } from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"
import { applyVoteLocally } from "../pollVote"
import { toggleReactionBucket } from "../reactions"
import { roomEndpoints } from "./chatRoom"

export interface CreatePollInput {
  question: string
  options: string[]
  allowMultiple: boolean
  anonymous: boolean
}

export interface ChatMessageActionsDeps {
  api: ApiClient
  roomId: string
  roomKind: RoomKind
  findMessage: (messageId: string, includePins?: boolean) => ChatMessageDTO | undefined
  patchMessage: (messageId: string, patch: Partial<ChatMessageDTO>) => void
  reconcile: (message: ChatMessageDTO) => void
}

/**
 * Optimistic edits to existing messages: each patches the message at once, then applies the server's
 * copy, or restores the snapshot and rethrows when the request fails.
 */
export function useChatMessageActions({
  api,
  roomId,
  roomKind,
  findMessage,
  patchMessage,
  reconcile,
}: ChatMessageActionsDeps) {
  const isDm = roomKind === "dm"

  const toggleReaction = useCallback(
    (messageId: string, emoji: ReactionEmoji) => {
      const prior = findMessage(messageId)
      if (!prior) return
      const snapshot: Pick<ChatMessageDTO, "reactions"> = { reactions: prior.reactions }

      patchMessage(messageId, { reactions: toggleReactionBucket(prior.reactions, emoji) })

      roomEndpoints(api, roomKind, roomId)
        .toggleReaction(messageId, emoji)
        .then((updated) => {
          if (updated && updated.id === messageId) patchMessage(messageId, { reactions: updated.reactions })
        })
        .catch(() => {
          patchMessage(messageId, snapshot)
        })
    },
    [api, roomId, roomKind, findMessage, patchMessage],
  )

  const edit = useCallback(
    async (messageId: string, rawBody: string, mentionedUserIds?: string[]): Promise<void> => {
      const body = rawBody.trim()
      if (!body) throw new AppError(ErrorCode.VALIDATION, "Message cannot be empty.")

      const prior = findMessage(messageId)
      if (!prior) throw new AppError(ErrorCode.NOT_FOUND, "That message is no longer available.")
      const snapshot = { body: prior.body, editedAt: prior.editedAt }

      patchMessage(messageId, { body, editedAt: new Date().toISOString() })

      try {
        const mentions =
          mentionedUserIds && mentionedUserIds.length > 0 ? { mentionedUserIds } : {}
        const updated = isDm
          ? await api.editDmMessage({ threadId: roomId, messageId, body, ...mentions })
          : await api.editChatMessage({ roomKind, roomId, messageId, body, ...mentions })
        if (updated && updated.id === messageId) patchMessage(messageId, updated)
      } catch (err) {
        patchMessage(messageId, snapshot)
        throw err
      }
    },
    [isDm, api, roomId, roomKind, findMessage, patchMessage],
  )

  const deleteMessage = useCallback(
    async (messageId: string): Promise<void> => {
      const prior = findMessage(messageId)
      if (!prior) throw new AppError(ErrorCode.NOT_FOUND, "That message is no longer available.")
      const snapshot = { body: prior.body, deletedAt: prior.deletedAt }

      patchMessage(messageId, { body: "", deletedAt: new Date().toISOString() })

      try {
        const updated = await roomEndpoints(api, roomKind, roomId).deleteMessage(messageId)
        if (updated && updated.id === messageId) patchMessage(messageId, updated)
      } catch (err) {
        patchMessage(messageId, snapshot)
        throw err
      }
    },
    [api, roomKind, roomId, findMessage, patchMessage],
  )

  const setPinned = useCallback(
    async (messageId: string, pinned: boolean): Promise<void> => {
      const prior = findMessage(messageId, true)
      if (!prior) throw new AppError(ErrorCode.NOT_FOUND, "That message is no longer available.")
      const snapshot: Pick<ChatMessageDTO, "pinnedAt"> = { pinnedAt: prior.pinnedAt ?? null }

      patchMessage(messageId, { pinnedAt: pinned ? new Date().toISOString() : null })

      try {
        const updated = await api.setMessagePinned({ roomKind, roomId, messageId, pinned })
        if (updated && updated.id === messageId) patchMessage(messageId, updated)
      } catch (err) {
        patchMessage(messageId, snapshot)
        throw err
      }
    },
    [api, roomId, roomKind, findMessage, patchMessage],
  )

  const createPoll = useCallback(
    async (input: CreatePollInput): Promise<void> => {
      if (isDm) throw new AppError(ErrorCode.VALIDATION, "Polls are not available in direct messages.")
      const msg = await api.createPoll({
        roomKind: roomKind as "cleanup" | "report" | "group",
        roomId,
        question: input.question,
        options: input.options,
        allowMultiple: input.allowMultiple,
        anonymous: input.anonymous,
      })
      reconcile(msg)
    },
    [api, isDm, roomKind, roomId, reconcile],
  )

  const votePoll = useCallback(
    async (messageId: string, optionIdxs: number[]): Promise<void> => {
      const prior = findMessage(messageId)
      if (!prior || !prior.poll) throw new AppError(ErrorCode.NOT_FOUND, "That poll is no longer available.")
      const snapshot: Pick<ChatMessageDTO, "poll"> = { poll: prior.poll }
      const hadVoted = prior.poll.myVote.length > 0

      patchMessage(messageId, { poll: applyVoteLocally(prior.poll, optionIdxs, hadVoted) })

      try {
        const updated = await api.votePoll({ messageId, optionIdxs })
        if (updated && updated.id === messageId) patchMessage(messageId, updated)
      } catch (err) {
        patchMessage(messageId, snapshot)
        throw err
      }
    },
    [api, findMessage, patchMessage],
  )

  const closePoll = useCallback(
    async (messageId: string): Promise<void> => {
      const updated = await api.closePoll({ messageId })
      if (updated && updated.id === messageId) patchMessage(messageId, updated)
    },
    [api, patchMessage],
  )

  return { toggleReaction, edit, deleteMessage, setPinned, createPoll, votePoll, closePoll }
}
