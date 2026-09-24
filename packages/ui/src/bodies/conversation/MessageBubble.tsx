import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, Pressable, StyleSheet, Platform, Animated } from "react-native"
import type { PressableStateCallbackType, ViewProps, ViewStyle } from "react-native"
import { type ChatItem, type ChatMessageDTO, type UserMentionDTO, type ReactionEmoji } from "@civfix/shared"
import { useTheme, focusRingProps } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { ReactionChips, ReplyQuote, useDoubleTap, useSwipeReply, useToast, PollBubble, VerifiedBadge } from "../../primitives"
import { useClipboard, useOpenExternal, useOpenInternalHref } from "../../capabilities"
import { announce } from "../../announce"
import { useLocale, useT } from "../../i18n"
import { buildMessageActions, isBlockableAuthor } from "../messageActions"
import { clockTime } from "../relativeTime"
import { appLinkOrigins, mentionLookup, tokenizeChatBody, type ChatBodyToken, type ChatLinkTarget } from "./chatLinks"
import { planChatEmbeds, type CivfixLinkRef } from "./civfixLinks"
import { ChatLinkEmbeds } from "./ChatLinkEmbeds"
import { BUBBLE_LONG_PRESS_MS, FLASH_DURATION_MS, senderNameColor } from "./conversationModel"
import { BubbleAttachments } from "./BubbleAttachments"
import { BubbleMenus } from "./BubbleMenus"
import { useBubbleContextMenu } from "./useBubbleContextMenu"
import { useBubbleStyles } from "./bubbleStyles"

const FLASH_IN_MS = 200

function webFocused(state: PressableStateCallbackType): boolean {
  if (Platform.OS !== "web") return false
  return (state as PressableStateCallbackType & { focused?: boolean }).focused === true
}

function actionBtnReveal(shown: boolean): ViewStyle {
  return { opacity: shown ? 1 : 0, pointerEvents: shown ? "auto" : "none" }
}

interface RenderChatBodyInput {
  body: string
  mentions: UserMentionDTO[] | undefined
  cityHandle?: string | null
  tintStyle: object
  linkOrigins: readonly string[]
  onOpenPerson: (target: { id: string; handle?: string | null }) => void
  onOpenLink: (target: ChatLinkTarget) => void
}

function chatBodyTokens({
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

function renderChatTokens(
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

type FlashShape = "bubble" | "rounded" | "card"

function FlashOverlay({ mine, shape = "bubble" }: { mine: boolean; shape?: FlashShape }) {
  const styles = useBubbleStyles()
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const useNative = Platform.OS !== "web"
    const anim = Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: FLASH_IN_MS, useNativeDriver: useNative }),
      Animated.timing(v, { toValue: 0, duration: FLASH_DURATION_MS - FLASH_IN_MS, useNativeDriver: useNative }),
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
  const styles = useBubbleStyles()
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

function SenderName({
  from,
  onOpenPerson,
}: {
  from: NonNullable<ChatMessageDTO["from"]>
  onOpenPerson: BubbleProps["onOpenPerson"]
}) {
  const styles = useBubbleStyles()
  const th = useTheme()
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
}

function TombstonePill() {
  const styles = useBubbleStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  return (
    <View style={styles.mutedPill}>
      <Icon icon={iconMap.Ban} size={13} color={th.colors.textSubtle} />
      <Text style={styles.mutedPillText}>{t("bubble.removed")}</Text>
    </View>
  )
}

function ProcessingPill() {
  const styles = useBubbleStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  return (
    <View style={styles.mutedPill}>
      <Icon icon={iconMap.Image} size={13} color={th.colors.textSubtle} />
      <Text style={styles.mutedPillText}>{t("bubble.attachment_processing")}</Text>
    </View>
  )
}

function BubbleHoverActions({
  reactable,
  menuShown,
  hovered,
  onHoverChange,
  onOpen,
}: {
  reactable: boolean
  menuShown: boolean
  hovered: boolean
  onHoverChange: (hovered: boolean) => void
  onOpen: () => void
}) {
  const styles = useBubbleStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  return (
    <>
      {reactable ? (
        <Pressable
          onPress={onOpen}
          onHoverIn={() => onHoverChange(true)}
          onHoverOut={() => onHoverChange(false)}
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
        onPress={onOpen}
        onHoverIn={() => onHoverChange(true)}
        onHoverOut={() => onHoverChange(false)}
        accessibilityRole="button"
        accessibilityLabel={t("bubble.message_actions")}
        accessibilityState={{ expanded: menuShown }}
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
  )
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
  const styles = useBubbleStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  const { t: td } = useT("discussion")
  const { locale } = useLocale()
  const { message, mine, pending, failed } = item
  const body = message.body ?? ""
  const edited = Boolean(message.editedAt)
  useEffect(() => {
    if (failed) announce(t("bubble.announce_failed"))
  }, [failed, t])
  const wrapGap = groupStart ? styles.bubbleWrapGroupStart : null
  const isWeb = Platform.OS === "web"
  const [hovered, setHovered] = useState(false)
  const menu = useBubbleContextMenu()
  const { anchorRef: menuAnchorRef, open: openContextMenu } = menu
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
        <TombstonePill />
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
  const bubbleClone = !menu.everOpened ? null : hasBody ? (
    <View style={[styles.bubble, bubbleChrome, bubbleTint]}>{bubbleInner}</View>
  ) : (
    <BubbleAttachments attachments={atts} mine={mine} />
  )
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
      {showName && message.from ? <SenderName from={message.from} onOpenPerson={onOpenPerson} /> : null}
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
          <ProcessingPill />
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
            delayLongPress={BUBBLE_LONG_PRESS_MS}
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
          <BubbleHoverActions
            reactable={reactable}
            menuShown={menu.mode !== "closed"}
            hovered={hovered}
            onHoverChange={setHovered}
            onOpen={openContextMenu}
          />
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

      {menuAvailable && menu.everOpened ? (
        <BubbleMenus
          menu={menu}
          descriptors={descriptors}
          message={message}
          mine={mine}
          bubbleClone={bubbleClone}
          reactions={reactions}
          showReactions={reactable}
          onReact={toggleReaction}
          onReply={onReply}
          onEdit={openEdit}
          onDelete={onDelete}
          onSetPinned={onSetPinned}
          onJumpFromPinned={onJumpFromPinned}
          onVotePoll={onVotePoll}
          onStopPoll={onStopPoll}
          onReport={onReport}
          onBlock={onBlock}
        />
      ) : null}
      {(groupEnd || edited) && !inFlight ? (
        <View style={styles.metaLine}>
          {groupEnd ? <Text style={styles.timeText}>{clockTime(message.createdAt, locale)}</Text> : null}
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
  const styles = useBubbleStyles()
  return (
    <View style={styles.sepRow}>
      <Text style={styles.sepText}>{label}</Text>
    </View>
  )
})
