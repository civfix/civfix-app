import React from "react"
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native"
import type { PostDTO } from "@civfix/shared"
import { focusRingProps, makeThemedStyles, wash, useLayoutMode, useTheme } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import {
  DETAIL_BACK_SIZE,
  DETAIL_BACK_RADIUS,
  DETAIL_BACK_ICON_SIZE,
  detailTitleStyle,
} from "../shell/detailHeader"
import { usePost, usePostReplies } from "../data/hooks/posts"
import { useAuthState, useRequireAuth } from "../data"
import { useT } from "../i18n"
import { useNavStore, type DetailEntry } from "../nav"
import { pathForEntry } from "../nav"
import { makeKeyboardAwareScrollHost } from "../shell/KeyboardAwareScroll"
import { PLAIN_SCROLL_HOST, ScrollHostProvider, useScrollHost } from "../shell/ScrollHost"
import { SignInPrompt } from "../primitives/StateView"
import { ReplyComposer, type ReplyComposerHandle } from "./thread/ReplyComposer"
import { ThreadChainRow } from "./thread/ThreadChainRow"
import { ThreadEmptyReplies } from "./thread/ThreadEmptyReplies"
import { ThreadFocalPost, ThreadFocalSkeleton } from "./thread/ThreadFocalPost"
import { ThreadReplyRow } from "./thread/ThreadReplyRow"
import {
  THREAD_CHAIN_ROW_MIN_H,
  buildThreadRows,
  type ThreadChildState,
  type ThreadRow,
  type ThreadRowExpansion,
} from "./thread/threadModel"

const KEYBOARD_DISMISS_MODE: "interactive" | "on-drag" =
  Platform.OS === "ios" ? "interactive" : "on-drag"

const THREAD_SCROLL_HOST = makeKeyboardAwareScrollHost(PLAIN_SCROLL_HOST, {
  ownsFocusedInput: false,
  reserveKeyboardPadding: false,
})

const ThreadList = React.forwardRef<unknown, Record<string, unknown>>(function ThreadList(props, ref) {
  const { FlatList } = useScrollHost()
  return <FlatList ref={ref} {...props} />
})

const threadKeyExtractor = (item: unknown) => (item as ThreadRow<PostDTO>).key

function ThreadRepliesSkeleton() {
  const styles = useStyles()
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.skeletonRow}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonContent}>
            <View style={[styles.skeletonBar, styles.skeletonMeta]} />
            <View style={[styles.skeletonBar, styles.skeletonLineFull]} />
            <View style={[styles.skeletonBar, styles.skeletonLineShort]} />
          </View>
        </View>
      ))}
    </View>
  )
}

function ThreadChildQuery({
  parentId,
  onState,
}: {
  parentId: string
  onState: (parentId: string, state: ThreadChildState<PostDTO>) => void
}) {
  const replies = usePostReplies(parentId)
  const items = React.useMemo(
    () => (replies.data?.pages ?? []).flatMap((page) => page.items),
    [replies.data],
  )
  const loading = replies.isLoading
  const hasMore = replies.hasNextPage === true
  React.useEffect(() => {
    onState(parentId, { items, loading, hasMore })
  }, [onState, parentId, items, loading, hasMore])
  return null
}

export function PostThreadBody({
  id,
  onBack,
  onOpenEntry,
}: {
  id: string
  onBack?: () => void
  onOpenEntry?: (entry: DetailEntry) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("home-feed")
  const back = useNavStore((state) => state.back)
  const push = useNavStore((state) => state.push)
  const openEntry = React.useCallback(
    (entry: DetailEntry) => {
      if (onOpenEntry) onOpenEntry(entry)
      else push(entry)
    },
    [onOpenEntry, push],
  )
  const { isAuthenticated } = useAuthState()
  const requireAuth = useRequireAuth()
  const post = usePost(id)
  const replies = usePostReplies(id)
  const parent = usePost(post.data?.replyToId ?? undefined)

  const [rootHeight, setRootHeight] = React.useState(0)
  const expandedChrome = useLayoutMode() === "expanded"
  const [sentReplies, setSentReplies] = React.useState<PostDTO[]>([])

  const [expandedIds, setExpandedIds] = React.useState<readonly string[]>([])

  const [replyTarget, setReplyTarget] = React.useState<PostDTO | null>(null)

  const [childStates, setChildStates] = React.useState<
    Readonly<Record<string, ThreadChildState<PostDTO> | undefined>>
  >({})

  const onChildState = React.useCallback(
    (parentId: string, next: ThreadChildState<PostDTO>) => {
      setChildStates((current) => {
        const prev = current[parentId]
        if (
          prev != null
          && prev.items === next.items
          && prev.loading === next.loading
          && prev.hasMore === next.hasMore
        ) {
          return current
        }
        return { ...current, [parentId]: next }
      })
    },
    [],
  )

  const expandRow = React.useCallback((postId: string) => {
    setExpandedIds((current) => (current.includes(postId) ? current : [...current, postId]))
  }, [])

  const onRowExpand = React.useCallback(
    (postId: string, expansion: ThreadRowExpansion) => {
      if (expansion === "navigate") {
        openEntry({ kind: "post-thread", id: postId })
        return
      }
      if (expansion === "collapse") {
        setExpandedIds((current) => current.filter((entry) => entry !== postId))
        setChildStates((current) => {
          if (current[postId] === undefined) return current
          const next = { ...current }
          delete next[postId]
          return next
        })
        return
      }
      expandRow(postId)
    },
    [openEntry, expandRow],
  )

  const onRowReply = React.useCallback(
    (target: PostDTO) => {
      setReplyTarget(target)
      expandRow(target.id)
      composerRef.current?.focus()
    },
    [expandRow],
  )
  const composerRef = React.useRef<ReplyComposerHandle | null>(null)
  const listRef = React.useRef<{ scrollToEnd?: (options?: { animated?: boolean }) => void } | null>(null)
  const focusComposer = React.useCallback(() => composerRef.current?.focus(), [])
  const onRootLayout = React.useCallback(
    (event: LayoutChangeEvent) => setRootHeight(event.nativeEvent.layout.height),
    [],
  )
  const onClearTarget = React.useCallback(() => setReplyTarget(null), [])
  const onPosted = React.useCallback(
    (created: PostDTO, targetId: string) => {
      setSentReplies((current) => [
        ...current,
        { ...created, replyToId: created.replyToId ?? targetId },
      ])
      if (targetId === id) listRef.current?.scrollToEnd?.({ animated: true })
    },
    [id],
  )

  const fetched = React.useMemo(
    () => (replies.data?.pages ?? []).flatMap((page) => page.items),
    [replies.data],
  )
  const expandedSet = React.useMemo(() => new Set(expandedIds), [expandedIds])
  const rows = React.useMemo(
    () =>
      buildThreadRows<PostDTO>({
        focalId: id,
        focalAuthorId: post.data?.author.id,
        replies: fetched,
        sent: sentReplies,
        expandedIds: expandedSet,
        children: childStates,
      }),
    [id, post.data?.author.id, fetched, sentReplies, expandedSet, childStates],
  )

  const listHeader = React.useMemo(
    () =>
      post.data ? (
        <ThreadFocalPost
          post={post.data}
          parent={parent.data ?? null}
          onFocusComposer={focusComposer}
          onOpenEntry={onOpenEntry}
        />
      ) : (
        <ThreadFocalSkeleton />
      ),
    [post.data, parent.data, focusComposer, onOpenEntry],
  )

  const renderItem = React.useCallback(
    ({ item }: { item: unknown }) => {
      const listRow = item as ThreadRow<PostDTO>
      if (listRow.kind === "show-more") {
        return (
          <ThreadChainRow rail={listRow.rail} hairline={listRow.hairline}>
            <Pressable
              accessibilityRole="button"
              onPress={() => openEntry({ kind: "post-thread", id: listRow.parentId })}
              {...focusRingProps}
              style={({ pressed }) => [styles.chainAction, pressed ? styles.pressed : null]}
            >
              <Text style={styles.chainActionText}>
                {t("thread.show_replies", { count: listRow.remaining })}
              </Text>
            </Pressable>
          </ThreadChainRow>
        )
      }
      if (listRow.kind === "loading") {
        return (
          <ThreadChainRow rail={listRow.rail} hairline={listRow.hairline}>
            <Text style={styles.chainLoading}>{t("thread.loading")}</Text>
          </ThreadChainRow>
        )
      }
      return (
        <ThreadReplyRow
          post={listRow.post}
          rail={listRow.rail}
          depth={listRow.depth}
          hairline={listRow.hairline}
          isOptimistic={listRow.optimistic}
          expansion={listRow.expansion}
          onToggleExpand={onRowExpand}
          onReply={listRow.depth === 1 ? onRowReply : undefined}
          onOpenEntry={onOpenEntry}
        />
      )
    },
    [openEntry, onRowExpand, onRowReply, onOpenEntry, styles, t],
  )

  const hasNextPage = replies.hasNextPage
  const isFetchingNextPage = replies.isFetchingNextPage
  const fetchNextPage = replies.fetchNextPage
  const onEndReached = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const refetchReplies = replies.refetch
  const listFooter = React.useMemo(
    () =>
      isFetchingNextPage ? (
        <Text style={styles.footerText}>{t("thread.loading")}</Text>
      ) : replies.isError ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{t("thread.replies_error")}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refetchReplies()}
            {...focusRingProps}
            style={({ pressed }) => [styles.retryPill, pressed ? styles.pressed : null]}
          >
            <Text style={styles.retryText}>{t("thread.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.footerPad} />
      ),
    [isFetchingNextPage, replies.isError, refetchReplies, styles, t],
  )

  const listEmpty = React.useMemo(
    () =>
      replies.isLoading ? (
        <ThreadRepliesSkeleton />
      ) : post.data && !replies.isError ? (
        <ThreadEmptyReplies />
      ) : null,
    [replies.isLoading, replies.isError, post.data],
  )

  const header = expandedChrome ? (
    <View style={[styles.header, styles.headerPanel]}>
      <Pressable
        onPress={onBack ?? back}
        accessibilityRole="button"
        accessibilityLabel={t("thread.back")}
        hitSlop={6}
        {...focusRingProps}
        style={styles.headerChip}
      >
        <Icon icon={iconMap.ArrowLeft} size={DETAIL_BACK_ICON_SIZE} color={th.colors.text} />
      </Pressable>
      <Text style={styles.headerPanelTitle} numberOfLines={1} accessibilityRole="header">
        {t("thread.title")}
      </Text>
    </View>
  ) : (
    <View style={styles.header}>
      <Pressable
        onPress={onBack ?? back}
        accessibilityRole="button"
        accessibilityLabel={t("thread.back")}
        hitSlop={6}
        {...focusRingProps}
        style={styles.headerButton}
      >
        <Icon icon={iconMap.ArrowLeft} size={21} color={th.colors.text} />
      </Pressable>
      <View pointerEvents="none" style={styles.headerTitleWrap}>
        <Text variant="heading">{t("thread.title")}</Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  )

  if (!isAuthenticated) {
    return (
      <View style={styles.root}>
        {header}
        <SignInPrompt
          icon={iconMap.MessageCircle}
          title={t("thread.signed_out_title")}
          body={t("thread.signed_out_body")}
          variant="detail"
          onSignIn={() => requireAuth(() => undefined, { next: pathForEntry({ kind: "post-thread", id }) })}
        />
      </View>
    )
  }

  if (post.isError) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{t("thread.post_error")}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void post.refetch()}
            {...focusRingProps}
            style={({ pressed }) => [styles.retryPill, pressed ? styles.pressed : null]}
          >
            <Text style={styles.retryText}>{t("thread.retry")}</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.root} onLayout={onRootLayout}>
      {header}
      {expandedIds.map((parentId) => (
        <ThreadChildQuery key={parentId} parentId={parentId} onState={onChildState} />
      ))}
      <ScrollHostProvider value={THREAD_SCROLL_HOST}>
        <ThreadList
          ref={listRef as never}
          style={styles.list}
          data={rows}
          keyExtractor={threadKeyExtractor}
          ListHeaderComponent={listHeader}
          renderItem={renderItem}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={listFooter}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={KEYBOARD_DISMISS_MODE}
          contentContainerStyle={styles.listContent}
          initialNumToRender={8}
          windowSize={7}
        />
      </ScrollHostProvider>
      {post.data ? (
        <ReplyComposer
          ref={composerRef}
          focalPost={post.data}
          replyTarget={replyTarget}
          onClearTarget={onClearTarget}
          rootHeight={rootHeight}
          onPosted={onPosted}
        />
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
  header: {
    minHeight: 52,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: t.space["4"],
    backgroundColor: t.colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -t.space["3"],
  },
  headerPanel: {
    minHeight: 0,
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomColor:
      Platform.OS === "web" ? wash(t.colors.borderStrong, 0.45, t) : t.colors.border,
  },
  headerChip: {
    width: DETAIL_BACK_SIZE,
    height: DETAIL_BACK_SIZE,
    borderRadius: DETAIL_BACK_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  headerPanelTitle: { ...detailTitleStyle(18, t), flex: 1 },
  headerTitleWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  headerSpacer: { width: 44 },
  list: { flex: 1, minHeight: 0 },
  listContent: { flexGrow: 1, paddingBottom: t.space["2"] },
  footerPad: { height: t.space["2"] },
  footerText: {
    paddingVertical: t.space["4"],
    textAlign: "center",
    color: t.colors.textSubtle,
    fontFamily: t.fontFamily.bodyMedium,
  },
  chainAction: {
    minHeight: THREAD_CHAIN_ROW_MIN_H,
    justifyContent: "center",
    marginLeft: -6,
    paddingHorizontal: 6,
    alignSelf: "flex-start",
  },
  chainActionText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
    color: t.colors.accentText,
  },
  chainLoading: {
    minHeight: THREAD_CHAIN_ROW_MIN_H,
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: 13.5,
    lineHeight: THREAD_CHAIN_ROW_MIN_H,
    color: t.colors.textSubtle,
  },
  errorBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["4"],
  },
  errorText: {
    flexShrink: 1,
    color: t.colors.textMuted,
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 19,
  },
  retryPill: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  retryText: {
    color: t.colors.textMuted,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  pressed: { opacity: 0.7 },
  skeletonRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"],
    paddingBottom: t.space["2"],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  skeletonAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.colors.surfaceTint,
  },
  skeletonContent: {
    flex: 1,
    minWidth: 0,
    gap: t.space["1"],
  },
  skeletonBar: {
    borderRadius: 7,
    backgroundColor: t.colors.surfaceTint,
  },
  skeletonMeta: { height: 14, width: 100 },
  skeletonLineFull: { height: 21, width: "100%" },
  skeletonLineShort: { height: 21, width: "55%" },
}))
