import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { View, Pressable } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import type { PersonDTO, RoomKind } from "@civfix/shared"
import { space, useLayoutMode, useTheme, focusRingProps, type LayoutMode } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { ReportContentSheet, PinnedBar, SystemMessageRow, useToast, usePopoverAnchor } from "../primitives"
import type { AnchorRect } from "../primitives"
import { canPinIn, canDeleteOthersIn } from "./chatPowers"
import { resolveChannelComposerMode, resolveGroupInfoGate } from "./channelComposerMode"
import { resolveMentionSource, type MentionSource } from "./mentionSource"
import { useChat, useCleanup, useCleanupAttendees, useAuthState, useReport, useJoinReportChat, useLeaveReportChat, useToggleMute, useGroupInfo, useGroupMembers, useJoinGroup } from "../data"
import type { UseChatResult } from "../data"
import { cleanupHostStanding, hasHostCapability } from "../data/hooks/host"
import { useNavStore } from "../nav"
import { useLocale, useT } from "../i18n"
import { IosKeyboardAvoidingView } from "../shell/IosKeyboardAvoidingView"
import { useScrollHost } from "../shell/ScrollHost"
import { useKeyboardVisible } from "../shell/useKeyboardVisible"
import { useKeyboardReserve } from "../shell/useKeyboardReserve"
import { DETAIL_BACK_ICON_SIZE } from "../shell/detailHeader"
import { idKeyExtractor, clearThreadJumpParam } from "./navHelpers"
import { todayKey, withinEditWindow, type DayLabelOptions } from "./relativeTime"
import { ConvoBar, ConvoOverflowMenu, BlockConfirmCard } from "./conversation/ConvoBar"
import { Bubble, DaySeparator } from "./conversation/MessageBubble"
import { TypingBubble } from "./conversation/TypingBubble"
import { ConversationComposer, ChannelPillBar } from "./conversation/ConversationComposer"
import { buildRenderItems, pinnedRenderRows, roomErrorCopy, transientErrorCopyKey, senderNameColor, typingNames, useConvoMeta, type ConvoMeta, type RenderItem } from "./conversation/conversationModel"
import { convoHeaderTargets } from "./conversation/headerTargets"
import { useComposerMode } from "./conversation/useComposerMode"
import { canReactIn, canReplyIn, canVoteIn } from "./conversation/liveGates"
import { aroundWindowState } from "./conversation/aroundWindowState"
import { useJumpToMessage } from "./conversation/useJumpToMessage"
import { usePinCycle } from "./conversation/usePinCycle"
import { useChatMessageActions } from "./conversation/useChatMessageActions"
import { useConvoReporting } from "./conversation/useConvoReporting"
import { useConvoNavigation } from "./conversation/useConvoNavigation"
import { useConvoBlock } from "./conversation/useConvoBlock"
import { useTranscriptScroll } from "./conversation/useTranscriptScroll"
import { resolveComposerSlot } from "./conversation/composerSlot"
import { useTranscriptStyles } from "./conversation/transcriptStyles"
import { useConvoHeaderStyles } from "./conversation/convoHeaderStyles"
import { ChatEmbedScopeProvider, useOwnChatEmbedScope } from "./conversation/chatEmbedScope"
import { viewportWindowKeys } from "./conversation/embedScheduler"

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

function PinnedOnlyHeader({ mode, onBack }: { mode: LayoutMode; onBack: () => void }) {
  const styles = useConvoHeaderStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  return (
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
  )
}

function TranscriptEmpty({ pinnedOnly, isGroup }: { pinnedOnly: boolean; isGroup: boolean }) {
  const styles = useTranscriptStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  if (pinnedOnly) {
    return (
      <View style={styles.center}>
        <View style={[styles.emptyIcon, styles.emptyIconMoss]}>
          <Icon icon={iconMap.Pin} size={28} color={th.colors.brand.moss} />
        </View>
        <Text variant="title" style={styles.emptyTitle}>
          {t("pins.empty")}
        </Text>
      </View>
    )
  }
  return (
    <View style={styles.center}>
      <View style={[styles.emptyIcon, styles.emptyIconMoss]}>
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

function ConversationStatusRows({
  errorBanner,
  connection,
}: {
  errorBanner: string | null
  connection: UseChatResult["connection"]
}) {
  const styles = useTranscriptStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  if (errorBanner) {
    return (
      <View style={styles.errorRow} accessibilityRole="alert">
        <Icon icon={iconMap.AlertCircle} size={15} color={th.colors.bloom["600"]} />
        <Text variant="caption" color={th.colors.bloom["600"]} style={styles.errorText} numberOfLines={2}>
          {errorBanner}
        </Text>
      </View>
    )
  }
  if (connection === "open") return null
  return (
    <View style={styles.offlineRow} accessibilityLiveRegion="polite">
      <Icon icon={iconMap.WifiOff} size={13} color={th.colors.textSubtle} />
      <Text variant="caption" color={th.colors.textSubtle} style={styles.offlineText} numberOfLines={2}>
        {connection === "connecting" ? t("connection.reconnecting") : t("connection.offline")}
      </Text>
    </View>
  )
}

export function ConversationBody({ id, roomKind, peer, fullScreen = false, onBack: onBackProp, onOpenProfile: onOpenProfileProp, onOpenMembers: onOpenMembersProp, onOpenGroupInfo: onOpenGroupInfoProp, onViewReport: onViewReportProp, onOpenPinnedList, pinnedOnly = false, onJumpFromPinned, jumpToMessageId }: ConversationBodyProps) {
  const styles = useTranscriptStyles()
  const th = useTheme()
  const { FlatList } = useScrollHost()
  const { t } = useT("conversation")
  const { t: tDate } = useT("common-datetime")
  const { t: tComposer } = useT("discussion-composer")
  const { locale } = useLocale()
  const now = todayKey()
  const chat: UseChatResult = useChat(id, roomKind, pinnedOnly ? SUPPRESS_READ_ACKS : undefined)
  const {
    createPoll,
    votePoll,
    closePoll,
    setPinned,
    clearAround,
    delete: deleteMessage,
    toggleReaction,
  } = chat
  const chatRef = useRef(chat)
  useLayoutEffect(() => {
    chatRef.current = chat
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuRect, setMenuRect] = useState<AnchorRect | null>(null)
  const { ref: menuAnchorRef, measure: measureMenu } = usePopoverAnchor(
    useCallback((rect: AnchorRect) => {
      setMenuRect(rect)
      setMenuOpen(true)
    }, []),
  )
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const { listRef, hasNewBelow, scrollToBottom, backToLatest, onScroll } = useTranscriptScroll(chat.items, clearAround)
  const { reportTarget, reportContent, onReportMessage, onReportPhoto, closeReport, onSubmitReport } = useConvoReporting()
  const toast = useToast()
  const { pollCreatePending, pollCreateError, onCreatePoll, onVotePoll, onStopPoll, onSetPinned, onDeleteMessage } =
    useChatMessageActions({ createPoll, votePoll, closePoll, setPinned, deleteMessage })

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

  const onBack = useCallback(() => (onBackProp ? onBackProp() : useNavStore.getState().back()), [onBackProp])

  const { blockTarget, blockPending, confirmBlock, startBlock, onBlockAuthor, cancelBlock } = useConvoBlock({
    peerId: meta.peerId,
    title: meta.title,
    closeMenu,
    onBack,
  })
  const { openProfile, onMembers, viewReport, onGroupInfo, onOpenPinList, jumpFromPinned, onOpenPerson } =
    useConvoNavigation({
      id,
      roomKind,
      peer,
      peerId: meta.peerId,
      fullScreen,
      closeMenu,
      onOpenProfile: onOpenProfileProp,
      onOpenMembers: onOpenMembersProp,
      onOpenGroupInfo: onOpenGroupInfoProp,
      onViewReport: onViewReportProp,
      onOpenPinnedList,
      onJumpFromPinned,
    })

  const headerTargets = convoHeaderTargets({
    fullScreen,
    hasOpenPinnedList: Boolean(onOpenPinnedList),
    hasOpenMembers: Boolean(onOpenMembersProp),
    hasOpenGroupInfo: Boolean(onOpenGroupInfoProp),
    hasViewReport: Boolean(onViewReportProp),
  })

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
    const color = senderNameColor(chat.typingUserIds[0] ?? "", th.scheme)
    return { type: "typing", id: "typing", name, color }
  }, [errorBanner, chat.typingUserIds, memberNames, isGroup, t, th.scheme])

  const pins = chat.pins
  const pinnedRows = useMemo<RenderItem[]>(
    () => (pinnedOnly ? pinnedRenderRows(pins, viewerId, isGroup) : []),
    [pinnedOnly, pins, viewerId, isGroup],
  )

  const data = useMemo<RenderItem[]>(
    () => (pinnedOnly ? pinnedRows : (windowRows ?? (typingItem ? [typingItem, ...inverted] : inverted))),
    [pinnedOnly, pinnedRows, windowRows, typingItem, inverted],
  )
  const dataRef = useRef(data)
  useLayoutEffect(() => {
    dataRef.current = data
  })

  const embedScope = useOwnChatEmbedScope()
  const embedViewport = embedScope.viewport
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: readonly { index: number | null }[] }) => {
      const keys = viewportWindowKeys(dataRef.current, viewableItems)
      if (keys.length > 0) embedViewport.setVisible(keys)
    },
    [embedViewport],
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

  useEffect(() => {
    if (windowState === "dead" && jumpLoadingId === null) clearAround()
  }, [windowState, jumpLoadingId, clearAround])

  const canOpenPinList = headerTargets.pinnedList

  const consumedJumpParamRef = useRef<string | null>(null)
  useEffect(() => {
    if (pinnedOnly || !jumpToMessageId) return
    if (consumedJumpParamRef.current === jumpToMessageId) return
    consumedJumpParamRef.current = jumpToMessageId
    onJumpToMessage(jumpToMessageId)
    clearThreadJumpParam(id)
  }, [pinnedOnly, jumpToMessageId, onJumpToMessage, id])

  const composer = useComposerMode({
    send: chat.send,
    edit: chat.edit,
    sendTyping: chat.sendTyping,
    scrollToBottom,
  })

  const onRetry = useCallback((clientId: string) => chatRef.current.retry(clientId), [])

  const onEndReached = useCallback(() => {
    if (pinnedOnly) return
    const c = chatRef.current
    if (c.aroundWindow) return
    if (c.hasMore && !c.isLoadingMore) c.loadOlder()
  }, [pinnedOnly])

  const groupInfoGate = resolveGroupInfoGate({
    isGroupRoom: roomKind === "group",
    hasGroupInfo: groupInfo.data != null,
    isLoading: groupInfo.isLoading,
    isError: groupInfo.isError,
    cachedChannel: meta.channel,
  })
  const cityMentionCandidate = mentionSource.extraCandidates[0]
  const composerSlot = resolveComposerSlot({
    roomKind,
    channelMode: resolveChannelComposerMode({
      isGroupRoom: roomKind === "group",
      ...(groupInfo.data?.kind ? { groupKind: groupInfo.data.kind } : {}),
      myRole: groupInfo.data?.myRole ?? null,
      ...(groupInfo.data?.visibility ? { visibility: groupInfo.data.visibility } : {}),
    }),
    hasGroupInfo: groupInfo.data != null,
    groupInfoGate,
    hasRoomError: !!errorBanner,
    showJoinBanner,
    isReport,
    isGroup,
    pinnedOnly,
    hasCityMention: cityMentionCandidate != null,
  })
  const composerSlotMode = composerSlot.mode
  const composerDisabled = composerSlot.disabled
  const composerNotice =
    composerSlot.showForwardNotice && cityMentionCandidate
      ? tComposer("forward_disclaimer", {
          mention: `@${cityMentionCandidate.handle}`,
          city: report.data?.cityName ?? tComposer("city_fallback"),
        })
      : undefined
  const composerPlaceholder =
    composerSlot.placeholder === "unavailable"
      ? t("composer.placeholder_unavailable")
      : composerSlot.placeholder === "group"
        ? t("composer.placeholder_group")
        : t("composer.placeholder_dm", { name: meta.title.replace(/^@/, "").split(" ")[0] ?? "" }).trim()

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
          onToggleReaction={toggleReaction}
          onOpenPerson={onOpenPerson}
          flash={flashMessageId !== null && item.item.message.id === flashMessageId}
          onJumpToMessage={pinnedOnly ? undefined : onJumpToMessage}
          jumpLoading={jumpLoadingId !== null && item.item.message.replyTo?.id === jumpLoadingId}
          pinnedOnlyView={pinnedOnly}
          onJumpFromPinned={jumpFromPinned}
        />
      ),
    [onRetry, isGroup, composer.onOpenEdit, composer.onOpenReply, onDeleteMessage, onSetPinned, onVotePoll, onStopPoll, canModeratePoll, onReportMessage, onReportPhoto, onBlockAuthor, canReact, canReply, canVote, canPinHere, canDeleteOthers, toggleReaction, onOpenPerson, flashMessageId, onJumpToMessage, jumpLoadingId, pinnedOnly, jumpFromPinned],
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
    <ChatEmbedScopeProvider value={embedScope}>
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
            viewabilityConfig={EMBED_VIEWABILITY}
            onViewableItemsChanged={onViewableItemsChanged}
            maintainVisibleContentPosition={MAINTAIN_VISIBLE_CONTENT_POSITION}
            ListEmptyComponent={<TranscriptEmpty pinnedOnly={pinnedOnly} isGroup={isGroup} />}
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

      {pinnedOnly ? null : <ConversationStatusRows errorBanner={errorBanner} connection={chat.connection} />}

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
          canCreatePoll={composerSlot.canCreatePoll}
          onCreatePoll={onCreatePoll}
          pollCreatePending={pollCreatePending}
          pollCreateError={pollCreateError}
          notice={composerNotice}
          style={slotBottomStyle}
        />
      )}
    </ChatEmbedScopeProvider>
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
          <PinnedOnlyHeader mode={mode} onBack={onBack} />
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
            pending={blockPending}
            onCancel={cancelBlock}
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
        <IosKeyboardAvoidingView style={styles.flex} keyboardVerticalOffset={0}>
          {content}
        </IosKeyboardAvoidingView>
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

const EMBED_VIEWABILITY = {
  itemVisiblePercentThreshold: 1,
  minimumViewTime: 0,
} as const

const MAINTAIN_VISIBLE_CONTENT_POSITION = {
  minIndexForVisible: 0,
  autoscrollToTopThreshold: space["10"],
} as const
