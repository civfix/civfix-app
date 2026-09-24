import { useMemo } from "react"
import { AVATAR_PALETTE, ErrorCode, WsErrorCode, appErrorCode, avatarGradient, type ChatItem, type ChatMessageDTO, type MessageThreadDTO, type PersonDTO, type RoomKind } from "@civfix/shared"
import type { TFunction } from "i18next"
import { useT } from "../../i18n"
import { useThreadForRoom } from "../../data/hooks/chat"
import type { ChatRoomError } from "../../data"
import { dayKey, dayLabel, type DayLabelOptions } from "../relativeTime"
import { colorSchemes, type ColorSchemeName } from "../../theme/schemes"

export const FLASH_DURATION_MS = 900
export const BUBBLE_LONG_PRESS_MS = 300

export interface ConvoMeta {
  kind: MessageThreadDTO["kind"]
  title: string
  members: number
  roomId: string
  muted?: boolean
  channel?: boolean
  peerId?: string
  peerName?: string
  peerAvatarUrl?: string | null
  peerAvatar?: PersonDTO["avatar"]
}

export type RenderItem =
  | { type: "sep"; id: string; label: string }
  | { type: "row"; id: string; item: ChatItem; showName: boolean; groupStart: boolean; groupEnd: boolean }
  | { type: "typing"; id: string; name: string | null; color: string }

export function pinnedRenderRows(pins: readonly ChatMessageDTO[], viewerId: string | null, isGroup: boolean): RenderItem[] {
  return pins.map((m) => {
    const mine = viewerId !== null && m.from?.id === viewerId
    return {
      type: "row" as const,
      id: m.id,
      item: { message: m, mine, pending: false, failed: false },
      showName: isGroup && !mine && m.kind !== "system",
      groupStart: true,
      groupEnd: true,
    }
  })
}

export function typingNames(typingUserIds: string[], names: Map<string, string>, t: TFunction): string {
  if (typingUserIds.length > 2) return t("typing.names_several")
  const labels = typingUserIds.map((id) => names.get(id) ?? t("typing.someone"))
  return labels.length === 1
    ? t("typing.names_one", { name: labels[0] })
    : t("typing.names_two", { first: labels[0], second: labels[1] })
}

export function senderColor(authorId: string): string {
  return avatarGradient(authorId)[0]
}

/** Indexed like AVATAR_PALETTE, whose order the shared avatar module fixes. */
const SENDER_INK = ["bloom", "moss", "sun", "sky", "lilac"] as const

/**
 * The sender name's TEXT colour. The raw brand hue from `senderColor` is under 4.5:1 on paper (WCAG
 * 1.4.3), so text takes the same hue from the AA-validated chip ink ramp for the active scheme.
 */
export function senderNameColor(authorId: string, scheme: ColorSchemeName): string {
  const index = AVATAR_PALETTE.indexOf(avatarGradient(authorId)[0])
  return colorSchemes[scheme].chipInk[SENDER_INK[index] ?? "bloom"]
}

export function getScrollableNode(
  list: { getScrollableNode?: () => unknown } | null,
): { scrollTop: number; scrollHeight: number } | null {
  if (!list || typeof list.getScrollableNode !== "function") return null
  const node = list.getScrollableNode() as { scrollTop?: number; scrollHeight?: number } | null
  return node && typeof node.scrollTop === "number" && typeof node.scrollHeight === "number"
    ? (node as { scrollTop: number; scrollHeight: number })
    : null
}

const TRANSIENT_ERROR_COPY_KEYS: Record<string, string> = {
  [ErrorCode.RATE_LIMITED]: "room_error.rate_limited",
  [WsErrorCode.BLOCKED]: "room_error.blocked",
  [WsErrorCode.CHANNEL_READ_ONLY]: "room_error.read_only",
  [WsErrorCode.REPLY_WRONG_ROOM]: "room_error.reply_unavailable",
  [WsErrorCode.REPLY_DELETED_TARGET]: "room_error.reply_unavailable",
  [WsErrorCode.BAD_FRAME]: "room_error.send_rejected",
  [ErrorCode.VALIDATION]: "room_error.send_rejected",
}

export function transientErrorCopyKey(code: string): string {
  return TRANSIENT_ERROR_COPY_KEYS[code] ?? "room_error.transient"
}

/** The edit-save failure toast. Never the error's own message: AppError text is English-only. */
export function editErrorCopyKey(err: unknown): string {
  return appErrorCode(err) === ErrorCode.NOT_FOUND ? "composer.edit_unavailable" : "composer.save_error"
}

export function roomErrorCopy(error: ChatRoomError | null, meta: ConvoMeta, t: TFunction): string | null {
  if (!error) return null
  switch (error.code) {
    case "FORBIDDEN":
      return meta.kind === "dm"
        ? t("room_error.dm_not_accepting", { name: meta.title })
        : t("room_error.group_no_access")
    case "NOT_FOUND":
      return meta.kind === "dm"
        ? t("room_error.dm_unavailable", { name: meta.title })
        : t("room_error.group_unavailable")
    default:
      return error.message && error.message.length < 160
        ? error.message
        : t("room_error.generic")
  }
}

export function buildRenderItems(
  items: ChatItem[],
  isGroup: boolean,
  dayLabels: DayLabelOptions = {},
): RenderItem[] {
  const rows: RenderItem[] = []
  let lastDay = ""
  let lastAuthor: string | null = null
  for (const item of items) {
    const iso = item.message.createdAt
    const dk = dayKey(iso)
    let dayChanged = false
    if (dk && dk !== lastDay) {
      rows.push({ type: "sep", id: `sep-${dk}`, label: dayLabel(iso, dayLabels) })
      lastDay = dk
      dayChanged = true
      lastAuthor = null
    }
    const author = item.message.from?.id ?? null
    const groupStart = dayChanged || author !== lastAuthor
    const showName = isGroup && !item.mine && groupStart && item.message.kind !== "system"
    rows.push({ type: "row", id: item.message.clientId ?? item.message.id, item, showName, groupStart, groupEnd: false })
    lastAuthor = author
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    if (row.type !== "row") continue
    const next = rows[i + 1]
    row.groupEnd =
      !next ||
      next.type !== "row" ||
      (next.item.message.from?.id ?? null) !== (row.item.message.from?.id ?? null)
  }
  return rows
}

export function useConvoMeta(
  roomId: string,
  roomKind: RoomKind,
  peer: PersonDTO | undefined,
  items: ChatItem[],
): ConvoMeta {
  const match = useThreadForRoom(roomKind, roomId)
  const { t } = useT("conversation")
  return useMemo<ConvoMeta>(() => {
    if (match) {
      return {
        kind: match.kind,
        title: match.title,
        members: match.members,
        roomId,
        muted: match.muted ?? false,
        channel: match.channel === true,
        peerId: match.peer?.id,
        peerName: match.peer?.name,
        peerAvatarUrl: match.peer?.avatarUrl ?? null,
        peerAvatar: match.peer?.avatar ?? null,
      }
    }
    if (roomKind === "dm") {
      const fromItems = items.find((it) => !it.mine)?.message.from
      const p = peer ?? fromItems
      const title = p
        ? p.name.trim() !== ""
          ? p.name
          : p.handle
            ? `@${p.handle}`
            : t("header.direct_message")
        : t("header.direct_message")
      return {
        kind: "dm",
        title,
        members: 0,
        roomId,
        peerId: p?.id,
        peerName: p?.name,
        peerAvatarUrl: p?.avatarUrl ?? null,
        peerAvatar: p?.avatar ?? null,
      }
    }
    if (roomKind === "report") {
      return { kind: "report", title: t("header.report_chat"), members: 0, roomId, muted: false }
    }
    if (roomKind === "group") {
      return { kind: "group", title: t("header.group_chat"), members: 0, roomId }
    }
    return { kind: "cleanup", title: t("header.crew_chat"), members: 0, roomId }
  }, [match, roomKind, peer, items, t, roomId])
}
