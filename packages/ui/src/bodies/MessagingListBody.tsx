import React, { useCallback, useEffect, useMemo, useState } from "react"
import { View, ActivityIndicator, RefreshControl, StyleSheet } from "react-native"
import type { MessageThreadDTO } from "@civfix/shared"
import { makeThemedStyles, wash, useLayoutMode, useTheme } from "../theme"
import { Text, type IconName } from "../typography"
import {
  ListBodyEmpty,
  ListSearchField,
  PopoverMenu,
  usePopoverAnchor,
  useRefreshControlProps,
  closeOpenSwipeActions,
  useListBodyStyles,
  useListEndReached,
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
const SEARCH_FIELD_FLUSH = { marginTop: 0 }

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
  if (loading || error || searchQuery !== null) {
    return (
      <View style={styles.emptyFill}>
        <ListBodyEmpty
          phase={loading ? "loading" : error ? "error" : "noMatch"}
          copy={{
            error: { title: t("error.title"), body: t("error.body") },
            noMatch: {
              title: t("empty.no_match.title"),
              body: t("empty.no_match.body", { query: searchQuery ?? "" }),
            },
          }}
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
  const listStyles = useListBodyStyles()
  const th = useTheme()
  const { t } = useT("messages-list")
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

  const { refetch } = query
  const onEndReached = useListEndReached(query, filtering)

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
      style={listStyles.list}
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
          {showSearch ? (
            <ListSearchField
              value={search}
              onChangeText={setSearch}
              placeholder={t("search.placeholder")}
              a11yLabel={t("search.a11y")}
              clearA11yLabel={t("search.clear_a11y")}
              autoCapitalize="none"
              clearTarget="slop"
              style={SEARCH_FIELD_FLUSH}
            />
          ) : null}
        </View>
      }
      renderItem={renderItem}
      ItemSeparatorComponent={ThreadSeparator}
      ListFooterComponent={
        !filtering && query.isFetchingNextPage ? (
          <View style={listStyles.footerCentered}>
            <ActivityIndicator color={th.colors.textSubtle} />
          </View>
        ) : null
      }
      ListEmptyComponent={emptyContent}
    />
  )
}

const useStyles = makeThemedStyles((t) => ({
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
  separator: {
    marginLeft: SEPARATOR_INSET,
    height: IS_WEB ? 1 : StyleSheet.hairlineWidth,
    backgroundColor: IS_WEB ? wash(t.colors.borderStrong, 0.45, t) : t.colors.borderStrong,
  },
}))
