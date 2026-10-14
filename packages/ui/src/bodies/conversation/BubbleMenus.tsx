import React from "react"
import type { ChatMessageDTO, ReactionEmoji, ReactionSummaryDTO } from "@civfix/shared"
import { iconMap } from "../../typography"
import type { LucideIcon } from "../../typography"
import { MessageContextMenu, PopoverMenu, useToast } from "../../primitives"
import { buildReactionChipModel } from "../../primitives/reactionChipModel"
import { useClipboard } from "../../capabilities"
import { useT } from "../../i18n"
import type { MessageActionDescriptor, MessageActionKey } from "../messageActions"
import { messageMenuModel } from "./messageMenuModel"
import type { BubbleContextMenu } from "./useBubbleContextMenu"

const ACTION_ICON: Record<MessageActionKey, LucideIcon> = {
  reply: iconMap.CornerUpLeft,
  copy: iconMap.Copy,
  edit: iconMap.Pencil,
  pin: iconMap.Pin,
  unpin: iconMap.PinOff,
  jump: iconMap.ArrowRight,
  delete: iconMap.Trash2,
  report: iconMap.Flag,
  block: iconMap.Ban,
  retractVote: iconMap.Close,
  stopPoll: iconMap.Lock,
}

export function BubbleMenus({
  menu,
  descriptors,
  message,
  mine,
  bubbleClone,
  reactions,
  showReactions,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onSetPinned,
  onJumpFromPinned,
  onVotePoll,
  onStopPoll,
  onReport,
  onBlock,
}: {
  menu: BubbleContextMenu
  descriptors: MessageActionDescriptor[]
  message: ChatMessageDTO
  mine: boolean
  bubbleClone: React.ReactNode
  reactions: readonly ReactionSummaryDTO[]
  showReactions: boolean
  onReact: (emoji: ReactionEmoji) => void
  onReply: (message: ChatMessageDTO) => void
  onEdit: () => void
  onDelete: (messageId: string) => void
  onSetPinned?: (messageId: string, pinned: boolean) => void
  onJumpFromPinned?: (messageId: string) => void
  onVotePoll?: (messageId: string, optionIdxs: number[]) => void
  onStopPoll?: (messageId: string) => void
  onReport: (messageId: string) => void
  onBlock?: (author: { id: string; name?: string | null }) => void
}) {
  const { t } = useT("conversation")
  const { t: tp } = useT("conversation-polls")
  const clipboard = useClipboard()
  const toast = useToast()
  const { setMode } = menu
  const from = message.from
  const model = messageMenuModel({
    descriptors,
    labels: {
      reply: t("context_menu.reply"),
      copy: t("context_menu.copy"),
      edit: t("context_menu.edit"),
      pin: t("context_menu.pin"),
      unpin: t("context_menu.unpin"),
      jump: t("pins.jump"),
      delete: t("context_menu.delete"),
      report: t("context_menu.report"),
      block: t("context_menu.block"),
      retractVote: tp("retract"),
      stopPoll: tp("stop"),
    },
    icons: ACTION_ICON,
    press: {
      reply: () => onReply(message),
      copy: () => {
        if (!clipboard) return
        void clipboard
          .setString(message.body ?? "")
          .then(() => toast.show(t("context_menu.copied"), { variant: "success" }))
          .catch(() => toast.show(t("context_menu.copy_failed"), { variant: "error" }))
      },
      edit: onEdit,
      pin: () => {
        if (message.id) onSetPinned?.(message.id, true)
      },
      unpin: () => {
        if (message.id) onSetPinned?.(message.id, false)
      },
      jump: () => {
        if (message.id) onJumpFromPinned?.(message.id)
      },
      delete: () => setMode("confirm"),
      report: () => {
        if (message.id) onReport(message.id)
      },
      block: () => {
        if (from && from.id) onBlock?.({ id: from.id, name: from.name })
      },
      retractVote: () => {
        if (message.id) onVotePoll?.(message.id, [])
      },
      stopPoll: () => {
        if (onStopPoll) setMode("confirm-stop")
      },
    },
    confirm: {
      cancelLabel: t("menu.cancel"),
      deleteLabel: t("menu.delete_message"),
      stopLabel: tp("stop_confirm"),
      onDelete: () => {
        if (message.id) onDelete(message.id)
      },
      onStop: () => {
        if (message.id) onStopPoll?.(message.id)
      },
    },
  })
  const menuReactions = buildReactionChipModel(reactions).map((c) => ({ emoji: c.emoji, mine: c.mine }))
  return (
    <>
      <MessageContextMenu
        visible={menu.mode === "menu"}
        onClose={menu.close}
        anchor={menu.rect}
        bubble={bubbleClone}
        mine={mine}
        reactions={menuReactions}
        onReact={onReact}
        actions={model.menuActions}
        showReactions={showReactions}
      />
      <PopoverMenu
        visible={menu.mode === "confirm"}
        anchorRect={menu.rect}
        onClose={() => setMode("closed")}
        items={model.confirmItems}
      />
      <PopoverMenu
        visible={menu.mode === "confirm-stop"}
        anchorRect={menu.rect}
        onClose={() => setMode("closed")}
        items={model.stopConfirmItems}
      />
    </>
  )
}
