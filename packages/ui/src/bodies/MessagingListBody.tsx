import React, { useCallback, useEffect, useMemo, useState } from "react"
import { View, Pressable, ActivityIndicator, RefreshControl, StyleSheet, Platform, type ViewStyle } from "react-native"
import { TextInput } from "../primitives/TextInput"
import type { MessageThreadDTO } from "@civfix/shared"
import { tokens } from "@civfix/shared/tokens"
import { focusRingProps, makeThemedStyles, wash, useLayoutMode, useTheme, webInputReset, MIN_TOUCH_TARGET } from "../theme"
import { Icon, iconMap, Text, type IconName } from "../typography"
import {
  EmptyState,
  LoadingState,
  PopoverMenu,
  usePopoverAnchor,
  useRefreshControlProps,
  closeOpenSwipeActions,
} from "../primitives"
import type { PopoverMenuItem, AnchorRect } from "../primitives"
import { useThreads, useAuthState, useRequireAuth } from "../data"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { FeedNotice } from "./FeedNotice"
import { HEADER_CONTROL_SIZE } from "../primitives/headerControls"
import { HeaderIconButton } from "./HeaderIconButton"
import { HeaderProfileButton } from "./HeaderProfileButton"
import { matchesThreadQuery } from "./messagesListModel"
import { idKeyExtractor } from "../primitives/listKeys"
import { openThread, openNewGroup, openNewChannel } from "../nav/verbs"
import { useCoarsePointer } from "../shell/useCoarsePointer"
import { ThreadRow } from "./inbox/ThreadRow"
import { IS_WEB, ROW_GUTTER, SEPARATOR_INSET } from "./inbox/inboxLayout"

const COMPOSE_MENU_ITEMS: ReadonlyArray<{ key: "message" | "group" | "channel"; icon: IconName; labelKey: string }> = [
  { key: "message", icon: "MessageCircle", labelKey: "new_menu.message" },
  { key: "group", icon: "Users", labelKey: "new_menu.group" },
  { key: "channel", icon: "Megaphone", labelKey: "new_menu.channel" },
]

const EMPTY_FILL_MIN_HEIGHT = 300
const CLEAR_BTN_SIZE = 22
const CLEAR_BTN_HIT_SLOP = (MIN_TOUCH_TARGET - CLEAR_BTN_SIZE) / 2

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

function ThreadSeparator() {
  const styles = useStyles()
  return <View style={styles.separator} />
}

function InboxEmptyState({
  signedOut,
  loading,
  error,
  searchQuery,
  onSignIn,
}: {
  signedOut: boolean
  loading: boolean
  error: boolean
  searchQuery: string | null
  onSignIn: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("messages-list")
  if (signedOut) {
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
            onPress: onSignIn,
          }}
        />
      </View>
    )
  }
  if (loading) {
    return (
      <View style={styles.emptyFill}>
        <LoadingState variant="detail" />
      </View>
    )
  }
  if (error) {
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
  if (searchQuery !== null) {
    return (
      <View style={styles.emptyFill}>
        <EmptyState
          variant="detail"
          icon={iconMap.Search}
          title={t("empty.no_match.title")}
          body={t("empty.no_match.body", { query: searchQuery })}
        />
      </View>
    )
  }
  return (
    <View style={styles.emptyFill}>
      <FeedNotice plain icon="MessageCircle" title={t("empty.title")} body={t("empty.body")} />
    </View>
  )
}

export function MessagingListBody() {
  const styles = useStyles()
  const th = useTheme()
  const refreshSpinner = useRefreshControlProps()
  const { FlatList } = useScrollHost()
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
  const coarsePointer = useCoarsePointer()

  const renderItem = useCallback(
    ({ item }: { item: MessageThreadDTO }) => (
      <ThreadRow thread={item} onPress={onPressItem} coarsePointer={coarsePointer} />
    ),
    [onPressItem, coarsePointer],
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

  const emptyContent = (
    <InboxEmptyState
      signedOut={!isAuthenticated && !isPending}
      loading={isPending || query.isLoading}
      error={query.isError}
      searchQuery={filtering ? search.trim() : null}
      onSignIn={() => requireAuth(() => {}, { next: "/messages" })}
    />
  )

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
    paddingHorizontal: t.space["3"],
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
    fontSize: t.fontSize["14"],
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
  separator: {
    marginLeft: SEPARATOR_INSET,
    height: IS_WEB ? 1 : StyleSheet.hairlineWidth,
    backgroundColor: IS_WEB ? wash(t.colors.borderStrong, 0.45, t) : t.colors.borderStrong,
  },
}))
