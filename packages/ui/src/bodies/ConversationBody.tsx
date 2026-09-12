import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { View, Pressable, KeyboardAvoidingView, Platform } from "react-native"
import type { FlatList as RNFlatList, NativeScrollEvent, NativeSyntheticEvent } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import type { PersonDTO, ReactionEmoji, RoomKind } from "@civfix/shared"
import { space, useLayoutMode, useTheme, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { ReportContentSheet, PinnedBar, SystemMessageRow, useToast, usePopoverAnchor } from "../primitives"
import type { AnchorRect, PollCreateInput } from "../primitives"
import { canPinIn, canDeleteOthersIn } from "./chatPowers"
import { resolveChannelComposerMode, resolveGroupInfoGate, type ChannelComposerMode } from "./channelComposerMode"
import { resolveMentionSource, type MentionSource } from "./mentionSource"
import { useChat, useBlockUser, useReportContent, useCleanup, useCleanupAttendees, useAuthState, useReport, useJoinReportChat, useLeaveReportChat, useToggleMute, useGroupInfo, useGroupMembers, useJoinGroup } from "../data"
import type { ContentReportReason, ContentReportSubject } from "@civfix/shared"
import type { UseChatResult } from "../data"
import { cleanupHostStanding, hasHostCapability } from "../data/hooks/host"
import { useNavStore } from "../nav"
import { useLocale, useT } from "../i18n"
import { useScrollHost } from "../shell/ScrollHost"
import { useKeyboardVisible } from "../shell/useKeyboardVisible"
import { useKeyboardReserve } from "../shell/useKeyboardReserve"
import { DETAIL_BACK_ICON_SIZE } from "../shell/detailHeader"
import { idKeyExtractor, openPinnedMessages, openGroupInfo, clearThreadJumpParam } from "./navHelpers"
import { todayKey, withinEditWindow, type DayLabelOptions } from "./relativeTime"
import { ConvoBar, ConvoOverflowMenu, BlockConfirmCard } from "./conversation/ConvoBar"
import { Bubble, DaySeparator } from "./conversation/MessageBubble"
import { TypingBubble } from "./conversation/TypingBubble"
import { ConversationComposer, ChannelPillBar } from "./conversation/ConversationComposer"
import { buildRenderItems, roomErrorCopy, transientErrorCopyKey, getScrollableNode, senderColor, typingNames, useConvoMeta, type ConvoMeta, type RenderItem } from "./conversation/conversationModel"
import { convoHeaderTargets } from "./conversation/headerTargets"
import { useComposerMode } from "./conversation/useComposerMode"
import { canReactIn, canReplyIn, canVoteIn } from "./conversation/liveGates"
import { aroundWindowState } from "./conversation/aroundWindowState"
import { useJumpToMessage } from "./conversation/useJumpToMessage"
import { usePinCycle } from "./conversation/usePinCycle"
import { useConversationStyles } from "./conversation/styles"

export { Bubble, DaySeparator } from "./conversation/MessageBubble"
export { TypingBubble } from "./conversation/TypingBubble"
export { buildRenderItems, senderColor, typingNames } from "./conversation/conversationModel"
export type { RenderItem } from "./conversation/conversationModel"

export interface ConversationBodyProps {
  id: string
  roomKind: RoomKind
  peer?: PersonDTO
  fullScreen?: boolean
  onBack?: () => void
  onOpenProfile?: (peerId: string) => void
  onOpenMembers?: () => void
  onOpenGroupInfo?: () => void
  onViewReport?: () => void
  onOpenPinnedList?: () => void
  pinnedOnly?: boolean
  onJumpFromPinned?: (messageId: string) => void
  jumpToMessageId?: string
}

export function ConversationBody({ id, roomKind, peer, fullScreen = false, onBack: onBackProp, onOpenProfile: onOpenProfileProp, onOpenMembers: onOpenMembersProp, onOpenGroupInfo: onOpenGroupInfoProp, onViewReport: onViewReportProp, onOpenPinnedList, pinnedOnly = false, onJumpFromPinned, jumpToMessageId }: ConversationBodyProps) {
  const styles = useConversationStyles()
  const th = useTheme()
  const { FlatList } = useScrollHost()
  const { t } = useT("conversation")
  const { t: tPolls } = useT("conversation-polls")
  const { t: tDate } = useT("common-datetime")
  const { locale } = useLocale()
  const now = todayKey()
  const chat: UseChatResult = useChat(id, roomKind, pinnedOnly ? SUPPRESS_READ_ACKS : undefined)
  const chatRef = useRef(chat)
  chatRef.current = chat
  const [blockTarget, setBlockTarget] = useState<{ id: string; name: string; isDm: boolean } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuRect, setMenuRect] = useState<AnchorRect | null>(null)
  const { ref: menuAnchorRef, measure: measureMenu } = usePopoverAnchor(
    useCallback((rect: AnchorRect) => {
      setMenuRect(rect)
      setMenuOpen(true)
    }, []),
  )
  const listRef = useRef<RNFlatList<RenderItem> | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [hasNewBelow, setHasNewBelow] = useState(false)
  const savedDistanceRef = useRef<number | null>(null)
  const [reportTarget, setReportTarget] = useState<{
    subjectType: ContentReportSubject
    subjectId: string
    label: string
  } | null>(null)
  const reportContent = useReportContent()
  const toast = useToast()

  const [pollCreatePending, setPollCreatePending] = useState(false)
  const [pollCreateError, setPollCreateError] = useState<string | null>(null)
  const onCreatePoll = useCallback(
    async (input: PollCreateInput): Promise<boolean> => {
      setPollCreatePending(true)
      setPollCreateError(null)
      try {
        await chat.createPoll(input)
        return true
      } catch {
        setPollCreateError(tPolls("create_error"))
        return false
      } finally {
        setPollCreatePending(false)
      }
    },
    [chat.createPoll, tPolls],
  )
  const onVotePoll = useCallback(
    (messageId: string, optionIdxs: number[]) => {
      void chat.votePoll(messageId, optionIdxs).catch(() => toast.show(tPolls("vote_error"), { variant: "error" }))
    },
    [chat.votePoll, toast, tPolls],
  )
  const onStopPoll = useCallback(
    (messageId: string) => {
      void chat.closePoll(messageId).catch(() => toast.show(tPolls("stop_error"), { variant: "error" }))
    },
    [chat.closePoll, toast, tPolls],
  )

  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 }
  const keyboardVisible = useKeyboardVisible()
  const mode = useLayoutMode()
  const kbReserve = useKeyboardReserve()

  const meta = useConvoMeta(id, roomKind, peer, chat.items)
  const isReport = meta.kind === "report"
  const isGroup = meta.kind === "group" || meta.kind === "cleanup" || isReport
  const isDm = meta.kind === "dm"

  const report = useReport(isReport ? id : undefined)
  const reportLoaded = report.data != null
  const joined = report.data?.chatJoined
  const showJoinBanner = isReport && reportLoaded && joined === false
  const memberCount = report.data?.chatMemberCount ?? meta.members
  const joinChat = useJoinReportChat()
  const onJoin = useCallback(() => joinChat.mutate(id), [joinChat, id])
  const barMeta = useMemo<ConvoMeta>(
    () => (isReport ? { ...meta, members: memberCount } : meta),
    [isReport, meta, memberCount],
  )

  const authUser = useAuthState().user
  const viewerId = authUser?.id ?? null
  const attendees = useCleanupAttendees(roomKind === "cleanup" ? id : undefined)
  const groupMembersQuery = useGroupMembers(roomKind === "group" ? id : undefined)
  const groupMembersFirstPage = groupMembersQuery.data?.pages[0]?.members
  const mentionSource = useMemo<MentionSource>(
    () =>
      resolveMentionSource({
        roomKind,
        peer,
        attendees: attendees.data?.attendees,
        groupMembers: groupMembersFirstPage?.map((m) => m.user) ?? null,
        viewerId,
        report: report.data,
      }),
    [roomKind, peer, attendees.data, groupMembersFirstPage, viewerId, report.data],
  )

  const cleanup = useCleanup(roomKind === "cleanup" ? id : undefined)
  const groupInfo = useGroupInfo(roomKind === "group" ? id : undefined)
  const powerSignals = useMemo(
    () => ({
      roomKind,
      isDmParticipant: roomKind === "dm",
      canModerateCleanupChat:
        roomKind === "cleanup" &&
        hasHostCapability(cleanupHostStanding(cleanup.data, viewerId), "moderate_chat"),
      isReportChatOwner: isReport && report.data?.mine === true,
      isOperator: authUser?.role === "operator",
      myGroupRole: roomKind === "group" ? groupInfo.data?.myRole ?? null : null,
    }),
    [roomKind, viewerId, cleanup.data, isReport, report.data, authUser?.role, groupInfo.data],
  )
  const canPinHere = canPinIn(powerSignals) && !chat.liveDisabled
  const canDeleteOthers = canDeleteOthersIn(powerSignals) && !chat.liveDisabled
  const canModeratePoll = canDeleteOthers

  const channelMode = resolveChannelComposerMode({
    isGroupRoom: roomKind === "group",
    ...(groupInfo.data?.kind ? { groupKind: groupInfo.data.kind } : {}),
    myRole: groupInfo.data?.myRole ?? null,
    ...(groupInfo.data?.visibility ? { visibility: groupInfo.data.visibility } : {}),
  })
  const composerSlotMode: ChannelComposerMode =
    roomKind === "group" && !groupInfo.data ? "composer" : channelMode
  const canCreatePoll = roomKind !== "dm" && composerSlotMode === "composer"

  const onBack = useCallback(() => (onBackProp ? onBackProp() : useNavStore.getState().back()), [onBackProp])

  const blockUser = useBlockUser()
  const confirmBlock = useCallback(() => {
    const target = blockTarget
    if (!target) return
    blockUser.mutate(target.id, {
      onSuccess: () => {
        setBlockTarget(null)
        if (target.isDm) onBack()
      },
    })
  }, [blockTarget, blockUser, onBack])

  const openProfile = useCallback(() => {
    setMenuOpen(false)
    const peerId = meta.peerId
    if (!peerId) return
    if (onOpenProfileProp) onOpenProfileProp(peerId)
    else useNavStore.getState().push({ kind: "person", id: peer && peer.id === peerId ? (peer.handle ?? peerId) : peerId })
  }, [meta.peerId, onOpenProfileProp, peer])
  const startBlock = useCallback(() => {
    setMenuOpen(false)
    const peerId = meta.peerId
    if (!peerId) return
    setBlockTarget({ id: peerId, name: meta.title, isDm: true })
  }, [meta.peerId, meta.title])

  const onBlockAuthor = useCallback((author: { id: string; name?: string | null }) => {
    setBlockTarget({ id: author.id, name: author.name ?? t("block_confirm.this_person"), isDm: false })
  }, [t])

  const headerTargets = convoHeaderTargets({
    fullScreen,
    hasOpenPinnedList: Boolean(onOpenPinnedList),
    hasOpenMembers: Boolean(onOpenMembersProp),
    hasOpenGroupInfo: Boolean(onOpenGroupInfoProp),
    hasViewReport: Boolean(onViewReportProp),
  })

  const onMembers = useCallback(() => {
    if (onOpenMembersProp) onOpenMembersProp()
    else if (!fullScreen) useNavStore.getState().push({ kind: "members", id, roomKind })
  }, [onOpenMembersProp, fullScreen, id, roomKind])

  const viewReport = useCallback(() => {
    setMenuOpen(false)
    if (onViewReportProp) onViewReportProp()
    else if (!fullScreen) useNavStore.getState().push({ kind: "pin", id })
  }, [onViewReportProp, fullScreen, id])

  const onGroupInfo = useCallback(() => {
    if (onOpenGroupInfoProp) onOpenGroupInfoProp()
    else if (!fullScreen) openGroupInfo(id)
  }, [onOpenGroupInfoProp, fullScreen, id])

  const toggleMute = useToggleMute(roomKind, id)
  const joinGroup = useJoinGroup()
  const onJoinChannel = useCallback(() => {
    if (joinGroup.isPending) return
    joinGroup.mutate(id)
  }, [joinGroup, id])
  const leaveChat = useLeaveReportChat()
  const onToggleMute = useCallback(() => {
    setMenuOpen(false)
    toggleMute.mutate({ muted: !meta.muted })
  }, [toggleMute, meta.muted])
  const onLeaveChat = useCallback(() => {
    setMenuOpen(false)
    leaveChat.mutate(id, { onSuccess: () => onBack() })
  }, [leaveChat, id, onBack])

  const errorBanner = useMemo(() => roomErrorCopy(chat.roomError, meta, t), [chat.roomError, meta, t])

  const transientError = chat.transientError
  const toastedErrorRef = useRef<typeof transientError>(null)
  useEffect(() => {
    if (!transientError || toastedErrorRef.current === transientError) return
    toastedErrorRef.current = transientError
    toast.show(t(transientErrorCopyKey(transientError.code)), { variant: "error" })
  }, [transientError, toast, t])

  const dayLabels = useMemo<DayLabelOptions>(
    () => ({ today: tDate("day.today"), yesterday: tDate("day.yesterday"), locale, now }),
    [tDate, locale, now],
  )

  const inverted = useMemo(
    () => buildRenderItems(chat.items, isGroup, dayLabels).reverse(),
    [chat.items, isGroup, dayLabels],
  )

  const windowState = aroundWindowState(chat.aroundWindow)
  const windowRows = useMemo<RenderItem[] | null>(
    () =>
      windowState === "active" && chat.aroundWindow
        ? buildRenderItems(chat.aroundWindow, isGroup, dayLabels).reverse()
        : null,
    [windowState, chat.aroundWindow, isGroup, dayLabels],
  )
  const windowActive = windowRows !== null

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
    setHasNewBelow(false)
  }, [])

  const memberNames = useMemo(() => {
    const names = new Map<string, string>()
    if (meta.peerId && meta.peerName) names.set(meta.peerId, meta.peerName)
    for (const item of chat.items) {
      const from = item.message.from
      if (from) names.set(from.id, from.name)
    }
    return names
  }, [chat.items, meta.peerId, meta.peerName])

  const typingItem = useMemo<RenderItem | null>(() => {
    if (errorBanner || chat.typingUserIds.length === 0) return null
    const name = isGroup ? typingNames(chat.typingUserIds, memberNames, t) : null
    const color = senderColor(chat.typingUserIds[0] ?? "")
    return { type: "typing", id: "typing", name, color }
  }, [errorBanner, chat.typingUserIds, memberNames, isGroup, t])

  const pins = chat.pins
  const pinnedRows = useMemo<RenderItem[]>(() => {
    if (!pinnedOnly) return []
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
  }, [pinnedOnly, pins, viewerId, isGroup])

  const data = useMemo<RenderItem[]>(
    () => (pinnedOnly ? pinnedRows : (windowRows ?? (typingItem ? [typingItem, ...inverted] : inverted))),
    [pinnedOnly, pinnedRows, windowRows, typingItem, inverted],
  )

  const { flashMessageId, jumpLoadingId, onJumpToMessage, onScrollToIndexFailed } = useJumpToMessage({
    listRef,
    roomId: id,
    data,
    aroundWindow: chat.aroundWindow,
    windowRows,
    fetchAround: chat.fetchAround,
  })
  const { pinIndex, onPinBarTap } = usePinCycle({ pins, roomId: id, roomKind, onJumpToMessage })

  const clearAround = chat.clearAround
  useEffect(() => {
    if (windowState === "dead" && jumpLoadingId === null) clearAround()
  }, [windowState, jumpLoadingId, clearAround])

  const canOpenPinList = headerTargets.pinnedList
  const onOpenPinList = useCallback(() => {
    if (onOpenPinnedList) onOpenPinnedList()
    else if (!fullScreen) openPinnedMessages(id, roomKind)
  }, [onOpenPinnedList, fullScreen, id, roomKind])

  const onSetPinned = useCallback(
    (messageId: string, pinned: boolean) => {
      void chat.setPinned(messageId, pinned).catch(() => {
        toast.show(t("pins.action_failed"), { variant: "error" })
      })
    },
    [chat.setPinned, toast, t],
  )

  const jumpFromPinned = useCallback(
    (messageId: string) => {
      if (onJumpFromPinned) {
        onJumpFromPinned(messageId)
        return
      }
      const nav = useNavStore.getState()
      const stack = nav.stack
      const below = stack.length >= 2 ? stack[stack.length - 2] : undefined
      if (below && below.kind === "thread" && below.id === id) {
        nav.setStack([...stack.slice(0, stack.length - 2), { ...below, jumpToMessageId: messageId }])
      } else {
        nav.setStack([
          ...stack.slice(0, Math.max(0, stack.length - 1)),
          { kind: "thread", id, roomKind, jumpToMessageId: messageId },
        ])
      }
    },
    [onJumpFromPinned, id, roomKind],
  )

  const consumedJumpParamRef = useRef<string | null>(null)
  useEffect(() => {
    if (pinnedOnly || !jumpToMessageId) return
    if (consumedJumpParamRef.current === jumpToMessageId) return
    consumedJumpParamRef.current = jumpToMessageId
    onJumpToMessage(jumpToMessageId)
    clearThreadJumpParam(id)
  }, [pinnedOnly, jumpToMessageId, onJumpToMessage, id])

  const backToLatest = useCallback(() => {
    chat.clearAround()
    setHasNewBelow(false)
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }))
  }, [chat.clearAround])

  const composer = useComposerMode({
    send: chat.send,
    edit: chat.edit,
    sendTyping: chat.sendTyping,
    scrollToBottom,
  })

  const onDeleteMessage = useCallback(
    (messageId: string) => {
      void chat.delete(messageId).catch(() => {
        toast.show(t("menu.delete_failed"), { variant: "error" })
      })
    },
    [chat.delete, toast, t],
  )
  const onRetry = useCallback((clientId: string) => chatRef.current.retry(clientId), [])
  const onReportMessage = useCallback((messageId: string) => {
    reportContent.reset()
    setReportTarget({ subjectType: "message", subjectId: messageId, label: t("report.subject_message") })
  }, [reportContent, t])
  const onReportPhoto = useCallback((mediaId: string) => {
    reportContent.reset()
    setReportTarget({ subjectType: "photo", subjectId: mediaId, label: t("report.subject_photo") })
  }, [reportContent, t])
  const closeReport = useCallback(() => {
    if (reportContent.isPending) return
    setReportTarget(null)
  }, [reportContent.isPending])
  const onSubmitReport = useCallback(
    (reason: ContentReportReason, details?: string) => {
      if (!reportTarget) return
      reportContent.mutate(
        {
          subjectType: reportTarget.subjectType,
          subjectId: reportTarget.subjectId,
          reason,
          ...(details ? { details } : {}),
        },
        {
          onSuccess: () => {
            setReportTarget(null)
            toast.show(t("report.submitted"), { variant: "success" })
          },
        },
      )
    },
    [reportTarget, reportContent, toast, t],
  )

  const onEndReached = useCallback(() => {
    if (pinnedOnly) return
    const c = chatRef.current
    if (c.aroundWindow) return
    if (c.hasMore && !c.isLoadingMore) c.loadOlder()
  }, [pinnedOnly])

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y
    const atBottom = y <= space["10"]
    setIsAtBottom(atBottom)
    if (atBottom) setHasNewBelow(false)
    if (Platform.OS === "web") {
      const node = getScrollableNode(listRef.current)
      if (node) savedDistanceRef.current = node.scrollHeight - node.scrollTop
    }
  }, [])

  const newestId = useMemo(() => {
    const last = chat.items[chat.items.length - 1]
    return last ? { id: last.message.clientId ?? last.message.id, mine: last.mine } : null
  }, [chat.items])
  const prevNewestIdRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevNewestIdRef.current
    prevNewestIdRef.current = newestId?.id ?? null
    if (prev === null) return
    if (newestId && newestId.id !== prev && !newestId.mine && !isAtBottom) {
      setHasNewBelow(true)
    }
  }, [newestId, isAtBottom])

  const oldestId = chat.items.length > 0 ? (chat.items[0]!.message.clientId ?? chat.items[0]!.message.id) : null
  const prevOldestIdRef = useRef<string | null>(oldestId)
  useLayoutEffect(() => {
    if (Platform.OS !== "web") return
    const prev = prevOldestIdRef.current
    prevOldestIdRef.current = oldestId
    if (prev === null || oldestId === null || oldestId === prev) return
    const saved = savedDistanceRef.current
    if (saved == null) return
    const raf = requestAnimationFrame(() => {
      const node = getScrollableNode(listRef.current)
      if (node) node.scrollTop = node.scrollHeight - saved
    })
    return () => cancelAnimationFrame(raf)
  }, [oldestId])

  const groupInfoGate = resolveGroupInfoGate({
    isGroupRoom: roomKind === "group",
    hasGroupInfo: groupInfo.data != null,
    isLoading: groupInfo.isLoading,
    isError: groupInfo.isError,
    cachedChannel: meta.channel,
  })
  const composerDisabled = !!errorBanner || showJoinBanner || groupInfoGate !== "open"
  const composerPlaceholder = errorBanner || groupInfoGate === "blocked"
    ? t("composer.placeholder_unavailable")
    : isGroup
      ? t("composer.placeholder_group")
      : t("composer.placeholder_dm", { name: meta.title.replace(/^@/, "").split(" ")[0] ?? "" }).trim()

  const onToggleReaction = useCallback(
    (messageId: string, emoji: ReactionEmoji) => chat.toggleReaction(messageId, emoji),
    [chat.toggleReaction],
  )
  const onOpenPerson = useCallback(
    (target: { id: string; handle?: string | null; deleted?: boolean }) => {
      if (target.deleted) return
      if (onOpenProfileProp) onOpenProfileProp(target.id)
      else useNavStore.getState().push({ kind: "person", id: target.handle ?? target.id })
    },
    [onOpenProfileProp],
  )
  const gateSignals = { liveDisabled: chat.liveDisabled, composerDisabled, composerSlotMode, pinnedOnly }
  const canReact = canReactIn(gateSignals)
  const canReply = canReplyIn(gateSignals)
  const canVote = canVoteIn(gateSignals)

  const renderItem = useCallback(
    ({ item }: { item: RenderItem }) =>
      item.type === "sep" ? (
        <DaySeparator label={item.label} />
      ) : item.type === "typing" ? (
        <TypingBubble name={item.name} color={item.color} />
      ) : item.item.message.kind === "system" ? (
        <SystemMessageRow message={item.item.message} />
      ) : (
        <Bubble
          item={item.item}
          showName={item.showName}
          groupStart={item.groupStart}
          groupEnd={item.groupEnd}
          canEdit={
            !pinnedOnly &&
            item.item.mine &&
            !item.item.pending &&
            !item.item.failed &&
            item.item.message.kind === "text" &&
            withinEditWindow(item.item.message.createdAt)
          }
          canDelete={!pinnedOnly && item.item.mine && !item.item.pending && !item.item.failed}
          canPin={canPinHere}
          canDeleteOthers={!pinnedOnly && canDeleteOthers}
          canModeratePoll={!pinnedOnly && canModeratePoll}
          canReact={canReact}
          canReply={canReply}
          canVote={canVote}
          isGroup={isGroup}
          onRetry={onRetry}
          onEdit={composer.onOpenEdit}
          onReply={composer.onOpenReply}
          onDelete={onDeleteMessage}
          onSetPinned={onSetPinned}
          onVotePoll={pinnedOnly ? undefined : onVotePoll}
          onStopPoll={pinnedOnly ? undefined : onStopPoll}
          onReport={onReportMessage}
          onReportPhoto={onReportPhoto}
          onBlock={onBlockAuthor}
          onToggleReaction={onToggleReaction}
          onOpenPerson={onOpenPerson}
          flash={flashMessageId !== null && item.item.message.id === flashMessageId}
          onJumpToMessage={pinnedOnly ? undefined : onJumpToMessage}
          jumpLoading={jumpLoadingId !== null && item.item.message.replyTo?.id === jumpLoadingId}
          pinnedOnlyView={pinnedOnly}
          onJumpFromPinned={jumpFromPinned}
        />
      ),
    [onRetry, isGroup, composer.onOpenEdit, composer.onOpenReply, onDeleteMessage, onSetPinned, onVotePoll, onStopPoll, canModeratePoll, onReportMessage, onReportPhoto, onBlockAuthor, canReact, canReply, canVote, canPinHere, canDeleteOthers, onToggleReaction, onOpenPerson, flashMessageId, onJumpToMessage, jumpLoadingId, pinnedOnly, jumpFromPinned],
  )

  const slotBottomStyle = fullScreen
    ? {
        paddingBottom: keyboardVisible ? space["3"] : insets.bottom + space["3"],
        marginBottom: kbReserve,
      }
    : kbReserve > 0
      ? { marginBottom: kbReserve }
      : null

  const content = (
    <>
      {chat.isLoading && chat.items.length === 0 ? (
        <View style={styles.center}>
          <Text variant="body" color={th.colors.textMuted}>
            {t("list.loading")}
          </Text>
        </View>
      ) : chat.isError && chat.items.length === 0 && !errorBanner ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Icon icon={iconMap.CloudOff} size={28} color={th.colors.textSubtle} />
          </View>
          <Text variant="title" style={styles.emptyTitle}>
            {t("list.error_title")}
          </Text>
          <Text variant="body" color={th.colors.textMuted} style={styles.emptyBody}>
            {t("list.error_body")}
          </Text>
        </View>
      ) : (
        <View style={styles.listHost}>
          <FlatList
            ref={listRef}
            data={data}
            inverted
            keyExtractor={idKeyExtractor}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
            onScrollToIndexFailed={onScrollToIndexFailed}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            windowSize={11}
            maxToRenderPerBatch={12}
            initialNumToRender={15}
            maintainVisibleContentPosition={MAINTAIN_VISIBLE_CONTENT_POSITION}
            ListEmptyComponent={
              pinnedOnly ? (
                <View style={styles.center}>
                  <View style={styles.emptyIconMoss}>
                    <Icon icon={iconMap.Pin} size={28} color={th.colors.brand.moss} />
                  </View>
                  <Text variant="title" style={styles.emptyTitle}>
                    {t("pins.empty")}
                  </Text>
                </View>
              ) : (
                <View style={styles.center}>
                  <View style={styles.emptyIconMoss}>
                    <Icon icon={iconMap.MessageCircle} size={28} color={th.colors.brand.moss} />
                  </View>
                  <Text variant="title" style={styles.emptyTitle}>
                    {t("list.empty_title")}
                  </Text>
                  <Text variant="body" color={th.colors.textMuted} style={styles.emptyBody}>
                    {isGroup ? t("list.empty_body_group") : t("list.empty_body_dm")}
                  </Text>
                </View>
              )
            }
          />
          {pinnedOnly ? null : windowActive ? (
            <Pressable
              onPress={backToLatest}
              accessibilityRole="button"
              accessibilityLabel={t("jump.back_to_latest")}
              {...focusRingProps}
              style={({ pressed }) => [styles.newPill, pressed ? styles.pressed : null]}
            >
              <Icon icon={iconMap.ArrowDown} size={14} color={th.colors.onAccent} />
              <Text style={styles.newPillText}>{t("jump.back_to_latest")}</Text>
            </Pressable>
          ) : hasNewBelow ? (
            <Pressable
              onPress={scrollToBottom}
              accessibilityRole="button"
              accessibilityLabel={t("list.jump_to_newest")}
              {...focusRingProps}
              style={({ pressed }) => [styles.newPill, pressed ? styles.pressed : null]}
            >
              <Icon icon={iconMap.ChevronDown} size={14} color={th.colors.onAccent} />
              <Text style={styles.newPillText}>{t("list.new_messages")}</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {pinnedOnly ? null : errorBanner ? (
        <View style={styles.errorRow}>
          <Icon icon={iconMap.AlertCircle} size={15} color={th.colors.bloom["600"]} />
          <Text variant="caption" color={th.colors.bloom["600"]} style={styles.errorText} numberOfLines={2}>
            {errorBanner}
          </Text>
        </View>
      ) : chat.connection !== "open" ? (
        <View style={styles.offlineRow}>
          <Icon icon={iconMap.WifiOff} size={13} color={th.colors.textSubtle} />
          <Text variant="caption" color={th.colors.textSubtle} style={styles.offlineText} numberOfLines={2}>
            {chat.connection === "connecting"
              ? t("connection.reconnecting")
              : t("connection.offline")}
          </Text>
        </View>
      ) : null}

      {showJoinBanner && !pinnedOnly ? (
        <View style={styles.joinBanner}>
          <View style={styles.joinBannerText}>
            <Icon icon={iconMap.MessageCircle} size={16} color={th.colors.brand.moss} />
            <Text variant="caption" color={th.colors.text} style={styles.joinBannerLabel} numberOfLines={2}>
              {t("join.prompt")}
            </Text>
          </View>
          <Pressable
            onPress={onJoin}
            disabled={joinChat.isPending}
            accessibilityRole="button"
            accessibilityLabel={t("join.action")}
            {...focusRingProps}
            style={({ pressed }) => [styles.joinBannerBtn, pressed || joinChat.isPending ? styles.pressed : null]}
          >
            <Text style={styles.joinBannerBtnText}>{t("join.action")}</Text>
          </Pressable>
        </View>
      ) : null}

      {pinnedOnly ? null : composerSlotMode === "mute-pill" || composerSlotMode === "join-pill" ? (
        <ChannelPillBar
          mode={composerSlotMode}
          muted={!!meta.muted}
          onToggleMute={onToggleMute}
          mutePending={toggleMute.isPending}
          onJoin={onJoinChannel}
          joinPending={joinGroup.isPending}
          style={slotBottomStyle}
        />
      ) : composerSlotMode === "none" ? null : (
        <ConversationComposer
          composer={composer}
          disabled={composerDisabled}
          placeholder={composerPlaceholder}
          mentionSource={mentionSource}
          canCreatePoll={canCreatePoll}
          onCreatePoll={onCreatePoll}
          pollCreatePending={pollCreatePending}
          pollCreateError={pollCreateError}
          style={slotBottomStyle}
        />
      )}
    </>
  )

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.headerHost,
          mode === "expanded" ? styles.headerHostExpanded : styles.headerHostCompact,
          fullScreen ? { paddingTop: insets.top + space["1"] } : null,
        ]}
      >
        {pinnedOnly ? (
          <View style={styles.convoBar}>
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={t("header.back")}
              hitSlop={8}
              {...focusRingProps}
              style={({ pressed }) => [styles.back, pressed ? styles.backPressed : null]}
            >
              <Icon icon={iconMap.ArrowLeft} size={DETAIL_BACK_ICON_SIZE} color={th.colors.text} />
            </Pressable>
            <View style={styles.convoTitles}>
              <Text
                style={[styles.convoTitle, mode === "expanded" ? styles.convoTitleExpanded : null]}
                numberOfLines={1}
                accessibilityRole="header"
              >
                {t("pins.view_title")}
              </Text>
            </View>
          </View>
        ) : (
          <ConvoBar
            meta={barMeta}
            onlineCount={chat.onlineCount}
            mode={mode}
            onBack={onBack}
            onMenu={
              (isDm && meta.peerId) || isReport
                ? () => (menuOpen ? setMenuOpen(false) : measureMenu())
                : undefined
            }
            menuOpen={menuOpen}
            menuAnchorRef={menuAnchorRef}
            onMembers={isGroup && !isReport && headerTargets.members ? onMembers : undefined}
            onTitlePress={
              isDm && meta.peerId
                ? openProfile
                : roomKind === "group" && headerTargets.groupInfo
                  ? onGroupInfo
                  : (isReport || roomKind === "cleanup") && headerTargets.members
                    ? onMembers
                    : undefined
            }
          />
        )}
        {blockTarget ? (
          <BlockConfirmCard
            name={blockTarget.name}
            isDm={blockTarget.isDm}
            pending={blockUser.isPending}
            onCancel={() => setBlockTarget(null)}
            onConfirm={confirmBlock}
          />
        ) : null}
      </View>

      {pinnedOnly ? null : (
        <PinnedBar
          pins={pins}
          activeIndex={pinIndex}
          onTap={onPinBarTap}
          {...(canOpenPinList ? { onOpenList: onOpenPinList } : {})}
        />
      )}

      {fullScreen ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}

      {(isDm && meta.peerId) || isReport ? (
        <ConvoOverflowMenu
          visible={menuOpen}
          isReport={isReport}
          muted={!!meta.muted}
          anchorRect={menuRect}
          onClose={() => setMenuOpen(false)}
          {...(headerTargets.viewReport ? { onViewReport: viewReport } : {})}
          onToggleMute={onToggleMute}
          onLeaveChat={onLeaveChat}
          onOpenProfile={openProfile}
          onBlock={startBlock}
        />
      ) : null}

      <ReportContentSheet
        visible={reportTarget !== null}
        subjectLabel={reportTarget?.label ?? t("report.subject_message")}
        pending={reportContent.isPending}
        error={reportContent.isError ? t("report.submit_error") : null}
        onSubmit={onSubmitReport}
        onClose={closeReport}
      />
    </View>
  )
}

const SUPPRESS_READ_ACKS = { suppressReadAcks: true } as const

const MAINTAIN_VISIBLE_CONTENT_POSITION = {
  minIndexForVisible: 0,
  autoscrollToTopThreshold: space["10"],
} as const
