import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  View,
  Pressable,
  ActivityIndicator,
  Animated,
  RefreshControl,
  StyleSheet,
  Platform,
  type AccessibilityActionEvent,
  type PressableStateCallbackType,
  type ViewStyle,
} from "react-native"
import { TextInput } from "../primitives/TextInput"
import type { MessageThreadDTO } from "@civfix/shared"
import { tokens } from "@civfix/shared/tokens"
import {
  FOCUS_RING_OFFSET,
  FOCUS_RING_WIDTH,
  focusRingProps,
  makeThemedStyles,
  space,
  wash,
  useLayoutMode,
  useTheme,
  webHover,
  webInputReset,
  webTransition,
} from "../theme"
import { Text, Icon, iconMap, type IconName } from "../typography"
import {
  ThreadAvatar,
  EmptyState,
  LoadingState,
  PopoverMenu,
  usePopoverAnchor,
  useRefreshControlProps,
  useSwipeActions,
  closeOpenSwipeActions,
} from "../primitives"
import type { PopoverMenuItem, AnchorRect } from "../primitives"
import {
  useThreads,
  useAuthState,
  useRequireAuth,
  useToggleMute,
  useMarkThreadRead,
  useHideConversation,
} from "../data"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { FeedNotice } from "./FeedNotice"
import { HEADER_CONTROL_SIZE } from "./headerControls"
import { HeaderIconButton } from "./HeaderIconButton"
import { HeaderProfileButton } from "./HeaderProfileButton"
import { matchesThreadQuery } from "./messagesListModel"
import { idKeyExtractor, openThread, openNewGroup, openNewChannel } from "./navHelpers"
import { useRowHover } from "./rowHover"
import { isCoarsePointer } from "../shell/webMedia"
import { useTickingListTimeAgo } from "./useListTimeAgo"

type TFn = ReturnType<typeof useT>["t"]

const COMPOSE_MENU_ITEMS: ReadonlyArray<{ key: "message" | "group" | "channel"; icon: IconName; labelKey: string }> = [
  { key: "message", icon: "MessageCircle", labelKey: "new_menu.message" },
  { key: "group", icon: "Users", labelKey: "new_menu.group" },
  { key: "channel", icon: "Megaphone", labelKey: "new_menu.channel" },
]

const MIN_TOUCH_TARGET = 44
const ROW_GUTTER = space["4"]
const ROW_GAP = space["3"]
const ROW_AVATAR = 48
const ROW_PADDING_V = space["3"] + 2
const ROW_MIN_HEIGHT = 80
const SEPARATOR_INSET = ROW_GUTTER + ROW_AVATAR + ROW_GAP
const EMPTY_FILL_MIN_HEIGHT = 300
const CLEAR_BTN_SIZE = 22
const CLEAR_BTN_HIT_SLOP = (MIN_TOUCH_TARGET - CLEAR_BTN_SIZE) / 2
const ROW_MENU_CHIP = 28
const ROW_MENU_GLYPH = 16
const ROW_MENU_SLOT = ROW_MENU_CHIP + space["2"]
const ROW_MENU_HIT_SLOP = (MIN_TOUCH_TARGET - ROW_MENU_CHIP) / 2
const SWIPE_ACTION_GLYPH = 18

const IS_WEB = Platform.OS === "web"

/**
 * The row "More" chip is always mounted on web, because hover alone left keyboard, screen-reader and
 * touch-browser users with no path to mute, mark read or delete (rn-web ignores accessibilityActions).
 * It stays visible on a coarse pointer, where there is no hover to reveal it.
 */
function rowMenuChipShown(state: PressableStateCallbackType, hoveredOrOpen: boolean): boolean {
  if (hoveredOrOpen || isCoarsePointer()) return true
  return (state as PressableStateCallbackType & { focused?: boolean }).focused === true
}
const WEB_ROW_FOCUS_INSET: ViewStyle = IS_WEB
  ? ({ outlineOffset: -(FOCUS_RING_WIDTH + FOCUS_RING_OFFSET) } as unknown as ViewStyle)
  : {}

function InboxHeader({ showCompose }: { showCompose: boolean }) {
  const styles = useStyles()
  const { t } = useT("nav")
  return (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.heading}>
        {t("tab.messages")}
      </Text>
      <View style={styles.headerActions}>
        {showCompose ? <ComposeButton /> : null}
        <HeaderProfileButton />
      </View>
    </View>
  )
}

function ComposeButton() {
  const { t } = useT("messages-list")
  const [open, setOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null)
  const { ref, measure } = usePopoverAnchor(setAnchorRect)

  const items = useMemo<PopoverMenuItem[]>(
    () =>
      COMPOSE_MENU_ITEMS.map((item) => ({
        key: item.key,
        label: t(item.labelKey),
        icon: item.icon,
        onPress: () => {
          if (item.key === "message") useNavStore.getState().push({ kind: "people" })
          else if (item.key === "channel") openNewChannel()
          else openNewGroup()
        },
      })),
    [t],
  )

  return (
    <View>
      <HeaderIconButton
        ref={ref}
        icon="SquarePen"
        label={t("new_menu.a11y")}
        onPress={() => {
          measure()
          setOpen(true)
        }}
      />
      <PopoverMenu visible={open} onClose={() => setOpen(false)} anchorRect={anchorRect} items={items} />
    </View>
  )
}

function InboxSearchField({
  value,
  onChangeText,
}: {
  value: string
  onChangeText: (q: string) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("messages-list")
  const [focused, setFocused] = useState(false)
  return (
    <View style={[styles.searchField, focused ? styles.searchFieldFocused : null]}>
      <Icon icon={iconMap.Search} size={16} color={th.colors.textSubtle} />
      <TextInput
        style={[styles.searchInput, webInputReset]}
        placeholder={t("search.placeholder")}
        placeholderTextColor={th.colors.textSubtle}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={t("search.a11y")}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel={t("search.clear_a11y")}
          hitSlop={CLEAR_BTN_HIT_SLOP}
          {...focusRingProps}
          style={({ pressed }) => [styles.clearBtn, pressed ? styles.clearBtnPressed : null]}
        >
          <Icon icon={iconMap.Close} size={14} color={th.colors.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  )
}

function previewText(thread: MessageThreadDTO, t: TFn): string {
  const body = thread.last?.trim()
  if (!body) return t("preview.new_conversation")
  return thread.lastFromMe ? t("preview.from_me", { text: body }) : body
}

function ThreadSeparator() {
  const styles = useStyles()
  return <View style={styles.separator} />
}

function ThreadRowAction({
  icon,
  label,
  a11yLabel,
  tone,
  onPress,
}: {
  icon: IconName
  label: string
  a11yLabel?: string
  tone: "mute" | "read" | "delete"
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      {...focusRingProps}
      style={({ pressed }) => [
        styles.swipeAction,
        tone === "read"
          ? styles.swipeActionRead
          : tone === "delete"
            ? styles.swipeActionDelete
            : styles.swipeActionMute,
        pressed ? styles.swipeActionPressed : null,
      ]}
    >
      <Icon icon={iconMap[icon]} size={SWIPE_ACTION_GLYPH} color={th.colors.neutral.card} />
      <Text style={styles.swipeActionLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

const ThreadRow = React.memo(function ThreadRow({
  thread,
  onPress,
}: {
  thread: MessageThreadDTO
  onPress: (t: MessageThreadDTO) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("messages-list")
  const timeAgo = useTickingListTimeAgo()
  const { hovered, hoverProps } = useRowHover()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuEverOpened, setMenuEverOpened] = useState(false)
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null)
  const { ref: menuRef, measure } = usePopoverAnchor(setAnchorRect)

  const isGroup = thread.kind === "group" || thread.kind === "cleanup" || thread.kind === "report"
  const isChannel = thread.channel === true
  const unread = thread.unread > 0
  const muted = thread.muted === true
  const roomId = thread.refId ?? thread.id
  const roomKind = thread.kind

  const toggleMute = useToggleMute(roomKind, roomId)
  const markRead = useMarkThreadRead()
  const hideConversation = useHideConversation(roomKind, roomId)
  const swipe = useSwipeActions({ enabled: !IS_WEB, actionCount: unread ? 3 : 2 })
  const closeActions = swipe.close

  const muteLabel = muted ? t("row.action.unmute") : t("row.action.mute")
  const markReadLabel = t("row.action.mark_read")
  const deleteLabel = t("row.action.delete")
  const deleteA11yLabel = t("row.action.delete_a11y")

  const onMute = useCallback(() => {
    closeActions()
    setMenuOpen(false)
    toggleMute.mutate({ muted: !muted })
  }, [closeActions, toggleMute, muted])

  const onMarkRead = useCallback(() => {
    closeActions()
    setMenuOpen(false)
    if (!unread) return
    markRead.mutate({ roomKind, roomId })
  }, [closeActions, markRead, unread, roomKind, roomId])

  const onDelete = useCallback(() => {
    closeActions()
    setMenuOpen(false)
    hideConversation.mutate({ hidden: true })
  }, [closeActions, hideConversation])

  const a11yActions = useMemo(
    () =>
      unread
        ? [
            { name: "mute", label: muteLabel },
            { name: "markRead", label: markReadLabel },
            { name: "delete", label: deleteA11yLabel },
          ]
        : [
            { name: "mute", label: muteLabel },
            { name: "delete", label: deleteA11yLabel },
          ],
    [unread, muteLabel, markReadLabel, deleteA11yLabel],
  )
  const onA11yAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === "markRead") onMarkRead()
      else if (event.nativeEvent.actionName === "mute") onMute()
      else if (event.nativeEvent.actionName === "delete") onDelete()
    },
    [onMarkRead, onMute, onDelete],
  )

  const menuItems = useMemo<PopoverMenuItem[]>(() => {
    const items: PopoverMenuItem[] = [
      { key: "mute", label: muteLabel, icon: muted ? "Bell" : "BellOff", onPress: onMute },
    ]
    if (unread) {
      items.push({ key: "markRead", label: markReadLabel, icon: "CheckCheck", onPress: onMarkRead })
    }
    items.push({
      key: "delete",
      label: deleteLabel,
      icon: "Trash2",
      destructive: true,
      onPress: onDelete,
    })
    return items
  }, [muteLabel, muted, onMute, unread, markReadLabel, onMarkRead, deleteLabel, onDelete])

  const stamp = thread.lastMessageAt ? timeAgo(thread.lastMessageAt) : thread.ago

  const rowContent = (
    <Pressable
      onPress={() => {
        if (swipe.open) {
          closeActions()
          return
        }
        if (closeOpenSwipeActions()) return
        onPress(thread)
      }}
      accessibilityRole="button"
      accessibilityLabel={
        unread
          ? t("row.a11y_unread", { title: thread.title, count: thread.unread })
          : thread.title
      }
      accessibilityActions={a11yActions}
      onAccessibilityAction={onA11yAction}
      {...focusRingProps}
      style={(state) => [
        styles.row,
        WEB_ROW_FOCUS_INSET,
        webTransition,
        hovered ? styles.rowHovered : null,
        state.pressed ? styles.rowPressed : null,
      ]}
    >
      <ThreadAvatar thread={thread} size={ROW_AVATAR} />
      <View style={styles.meta}>
        <View style={styles.topRow}>
          {isChannel ? (
            <View accessible accessibilityLabel={t("row.a11y_channel")}>
              <Icon icon={iconMap.Megaphone} size={13} color={th.colors.textMuted} />
            </View>
          ) : null}
          <Text style={[styles.title, unread ? styles.titleUnread : null]} numberOfLines={1}>
            {thread.title}
          </Text>
          {muted ? (
            <View accessible accessibilityLabel={t("row.a11y_muted")}>
              <Icon icon={iconMap.BellOff} size={13} color={th.colors.textSubtle} />
            </View>
          ) : null}
          {stamp ? <Text style={styles.ago}>{stamp}</Text> : null}
        </View>
        <View style={styles.lastRow}>
          <Text style={[styles.last, unread ? styles.lastUnread : null]} numberOfLines={1}>
            {previewText(thread, t)}
          </Text>
          {unread ? (
            <View style={styles.unread}>
              <Text style={styles.unreadText}>{thread.unread > 99 ? "99+" : thread.unread}</Text>
            </View>
          ) : null}
        </View>
        {isGroup && thread.members > 0 ? (
          <Text style={styles.sub}>
            {isChannel
              ? t("row.subscribers", { count: thread.members })
              : t("row.members", { count: thread.members })}
          </Text>
        ) : null}
      </View>
      {IS_WEB ? <View style={styles.menuSlot} /> : null}
    </Pressable>
  )

  return (
    <View {...hoverProps} style={styles.rowWrap}>
      {swipe.active ? (
        <>
          <Animated.View
            pointerEvents={swipe.open ? "auto" : "none"}
            style={[styles.actionsLayer, { width: swipe.width, opacity: swipe.progress }]}
          >
            <ThreadRowAction
              icon={muted ? "Bell" : "BellOff"}
              label={muteLabel}
              tone="mute"
              onPress={onMute}
            />
            {unread ? (
              <ThreadRowAction
                icon="CheckCheck"
                label={markReadLabel}
                tone="read"
                onPress={onMarkRead}
              />
            ) : null}
            <ThreadRowAction
              icon="Trash2"
              label={deleteLabel}
              a11yLabel={deleteA11yLabel}
              tone="delete"
              onPress={onDelete}
            />
          </Animated.View>
          <Animated.View
            style={[styles.rowShift, { transform: [{ translateX: swipe.translateX }] }]}
            {...swipe.panHandlers}
          >
            {rowContent}
          </Animated.View>
        </>
      ) : (
        rowContent
      )}
      {IS_WEB ? (
        <View style={styles.menuHost}>
          <Pressable
            ref={menuRef}
            onPress={() => {
              measure()
              setMenuEverOpened(true)
              setMenuOpen(true)
            }}
            accessibilityRole="button"
            accessibilityLabel={t("row.action.more")}
            hitSlop={ROW_MENU_HIT_SLOP}
            {...focusRingProps}
            style={(state) => [
              styles.menuChip,
              webTransition,
              rowMenuChipShown(state, hovered || menuOpen) ? null : styles.menuChipConcealed,
              webHover(state) ? styles.menuChipHovered : null,
              state.pressed ? styles.menuChipPressed : null,
            ]}
          >
            <Icon icon={iconMap.Ellipsis} size={ROW_MENU_GLYPH} color={th.colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
      {menuEverOpened ? (
        <PopoverMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          anchorRect={anchorRect}
          items={menuItems}
        />
      ) : null}
    </View>
  )
})

export function MessagingListBody() {
  const styles = useStyles()
  const th = useTheme()
  const refreshSpinner = useRefreshControlProps()
  const { FlatList } = useScrollHost()
  const { t } = useT("messages-list")
  const expanded = useLayoutMode() === "expanded"
  const { isAuthenticated, isPending } = useAuthState()
  const requireAuth = useRequireAuth()
  const query = useThreads()
  const [search, setSearch] = useState("")
  const q = search.trim().toLowerCase()
  const filtering = q.length > 0

  const dismissSwipe = useCallback(() => {
    closeOpenSwipeActions()
  }, [])
  useEffect(
    () => () => {
      closeOpenSwipeActions()
    },
    [],
  )

  const onPressItem = useCallback((thread: MessageThreadDTO) => openThread(thread), [])

  const renderItem = useCallback(
    ({ item }: { item: MessageThreadDTO }) => <ThreadRow thread={item} onPress={onPressItem} />,
    [onPressItem],
  )

  const threads = useMemo(() => (query.data?.pages ?? []).flatMap((p) => p.items), [query.data])
  const visible = useMemo(
    () => (filtering ? threads.filter((thread) => matchesThreadQuery(thread, q)) : threads),
    [threads, filtering, q],
  )

  const { hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query
  const onEndReached = useCallback(() => {
    if (filtering) return
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [filtering, hasNextPage, isFetchingNextPage, fetchNextPage])

  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void Promise.resolve(refetch()).finally(() => setRefreshing(false))
  }, [refetch])
  const refresh = useMemo(
    () => (
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} {...refreshSpinner} />
    ),
    [refreshing, onRefresh, refreshSpinner],
  )

  const showSearch = isAuthenticated && threads.length > 0

  const emptyContent = (() => {
    if (!isAuthenticated && !isPending) {
      return (
        <View style={styles.emptyFill}>
          <FeedNotice
            plain
            icon="MessagesSquare"
            title={t("signed_out.title")}
            link={{
              before: t("signed_out.body_before"),
              label: t("signed_out.body_link"),
              after: t("signed_out.body_after"),
              onPress: () => requireAuth(() => {}, { next: "/messages" }),
            }}
          />
        </View>
      )
    }
    if (isPending || query.isLoading) {
      return (
        <View style={styles.emptyFill}>
          <LoadingState variant="detail" />
        </View>
      )
    }
    if (query.isError) {
      return (
        <View style={styles.emptyFill}>
          <EmptyState
            variant="detail"
            tone="neutral"
            icon={iconMap.CloudOff}
            iconColor={th.colors.textSubtle}
            iconSize={30}
            title={t("error.title")}
            body={t("error.body")}
          />
        </View>
      )
    }
    if (filtering) {
      return (
        <View style={styles.emptyFill}>
          <EmptyState
            variant="detail"
            icon={iconMap.Search}
            title={t("empty.no_match.title")}
            body={t("empty.no_match.body", { query: search.trim() })}
          />
        </View>
      )
    }
    return (
      <View style={styles.emptyFill}>
        <FeedNotice plain icon="MessageCircle" title={t("empty.title")} body={t("empty.body")} />
      </View>
    )
  })()

  return (
    <FlatList
      data={visible}
      keyExtractor={idKeyExtractor}
      style={styles.scroll}
      contentContainerStyle={[styles.content, expanded ? styles.contentExpanded : null]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onScrollBeginDrag={dismissSwipe}
      onEndReachedThreshold={0.4}
      onEndReached={onEndReached}
      refreshControl={isAuthenticated ? refresh : undefined}
      ListHeaderComponent={
        <View style={styles.headerInset} onTouchStart={dismissSwipe}>
          <InboxHeader showCompose={isAuthenticated} />
          {showSearch ? <InboxSearchField value={search} onChangeText={setSearch} /> : null}
        </View>
      }
      renderItem={renderItem}
      ItemSeparatorComponent={ThreadSeparator}
      ListFooterComponent={
        !filtering && query.isFetchingNextPage ? (
          <View style={styles.footer}>
            <ActivityIndicator color={th.colors.textSubtle} />
          </View>
        ) : null
      }
      ListEmptyComponent={emptyContent}
    />
  )
}

const useStyles = makeThemedStyles((t) => ({
  footer: {
    paddingVertical: t.space["4"],
    alignItems: "center",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
    flexGrow: 1,
  },
  contentExpanded: { paddingTop: 14 },
  emptyFill: {
    flexGrow: 1,
    minHeight: EMPTY_FILL_MIN_HEIGHT,
  },
  headerInset: { paddingHorizontal: ROW_GUTTER },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: HEADER_CONTROL_SIZE,
    marginBottom: t.space["2"],
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  heading: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 32,
    lineHeight: 39,
    letterSpacing: -0.5,
    color: t.colors.text,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: MIN_TOUCH_TARGET,
    marginBottom: t.space["2"],
    paddingHorizontal: 12,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
  },
  searchFieldFocused:
    Platform.OS === "web"
      ? ({ boxShadow: tokens.shadow.ring, borderColor: t.colors.accent } as ViewStyle)
      : { borderColor: t.colors.accent },
  searchInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 14,
    color: t.colors.text,
  },
  clearBtn: {
    width: CLEAR_BTN_SIZE,
    height: CLEAR_BTN_SIZE,
    borderRadius: CLEAR_BTN_SIZE / 2,
    backgroundColor: t.colors.bgAlt,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  clearBtnPressed: {
    backgroundColor: t.colors.border,
  },
  rowWrap: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: t.colors.bg,
  },
  rowShift: {
    backgroundColor: t.colors.bg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: ROW_GAP,
    minHeight: ROW_MIN_HEIGHT,
    paddingVertical: ROW_PADDING_V,
    paddingHorizontal: ROW_GUTTER,
    backgroundColor: t.colors.bg,
  },
  rowHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  rowPressed: {
    backgroundColor: wash(t.colors.borderStrong, 0.35, t),
  },
  actionsLayer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    flexDirection: "row",
  },
  swipeAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: t.space["1"],
  },
  swipeActionMute: {
    backgroundColor: t.colors.textMuted,
  },
  swipeActionRead: {
    backgroundColor: t.colors.accent,
  },
  swipeActionDelete: {
    backgroundColor: t.colors.bloom["600"],
  },
  swipeActionPressed: {
    opacity: 0.85,
  },
  swipeActionLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 10.5,
    color: t.colors.neutral.card,
  },
  menuSlot: {
    width: ROW_MENU_SLOT,
    flexShrink: 0,
  },
  menuHost: {
    position: "absolute",
    right: ROW_GUTTER,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  menuChip: {
    width: ROW_MENU_CHIP,
    height: ROW_MENU_CHIP,
    borderRadius: ROW_MENU_CHIP / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  menuChipConcealed: {
    opacity: 0,
  },
  menuChipHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  menuChipPressed: {
    backgroundColor: t.colors.border,
  },
  separator: {
    marginLeft: SEPARATOR_INSET,
    height: IS_WEB ? 1 : StyleSheet.hairlineWidth,
    backgroundColor: IS_WEB ? wash(t.colors.borderStrong, 0.45, t) : t.colors.borderStrong,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 14.5,
    color: t.colors.text,
  },
  titleUnread: {
    fontFamily: t.fontFamily.bodyBold,
  },
  ago: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },
  lastRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    marginTop: 2,
  },
  last: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: t.colors.textSubtle,
  },
  lastUnread: {
    fontFamily: t.fontFamily.bodySemiBold,
    color: t.colors.text,
  },
  unread: {
    flexShrink: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.brand.bloom,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  unreadText: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 10,
    color: t.colors.onAccent,
  },
  sub: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11,
    color: t.colors.textSubtle,
    marginTop: 3,
  },
}))
