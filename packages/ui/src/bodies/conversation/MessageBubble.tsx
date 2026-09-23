import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, Pressable, StyleSheet, Platform, Animated, Dimensions } from "react-native"
import type { PressableStateCallbackType, ViewProps, ViewStyle } from "react-native"
import { type ChatItem, type ChatMessageDTO, type UserMentionDTO, type ReactionEmoji, type MediaDTO } from "@civfix/shared"
import { useTheme, webCursorPointer, webTransition, webHover, focusRingProps } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import type { LucideIcon } from "../../typography"
import { MessageContextMenu, ReactionChips, ReplyQuote, MediaPreview, PopoverMenu, usePopoverAnchor, useDoubleTap, useSwipeReply, useToast, PollBubble, VerifiedBadge } from "../../primitives"
import type { PopoverMenuItem, AnchorRect, ContextMenuAction } from "../../primitives"
import { buildReactionChipModel } from "../../primitives/reactionChipModel"
import { useClipboard, useOpenExternal, useOpenInternalHref } from "../../capabilities"
import { useLightbox } from "../../lightbox"
import { announce } from "../../announce"
import { useT } from "../../i18n"
import { buildMessageActions, isBlockableAuthor, type MessageActionKey } from "../messageActions"
import { clockTime } from "../relativeTime"
import { appLinkOrigins, mentionLookup, tokenizeChatBody, type ChatBodyToken, type ChatLinkTarget } from "./chatLinks"
import { planChatEmbeds, type CivfixLinkRef } from "./civfixLinks"
import { ChatLinkEmbeds } from "./ChatLinkEmbeds"
import { senderNameColor } from "./conversationModel"
import { useConversationStyles } from "./styles"

export const FLASH_DURATION_MS = 900

function webFocused(state: PressableStateCallbackType): boolean {
  if (Platform.OS !== "web") return false
  return (state as PressableStateCallbackType & { focused?: boolean }).focused === true
}

function actionBtnReveal(shown: boolean): ViewStyle {
  return { opacity: shown ? 1 : 0, pointerEvents: shown ? "auto" : "none" }
}

export interface RenderChatBodyInput {
  body: string
  mentions: UserMentionDTO[] | undefined
  cityHandle?: string | null
  tintStyle: object
  linkOrigins: readonly string[]
  onOpenPerson: (target: { id: string; handle?: string | null }) => void
  onOpenLink: (target: ChatLinkTarget) => void
}

export function chatBodyTokens({
  body,
  mentions,
  cityHandle,
  linkOrigins,
}: Pick<RenderChatBodyInput, "body" | "mentions" | "cityHandle" | "linkOrigins">): ChatBodyToken[] {
  return tokenizeChatBody(body, {
    mentions: mentionLookup(mentions, cityHandle),
    origins: linkOrigins,
  })
}

export function renderChatBody(input: RenderChatBodyInput): React.ReactNode {
  return renderChatTokens(chatBodyTokens(input), input)
}

export function renderChatTokens(
  tokens: readonly ChatBodyToken[],
  { body, tintStyle, onOpenPerson, onOpenLink }: RenderChatBodyInput,
): React.ReactNode {
  if (tokens.length === 1 && tokens[0]?.kind === "text") return body
  return tokens.map((token, i) => {
    if (token.kind === "text") return token.text
    if (token.kind === "mention") {
      const userId = token.userId
      if (userId === null) {
        return (
          <Text key={`m${i}`} style={tintStyle}>
            {token.text}
          </Text>
        )
      }
      return (
        <Text
          key={`m${i}`}
          style={tintStyle}
          accessibilityRole="link"
          onPress={() => onOpenPerson({ id: userId, handle: token.handle })}
        >
          {token.text}
        </Text>
      )
    }
    const target = token.target
    return (
      <Text
        key={`l${i}`}
        style={tintStyle}
        accessibilityRole="link"
        onPress={() => onOpenLink(target)}
      >
        {token.text}
      </Text>
    )
  })
}

export const BubbleAttachments = React.memo(function BubbleAttachments({
  attachments,
  mine,
  onReportPhoto,
  onLongPress,
}: {
  attachments: MediaDTO[] | null | undefined
  mine: boolean
  onReportPhoto?: (mediaId: string) => void
  onLongPress?: () => void
}) {
  const styles = useConversationStyles()
  const th = useTheme()
  const { open } = useLightbox()
  const { t } = useT("conversation")
  if (!attachments || attachments.length === 0) return null
  const lightboxItems = attachments.map((m) => ({
    url: m.url,
    kind: m.kind === "video" ? ("video" as const) : ("image" as const),
    thumbUrl: m.thumbUrl ?? null,
    width: m.width ?? null,
    height: m.height ?? null,
  }))
  return (
    <View style={[styles.attachments, mine ? styles.attachmentsMine : styles.attachmentsTheirs]}>
      {attachments.map((m, i) => {
        const canReportPhoto = !mine && !!onReportPhoto && m.kind !== "video"
        return (
          <View key={m.id} style={styles.attachmentWrap}>
            <Pressable
              onPress={() => open(lightboxItems, i)}
              onLongPress={onLongPress}
              delayLongPress={300}
              accessibilityRole="button"
              accessibilityLabel={t("attachment.view")}
              {...focusRingProps}
              style={styles.attachmentTap}
            >
              <MediaPreview
                uri={m.url}
                kind={m.kind === "video" ? "video" : "image"}
                posterUri={m.thumbUrl ?? null}
                thumbUri={m.thumbUrl ?? null}
                aspectRatio={4 / 3}
                style={styles.attachment}
              />
            </Pressable>
            {canReportPhoto ? (
              <Pressable
                onPress={() => onReportPhoto?.(m.id)}
                accessibilityRole="button"
                accessibilityLabel={t("attachment.report_photo")}
                hitSlop={6}
                {...focusRingProps}
                style={(state) => [
                  styles.photoReportBtn,
                  webTransition,
                  webCursorPointer,
                  webHover(state) ? styles.photoReportBtnHovered : null,
                  state.pressed ? styles.pressed : null,
                ]}
              >
                <Icon icon={iconMap.Flag} size={13} color={th.colors.onScrim} />
              </Pressable>
            ) : null}
          </View>
        )
      })}
    </View>
  )
})

type FlashShape = "bubble" | "rounded" | "card"

function FlashOverlay({ mine, shape = "bubble" }: { mine: boolean; shape?: FlashShape }) {
  const styles = useConversationStyles()
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const useNative = Platform.OS !== "web"
    const anim = Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 200, useNativeDriver: useNative }),
      Animated.timing(v, { toValue: 0, duration: FLASH_DURATION_MS - 200, useNativeDriver: useNative }),
    ])
    anim.start()
    return () => anim.stop()
  }, [v])
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        shape === "rounded" ? styles.flashOverlayRounded : shape === "card" ? styles.flashOverlayCard : styles.flashOverlayBubble,
        mine ? styles.flashOverlayMine : styles.flashOverlayTheirs,
        { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, mine ? 0.35 : 0.16] }) },
      ]}
    />
  )
}

function SendStatusLine({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const styles = useConversationStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  if (failed) {
    return (
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t("bubble.retry_sending")}
        hitSlop={6}
        {...focusRingProps}
        style={styles.statusLine}
      >
        <Icon icon={iconMap.RefreshCw} size={11} color={th.colors.bloom["600"]} />
        <Text style={[styles.timeText, styles.failedText]}>{t("bubble.failed_retry")}</Text>
      </Pressable>
    )
  }
  return (
    <View style={styles.statusLine}>
      <Icon icon={iconMap.Clock} size={11} color={th.colors.textSubtle} />
      <Text style={styles.timeText}>{t("bubble.sending")}</Text>
    </View>
  )
}

interface MenuModel {
  menuActions: ContextMenuAction[]
  confirmItems: PopoverMenuItem[]
  stopConfirmItems: PopoverMenuItem[]
}

export interface BubbleProps {
  item: ChatItem
  showName: boolean
  groupStart: boolean
  groupEnd: boolean
  isGroup: boolean
  canEdit: boolean
  canDelete: boolean
  canPin?: boolean
  canDeleteOthers?: boolean
  canModeratePoll?: boolean
  canReact: boolean
  canReply: boolean
  canVote: boolean
  onRetry: (clientId: string) => void
  onEdit: (message: ChatMessageDTO) => void
  onReply: (message: ChatMessageDTO) => void
  onDelete: (messageId: string) => void
  onSetPinned?: (messageId: string, pinned: boolean) => void
  onVotePoll?: (messageId: string, optionIdxs: number[]) => void
  onStopPoll?: (messageId: string) => void
  onReport: (messageId: string) => void
  onReportPhoto?: (mediaId: string) => void
  onBlock?: (author: { id: string; name?: string | null }) => void
  onToggleReaction: (messageId: string, emoji: ReactionEmoji) => void
  onOpenPerson: (target: { id: string; handle?: string | null; deleted?: boolean }) => void
  flash?: boolean
  onJumpToMessage?: (messageId: string) => void
  jumpLoading?: boolean
  pinnedOnlyView?: boolean
  onJumpFromPinned?: (messageId: string) => void
}

function bubblePropsEqual(prev: BubbleProps, next: BubbleProps): boolean {
  const a = prev.item
  const b = next.item
  if (
    a !== b &&
    (a.message !== b.message || a.mine !== b.mine || a.pending !== b.pending || a.failed !== b.failed)
  ) {
    return false
  }
  const keys = Object.keys(next) as (keyof BubbleProps)[]
  if (keys.length !== Object.keys(prev).length) return false
  for (const key of keys) {
    if (key === "item") continue
    if (!Object.is(prev[key], next[key])) return false
  }
  return true
}

export const Bubble = React.memo(function Bubble({
  item,
  showName,
  groupStart,
  groupEnd,
  isGroup,
  canEdit,
  canDelete,
  canPin = false,
  canDeleteOthers = false,
  canModeratePoll = false,
  canReact,
  canReply,
  canVote,
  onRetry,
  onEdit,
  onReply,
  onDelete,
  onSetPinned,
  onVotePoll,
  onStopPoll,
  onReport,
  onReportPhoto,
  onBlock,
  onToggleReaction,
  onOpenPerson,
  flash = false,
  onJumpToMessage,
  jumpLoading = false,
  pinnedOnlyView = false,
  onJumpFromPinned,
}: BubbleProps) {
  const styles = useConversationStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  const { t: td } = useT("discussion")
  const { t: tp } = useT("conversation-polls")
  const { message, mine, pending, failed } = item
  const body = message.body ?? ""
  const edited = Boolean(message.editedAt)
  useEffect(() => {
    if (failed) announce(t("bubble.announce_failed"))
  }, [failed, t])
  const wrapGap = groupStart ? styles.bubbleWrapGroupStart : null
  const isWeb = Platform.OS === "web"
  const [hovered, setHovered] = useState(false)
  const [menuMode, setMenuMode] = useState<"closed" | "menu" | "confirm" | "confirm-stop">("closed")
  const [menuEverOpened, setMenuEverOpened] = useState(false)
  const [menuRect, setMenuRect] = useState<AnchorRect | null>(null)
  const { ref: menuAnchorRef, measure: measureMenu } = usePopoverAnchor((rect) => {
    setMenuRect(rect)
    setMenuMode("menu")
  })
  useEffect(() => {
    if (menuMode === "closed") return
    const sub = Dimensions.addEventListener("change", () => setMenuMode("closed"))
    return () => sub.remove()
  }, [menuMode])
  const clipboard = useClipboard()
  const openExternal = useOpenExternal()
  const openInternalHref = useOpenInternalHref()
  const toast = useToast()
  const linkOrigins = appLinkOrigins()
  const onOpenLink = useCallback(
    (target: ChatLinkTarget) => {
      if (target.kind === "internal" && openInternalHref?.open(target.path) === true) return
      if (!openExternal) {
        toast.show(t("bubble.link_failed"), { variant: "error" })
        return
      }
      void openExternal.open(target.url).catch(() => {
        toast.show(t("bubble.link_failed"), { variant: "error" })
      })
    },
    [openInternalHref, openExternal, toast, t],
  )
  const onOpenEmbed = useCallback(
    (ref: CivfixLinkRef) => onOpenLink({ kind: "internal", path: ref.path, url: ref.url }),
    [onOpenLink],
  )
  const bodyTokens = useMemo(
    () =>
      chatBodyTokens({
        body,
        mentions: message.mentions,
        cityHandle: message.cityMention?.handle ?? null,
        linkOrigins,
      }),
    [body, message.mentions, message.cityMention?.handle, linkOrigins],
  )
  const embedPlan = useMemo(() => planChatEmbeds(bodyTokens), [bodyTokens])
  const bare = embedPlan.linkOnly && !message.replyTo
  const openEdit = useCallback(() => {
    if (canEdit && message.id) onEdit(message)
  }, [canEdit, message, onEdit])
  const reactable = canReact && !pending && !failed
  const removed = message.deletedAt != null
  const { onPress: onBubblePress } = useDoubleTap({
    onDoubleTap:
      reactable && message.id ? () => onToggleReaction(message.id, "like") : undefined,
  })

  const quotedId = message.replyTo?.id
  const onQuotePress =
    quotedId && onJumpToMessage ? () => onJumpToMessage(quotedId) : undefined

  const swipe = useSwipeReply({
    enabled:
      canReply && !pending && !failed && !removed && message.kind !== "system" && Boolean(message.id),
    onTrigger: () => onReply(message),
  })

  if (removed && !(mine && (pending || failed))) {
    return (
      <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs, wrapGap]}>
        <View style={styles.tombstoneBubble}>
          <Icon icon={iconMap.Ban} size={13} color={th.colors.textSubtle} />
          <Text style={styles.tombstoneBubbleText}>{t("bubble.removed")}</Text>
        </View>
        {flash ? <FlashOverlay mine={false} shape="rounded" /> : null}
      </View>
    )
  }

  const from = message.from
  const poll = message.kind === "poll" ? message.poll ?? null : null
  const isPoll = poll != null
  const descriptors = buildMessageActions({
    mine,
    isSystem: message.kind === "system",
    isGroupRoom: isGroup,
    pendingOrFailed: pending || failed,
    deleted: removed,
    hasMessageId: Boolean(message.id),
    hasBody: body.length > 0,
    hasClipboard: Boolean(clipboard),
    canEdit,
    canDelete,
    canPin: canPin && Boolean(onSetPinned),
    isPinned: Boolean(message.pinnedAt),
    canDeleteOthers,
    authorBlockable: isBlockableAuthor(from),
    canReply,
    pinnedOnlyView,
    isPoll,
    pollClosed: Boolean(poll?.closed),
    hasVoted: Boolean(poll && poll.myVote.length > 0) && canVote && Boolean(onVotePoll),
    canModeratePoll: canModeratePoll && Boolean(onStopPoll),
  })
  const menuAvailable = descriptors.length > 0 || reactable
  const buildMenuModel = (): MenuModel => {
    const actionLabel: Record<MessageActionKey, string> = {
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
    }
    const actionIcon: Record<MessageActionKey, LucideIcon> = {
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
    const actionPress: Record<MessageActionKey, () => void> = {
      reply: () => onReply(message),
      copy: () => {
        if (!clipboard) return
        void clipboard
          .setString(body)
          .then(() => toast.show(t("context_menu.copied"), { variant: "success" }))
          .catch(() => toast.show(t("context_menu.copy_failed"), { variant: "error" }))
      },
      edit: openEdit,
      pin: () => {
        if (message.id) onSetPinned?.(message.id, true)
      },
      unpin: () => {
        if (message.id) onSetPinned?.(message.id, false)
      },
      jump: () => {
        if (message.id) onJumpFromPinned?.(message.id)
      },
      delete: () => setMenuMode("confirm"),
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
        if (onStopPoll) setMenuMode("confirm-stop")
      },
    }
    return {
      menuActions: descriptors.map((d) => ({
        key: d.key,
        label: actionLabel[d.key],
        icon: actionIcon[d.key],
        destructive: d.destructive,
        onPress: actionPress[d.key],
      })),
      confirmItems: [
        { key: "cancel", label: t("menu.cancel"), onPress: () => {} },
        {
          key: "confirm-delete",
          label: t("menu.delete_message"),
          icon: "Trash2",
          destructive: true,
          onPress: () => {
            if (message.id) onDelete(message.id)
          },
        },
      ],
      stopConfirmItems: [
        { key: "cancel", label: t("menu.cancel"), onPress: () => {} },
        {
          key: "confirm-stop",
          label: tp("stop_confirm"),
          icon: "Lock",
          onPress: () => {
            if (message.id) onStopPoll?.(message.id)
          },
        },
      ],
    }
  }
  const openContextMenu = () => {
    setMenuEverOpened(true)
    const node = menuAnchorRef.current
    if (node && typeof node.measureInWindow === "function") {
      measureMenu()
    } else {
      setMenuRect(null)
      setMenuMode("menu")
    }
  }
  const closeContextMenu = () => setMenuMode((m) => (m === "menu" ? "closed" : m))
  const reactions = message.reactions ?? []
  const rowKey = message.clientId ?? message.id
  const tinted = mine && !bare
  const tintStyle = tinted ? styles.mentionTokenMine : styles.mentionToken
  const bubbleChrome = bare ? styles.bubbleBare : mine ? styles.bubbleMine : styles.bubbleTheirs
  const bodyContent = renderChatTokens(bodyTokens, {
    body,
    mentions: message.mentions,
    tintStyle,
    linkOrigins,
    onOpenPerson,
    onOpenLink,
  })
  const showBodyText = !embedPlan.linkOnly
  const atts = message.attachments ?? []
  const hasBody = body.length > 0
  const emptyRow =
    !hasBody &&
    !isPoll &&
    atts.length === 0 &&
    embedPlan.refs.length === 0 &&
    message.kind !== "system"
  const toggleReaction = (emoji: ReactionEmoji) => onToggleReaction(message.id, emoji)

  const inFlight = mine && (pending || failed)
  const bubbleTint = failed && !bare ? styles.bubbleFailed : null
  const retrySend = () => {
    if (message.clientId) onRetry(message.clientId)
  }

  const bubbleInner = (
    <>
      {message.replyTo ? <ReplyQuote replyTo={message.replyTo} mine={mine} onPress={onQuotePress} loading={jumpLoading} /> : null}
      {isPoll && poll ? (
        <PollBubble
          poll={poll}
          mine={mine}
          disabled={!onVotePoll || !canVote}
          onVote={(idxs) => {
            if (message.id) onVotePoll?.(message.id, idxs)
          }}
        />
      ) : showBodyText ? (
        <Text style={[styles.bubbleBody, mine ? styles.bubbleBodyMine : styles.bubbleBodyTheirs]}>
          {bodyContent}
        </Text>
      ) : null}
      {!isPoll && embedPlan.refs.length > 0 ? (
        <ChatLinkEmbeds
          rowKey={rowKey}
          refs={embedPlan.refs}
          linkOnly={embedPlan.linkOnly}
          linkStyle={tintStyle}
          onOpen={onOpenEmbed}
        />
      ) : null}
      <ReactionChips reactions={reactions} onToggle={toggleReaction} mine={tinted} disabled={!reactable} />
    </>
  )
  const bubbleClone = !menuEverOpened ? null : hasBody ? (
    <View style={[styles.bubble, bubbleChrome, bubbleTint]}>{bubbleInner}</View>
  ) : (
    <BubbleAttachments attachments={atts} mine={mine} />
  )
  const menuReactions = buildReactionChipModel(reactions).map((c) => ({ emoji: c.emoji, mine: c.mine }))
  const webContextMenuProps =
    isWeb && menuAvailable
      ? ({
          onContextMenu: (e: { preventDefault?: () => void }) => {
            e.preventDefault?.()
            openContextMenu()
          },
        } as unknown as Partial<ViewProps>)
      : null

  const rowContent = (
    <>
      {showName && message.from ? (() => {
        const from = message.from
        const name = (
          <Text
            style={[styles.who, from.official ? styles.whoBadged : null, { color: senderNameColor(from.id, th.scheme) }]}
            numberOfLines={1}
            onPress={from.deleted ? undefined : () => onOpenPerson(from)}
            accessibilityRole={from.deleted ? undefined : "button"}
            {...(from.deleted ? null : focusRingProps)}
          >
            {from.name}
          </Text>
        )
        if (!from.official) return name
        return (
          <View style={styles.whoRow}>
            {name}
            <VerifiedBadge size="sm" />
          </View>
        )
      })() : null}
      {message.forwardedToCity ? (
        <View style={styles.forwardPill}>
          <Icon icon={iconMap.Mail} size={12} color={th.colors.brand.moss} />
          <Text style={styles.forwardPillText} numberOfLines={1}>
            {message.cityMention?.name
              ? td("forwarded.named", { name: message.cityMention.name })
              : td("forwarded.generic")}
          </Text>
        </View>
      ) : null}
      <View style={styles.bubbleRow}>
        {emptyRow ? (
          <View style={styles.processingBubble}>
            <Icon icon={iconMap.Image} size={13} color={th.colors.textSubtle} />
            <Text style={styles.processingBubbleText}>{t("bubble.attachment_processing")}</Text>
          </View>
        ) : !hasBody ? null : isWeb ? (
          <View ref={menuAnchorRef} style={[styles.bubble, bubbleChrome, bubbleTint]}>
            {bubbleInner}
            {flash ? <FlashOverlay mine={tinted} shape={bare ? "card" : "bubble"} /> : null}
          </View>
        ) : (
          <Pressable
            ref={menuAnchorRef}
            onPress={onBubblePress}
            onLongPress={menuAvailable ? openContextMenu : undefined}
            delayLongPress={300}
            accessibilityActions={
              menuAvailable ? [{ name: "longpress", label: t("bubble.message_actions") }] : undefined
            }
            onAccessibilityAction={
              menuAvailable
                ? (e) => {
                    if (e.nativeEvent.actionName === "longpress") openContextMenu()
                  }
                : undefined
            }
            {...focusRingProps}
            style={[styles.bubble, bubbleChrome, bubbleTint]}
          >
            {bubbleInner}
            {flash ? <FlashOverlay mine={tinted} shape={bare ? "card" : "bubble"} /> : null}
          </Pressable>
        )}
        {isWeb && menuAvailable ? (
          <>
            {reactable ? (
              <Pressable
                onPress={openContextMenu}
                onHoverIn={() => setHovered(true)}
                onHoverOut={() => setHovered(false)}
                accessibilityRole="button"
                accessibilityLabel={t("context_menu.reactions")}
                hitSlop={6}
                {...focusRingProps}
                style={(state) => [
                  styles.hoverActionBtn,
                  actionBtnReveal(hovered || webFocused(state)),
                  state.pressed ? styles.pressed : null,
                ]}
              >
                <Icon icon={iconMap.SmilePlus} size={14} color={th.colors.textSubtle} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={openContextMenu}
              onHoverIn={() => setHovered(true)}
              onHoverOut={() => setHovered(false)}
              accessibilityRole="button"
              accessibilityLabel={t("bubble.message_actions")}
              accessibilityState={{ expanded: menuMode !== "closed" }}
              hitSlop={6}
              {...focusRingProps}
              style={(state) => [
                styles.hoverActionBtn,
                actionBtnReveal(hovered || webFocused(state)),
                state.pressed ? styles.pressed : null,
              ]}
            >
              <Icon icon={iconMap.Ellipsis} size={15} color={th.colors.textSubtle} />
            </Pressable>
          </>
        ) : null}
      </View>

      <BubbleAttachments
        attachments={atts}
        mine={mine}
        onReportPhoto={onReportPhoto}
        onLongPress={!isWeb && menuAvailable ? openContextMenu : undefined}
      />
      {inFlight ? <SendStatusLine failed={failed} onRetry={retrySend} /> : null}
      {!hasBody ? (
        <ReactionChips reactions={reactions} onToggle={toggleReaction} mine={false} disabled={!reactable} />
      ) : null}
      {flash && !hasBody ? <FlashOverlay mine={false} shape="rounded" /> : null}

      {menuAvailable && menuEverOpened ? (() => {
        const model = buildMenuModel()
        return (
          <>
            <MessageContextMenu
              visible={menuMode === "menu"}
              onClose={closeContextMenu}
              anchor={menuRect}
              bubble={bubbleClone}
              mine={mine}
              reactions={menuReactions}
              onReact={toggleReaction}
              actions={model.menuActions}
              showReactions={reactable}
            />
            <PopoverMenu
              visible={menuMode === "confirm"}
              anchorRect={menuRect}
              onClose={() => setMenuMode("closed")}
              items={model.confirmItems}
            />
            <PopoverMenu
              visible={menuMode === "confirm-stop"}
              anchorRect={menuRect}
              onClose={() => setMenuMode("closed")}
              items={model.stopConfirmItems}
            />
          </>
        )
      })() : null}
      {(groupEnd || edited) && !inFlight ? (
        <View style={styles.metaLine}>
          {groupEnd ? <Text style={styles.timeText}>{clockTime(message.createdAt)}</Text> : null}
          {edited ? <Text style={styles.editedText}>{t("bubble.edited")}</Text> : null}
        </View>
      ) : null}
    </>
  )

  return (
    <View
      ref={hasBody ? undefined : menuAnchorRef}
      style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs, wrapGap]}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      {...webContextMenuProps}
      {...(swipe.active ? swipe.panHandlers : null)}
    >
      {swipe.active ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.swipeReplyHint, { opacity: swipe.progress }]}>
            <Icon icon={iconMap.CornerUpLeft} size={16} color={th.colors.textSubtle} />
          </Animated.View>
          <Animated.View
            style={[
              styles.swipeShift,
              mine ? styles.swipeShiftMine : styles.swipeShiftTheirs,
              { transform: [{ translateX: swipe.translateX }] },
            ]}
          >
            {rowContent}
          </Animated.View>
        </>
      ) : (
        rowContent
      )}
    </View>
  )
}, bubblePropsEqual)

export const DaySeparator = React.memo(function DaySeparator({ label }: { label: string }) {
  const styles = useConversationStyles()
  return (
    <View style={styles.sepRow}>
      <Text style={styles.sepText}>{label}</Text>
    </View>
  )
})
