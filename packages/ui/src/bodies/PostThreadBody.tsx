import React from "react"
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native"
import type { PostDTO } from "@civfix/shared"
import {
  focusRingProps,
  headingLevel,
  makeThemedStyles,
  wash,
  useLayoutMode,
  useTheme,
} from "../theme"
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
import {
  PLAIN_SCROLL_HOST,
  ScrollHostProvider,
  useScrollHost,
  type ScrollHostListHandle,
} from "../shell/ScrollHost"
import { SignInPrompt } from "../primitives/StateView"
import { useViewerDraftGeneration } from "../viewerScope"
import { ReplyComposer, type ReplyComposerHandle } from "./thread/ReplyComposer"
import { ThreadEmptyReplies } from "./thread/ThreadEmptyReplies"
import { ThreadFocalPost, ThreadFocalSkeleton } from "./thread/ThreadFocalPost"
import { ThreadReplyRow } from "./thread/ThreadReplyRow"
import { buildThreadRows, type ThreadRow } from "./thread/threadModel"

const KEYBOARD_DISMISS_MODE: "interactive" | "on-drag" =
  Platform.OS === "ios" ? "interactive" : "on-drag"

const THREAD_SCROLL_HOST = makeKeyboardAwareScrollHost(PLAIN_SCROLL_HOST, {
  ownsFocusedInput: false,
  reserveKeyboardPadding: false,
})

const ThreadList = React.forwardRef<ScrollHostListHandle, Record<string, unknown>>(function ThreadList(
  props,
  ref,
) {
  const { FlatList } = useScrollHost()
  return <FlatList ref={ref} {...props} />
})

const threadKeyExtractor = (item: unknown) => (item as ThreadRow<PostDTO>).key

function ThreadRepliesSkeleton() {
  const styles = useStyles()
  const { t } = useT("home-feed")
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("thread.loading_replies")}
      accessibilityState={{ busy: true }}
    >
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

export interface PostThreadBodyProps {
  id: string
  onBack?: () => void
  onOpenEntry?: (entry: DetailEntry) => void
}

export function PostThreadBody(props: PostThreadBodyProps) {
  return <PostThread key={props.id} {...props} />
}

function PostThread({ id, onBack, onOpenEntry }: PostThreadBodyProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("home-feed")
  const back = useNavStore((state) => state.back)
  const { isAuthenticated } = useAuthState()
  const requireAuth = useRequireAuth()
  const post = usePost(id)
  const replies = usePostReplies(id)
  const parent = usePost(post.data?.replyToId ?? undefined)

  const [rootHeight, setRootHeight] = React.useState(0)
  const expandedChrome = useLayoutMode() === "expanded"
  const [sentReplies, setSentReplies] = React.useState<PostDTO[]>([])

  const composerRef = React.useRef<ReplyComposerHandle | null>(null)
  const draftGeneration = useViewerDraftGeneration()
  const listRef = React.useRef<ScrollHostListHandle | null>(null)
  const focusComposer = React.useCallback(() => composerRef.current?.focus(), [])
  const onRootLayout = React.useCallback(
    (event: LayoutChangeEvent) => setRootHeight(event.nativeEvent.layout.height),
    [],
  )
  const onPosted = React.useCallback(
    (created: PostDTO) => {
      setSentReplies((current) => [...current, { ...created, replyToId: created.replyToId ?? id }])
      listRef.current?.scrollToEnd?.({ animated: true })
    },
    [id],
  )
  const goBack = onBack ?? back
  const onReplyDeleted = React.useCallback(
    (postId: string) => setSentReplies((current) => current.filter((reply) => reply.id !== postId)),
    [],
  )

  const fetched = React.useMemo(
    () => (replies.data?.pages ?? []).flatMap((page) => page.items),
    [replies.data],
  )
  const authorReplies = React.useMemo(
    () => (replies.data?.pages ?? []).flatMap((page) => page.authorReplies),
    [replies.data],
  )
  const rows = React.useMemo(
    () =>
      buildThreadRows<PostDTO>({
        focalId: id,
        replies: fetched,
        sent: sentReplies,
        nested: authorReplies,
      }),
    [id, fetched, sentReplies, authorReplies],
  )

  const listHeader = React.useMemo(
    () =>
      post.data ? (
        <ThreadFocalPost
          post={post.data}
          parent={parent.data ?? null}
          onFocusComposer={focusComposer}
          onOpenEntry={onOpenEntry}
          onDeleted={goBack}
        />
      ) : (
        <ThreadFocalSkeleton />
      ),
    [post.data, parent.data, focusComposer, onOpenEntry, goBack],
  )

  const renderItem = React.useCallback(
    ({ item }: { item: unknown }) => {
      const listRow = item as ThreadRow<PostDTO>
      return (
        <ThreadReplyRow
          post={listRow.post}
          rail={listRow.rail}
          hairline={listRow.hairline}
          isOptimistic={listRow.optimistic}
          onOpenEntry={onOpenEntry}
          onDeleted={onReplyDeleted}
        />
      )
    },
    [onOpenEntry, onReplyDeleted],
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
        onPress={goBack}
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
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel={t("thread.back")}
        hitSlop={6}
        {...focusRingProps}
        style={styles.headerButton}
      >
        <Icon icon={iconMap.ArrowLeft} size={21} color={th.colors.text} />
      </Pressable>
      <View pointerEvents="none" style={styles.headerTitleWrap}>
        <Text variant="heading" accessibilityRole="header" {...headingLevel(1)}>
          {t("thread.title")}
        </Text>
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
      <ScrollHostProvider value={THREAD_SCROLL_HOST}>
        <ThreadList
          ref={listRef}
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
          key={draftGeneration}
          ref={composerRef}
          focalPost={post.data}
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
