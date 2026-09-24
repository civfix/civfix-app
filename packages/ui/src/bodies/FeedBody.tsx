import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  RefreshControl,
  View,
} from "react-native"
import type { NativeScrollEvent, NativeSyntheticEvent, ViewStyle } from "react-native"
import type { PostDTO } from "@civfix/shared"
import { POST_SURFACE, makeThemedStyles, useLayoutMode, type Theme } from "../theme"
import { Text } from "../typography"
import { useAuthState, useRequireAuth } from "../data"
import { useT } from "../i18n"
import { useHomeFeed } from "../data/hooks/posts"
import { useFeedRealtime } from "../data/hooks/feedRealtime"
import { useNavStore } from "../nav"
import { alpha } from "../theme/alpha"
import { useReducedMotion } from "../theme/useReducedMotion"
import { useScrollHost, type ScrollHostListHandle } from "../shell/ScrollHost"
import { useRefreshControlProps } from "../primitives/useRefreshControlProps"
import { useAppPromoStore } from "../promo"
import { HEADER_CONTROL_SIZE } from "../primitives/headerControls"
import { HeaderIconButton } from "./HeaderIconButton"
import { HeaderProfileButton } from "./HeaderProfileButton"
import { FeedNotice } from "./FeedNotice"
import { PostCard } from "./PostCard"
import { InlineComposer } from "./feed/InlineComposer"
import { useFeedScrollTopStore } from "./feed/feedScrollStore"
import { useFeedLiveStore } from "../data/feedLiveStore"
import { clearsPendingAtOffset } from "../data/feedLiveModel"
import { dedupeById } from "../primitives/listKeys"
import { NewPostsPill } from "./feed/NewPostsPill"
import { POST_CARD_RHYTHM } from "../primitives/postCardRhythm"
import {
  FEED_ROW_ENTER_MS,
  POST_LIST_END_REACHED_THRESHOLD,
  buildFeedHeaderModel,
  createFeedEntranceTracker,
  feedFooterState,
  feedViewState,
  type FeedEntranceTracker,
} from "./feedModel"

const HEADER_ENTER_RISE = 14
const ROW_ENTER_RISE = 22
const ROW_ENTER_SCALE_FROM = 0.975

function useFeedEntrance(): Animated.WithAnimatedValue<ViewStyle> {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(HEADER_ENTER_RISE)).current

  useEffect(() => {
    let mounted = true
    const settle = () => {
      opacity.stopAnimation()
      translateY.stopAnimation()
      opacity.setValue(1)
      translateY.setValue(0)
    }
    const enter = () => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: FEED_ROW_ENTER_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: FEED_ROW_ENTER_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start()
    }

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (!mounted) return
        if (reduceMotion) settle()
        else enter()
      })
      .catch(enter)

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (reduceMotion) => {
      if (reduceMotion) settle()
    })
    return () => {
      mounted = false
      subscription?.remove()
      opacity.stopAnimation()
      translateY.stopAnimation()
    }
  }, [opacity, translateY])

  return useMemo(() => ({ opacity, transform: [{ translateY }] }), [opacity, translateY])
}

function FeedPostRow({
  postId,
  entrance,
  reducedMotion,
  children,
}: {
  postId: string
  entrance: FeedEntranceTracker
  reducedMotion: boolean | null
  children: React.ReactNode
}) {
  const [wasShown] = useState(() => entrance.hasShown(postId))
  const progress = useRef(new Animated.Value(wasShown ? 1 : 0)).current

  useEffect(() => {
    if (reducedMotion == null) return
    const plan = wasShown ? { animate: false, delay: 0 } : entrance.claim(postId, Date.now())
    if (!plan.animate || reducedMotion) {
      progress.stopAnimation()
      progress.setValue(1)
      return
    }
    progress.setValue(0)
    Animated.timing(progress, {
      toValue: 1,
      delay: plan.delay,
      duration: FEED_ROW_ENTER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start()
    return () => {
      progress.stopAnimation()
    }
  }, [entrance, postId, progress, reducedMotion, wasShown])

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [ROW_ENTER_RISE, 0] }) },
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [ROW_ENTER_SCALE_FROM, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  )
}

function FeedSkeleton() {
  const styles = useStyles()
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonAvatar} />
      <View style={styles.skeletonCopy}>
        <View style={[styles.skeletonLine, { width: "42%" }]} />
        <View style={[styles.skeletonLine, styles.skeletonLineWide]} />
        <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
      </View>
    </View>
  )
}

function FeedRowSeparator() {
  const styles = useStyles()
  return POST_SURFACE === "flat" ? null : <View style={styles.rowSeparator} />
}

const NO_POSTS: readonly PostDTO[] = []

export function FeedBody() {
  const { FlatList } = useScrollHost()
  const styles = useStyles()
  const refreshSpinner = useRefreshControlProps()
  const { isAuthenticated } = useAuthState()
  const layout = useLayoutMode()
  const isExpanded = layout === "expanded"
  const feed = useHomeFeed()
  useFeedRealtime()
  const pendingNewPosts = useFeedLiveStore((s) => s.pendingNewPostIds.length)
  const entranceStyle = useFeedEntrance()
  const [entrance] = useState(createFeedEntranceTracker)
  const reducedMotion = useReducedMotion()
  const { t } = useT("home-feed")
  const headerModel = buildFeedHeaderModel({ isAuthenticated, layout }, t)
  const composeLabel = useT("nav").t("title.post_composer")
  const posts = useMemo(
    () => dedupeById(feed.data?.pages.flatMap((page) => page.items) ?? []),
    [feed.data],
  )
  const state = feedViewState({
    isLoading: feed.isLoading,
    isError: feed.isError,
    postCount: posts.length,
  })

  const openComposer = useCallback(() => useNavStore.getState().push({ kind: "composer" }), [])
  const requireAuth = useRequireAuth()
  const signIn = useCallback(() => requireAuth(() => undefined), [requireAuth])
  const refetch = feed.refetch
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(() => {
    setRefreshing(true)
    useFeedLiveStore.getState().clearNewPosts()
    void Promise.resolve(refetch()).finally(() => setRefreshing(false))
  }, [refetch])
  const showNewPosts = useCallback(() => {
    useFeedScrollTopStore.getState().requestScrollTop()
    void refetch()
    useFeedLiveStore.getState().clearNewPosts()
  }, [refetch])
  const onListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const live = useFeedLiveStore.getState()
    if (clearsPendingAtOffset(event.nativeEvent.contentOffset.y, live.pendingNewPostIds.length)) {
      live.clearNewPosts()
    }
  }, [])
  const fetchNextPage = feed.fetchNextPage
  const hasNextPage = feed.hasNextPage
  const isFetchingNextPage = feed.isFetchingNextPage
  const footerState = feedFooterState({
    state,
    isFetchingNextPage,
    isFetchNextPageError: feed.isFetchNextPageError,
    hasNextPage,
  })
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const promoHeight = useAppPromoStore((s) => s.cardHeight)

  const listRef = useRef<ScrollHostListHandle | null>(null)
  const scrollTopRequestId = useFeedScrollTopStore((s) => s.requestId)
  const honouredRequestIdRef = useRef(scrollTopRequestId)
  useEffect(() => {
    if (scrollTopRequestId === honouredRequestIdRef.current) return
    honouredRequestIdRef.current = scrollTopRequestId
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true })
  }, [scrollTopRequestId])

  const renderItem = useCallback(
    ({ item }: { item: PostDTO }) => (
      <FeedPostRow postId={item.id} entrance={entrance} reducedMotion={reducedMotion}>
        <PostCard post={item} />
      </FeedPostRow>
    ),
    [entrance, reducedMotion],
  )

  const headerStyle = useMemo(() => [entranceStyle, styles.headerInset], [entranceStyle, styles])
  const emptyStyle = useMemo(() => [styles.list, styles.headerInset, styles.emptyFill], [styles])
  const footerStyle = useMemo(() => [styles.footer, styles.headerInset], [styles])

  const header = useMemo(
    () => (
      <Animated.View style={headerStyle}>
        <View style={styles.header}>
          <Text style={styles.heading} accessibilityRole="header">
            {headerModel.title}
          </Text>
          <View style={styles.headerActions}>
            {headerModel.showComposer ? (
              <HeaderIconButton icon="Plus" label={composeLabel} onPress={openComposer} />
            ) : null}
            <HeaderProfileButton />
          </View>
        </View>
        {headerModel.showInlineComposer ? <InlineComposer /> : null}
      </Animated.View>
    ),
    [
      headerStyle,
      styles,
      headerModel.title,
      headerModel.showComposer,
      headerModel.showInlineComposer,
      composeLabel,
      openComposer,
    ],
  )

  const empty = useMemo(
    () => (
      <View style={emptyStyle}>
        {state === "loading" ? (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t("feed.loading")}
            accessibilityState={{ busy: true }}
          >
            <FeedSkeleton />
            <FeedSkeleton />
            <FeedSkeleton />
          </View>
        ) : null}
        {state === "error" && isAuthenticated ? (
          <FeedNotice
            icon="CloudOff"
            title={t("feed.error_title")}
            body={t("feed.error_body")}
            actionLabel={t("feed.retry")}
            onAction={() => void refetch()}
          />
        ) : null}
        {state === "empty" && isAuthenticated ? (
          <FeedNotice
            plain
            icon="Leaf"
            title={t("feed.empty_ready_title")}
            body={t("feed.empty_ready_body")}
          />
        ) : null}
        {!isAuthenticated && (state === "empty" || state === "error") ? (
          <FeedNotice
            plain
            icon="MessageCircle"
            title={t("feed.empty_title")}
            link={{
              before: t("feed.empty_body_before"),
              label: t("feed.empty_body_link"),
              after: t("feed.empty_body_after"),
              onPress: signIn,
            }}
          />
        ) : null}
      </View>
    ),
    [state, isAuthenticated, t, refetch, signIn, emptyStyle],
  )

  const footer = useMemo(
    () => (
      <View style={footerStyle}>
        {footerState === "loading-more" ? <FeedSkeleton /> : null}
        {footerState === "load-more-failed" ? (
          <FeedNotice
            icon="CloudOff"
            title={t("feed.load_more_error")}
            body={t("feed.error_body")}
            actionLabel={t("feed.retry")}
            onAction={loadMore}
          />
        ) : null}
        {footerState === "caught-up" ? (
          <View style={styles.caughtUp}>
            <Text style={styles.caughtUpText}>{t("feed.caught_up")}</Text>
          </View>
        ) : null}
        {promoHeight > 0 ? null : <View style={styles.bottomPad} />}
      </View>
    ),
    [footerState, loadMore, promoHeight, t, footerStyle, styles],
  )

  const contentStyle = useMemo(
    () => [
      styles.content,
      isExpanded ? styles.contentExpanded : null,
      promoHeight > 0 ? { paddingBottom: promoHeight + PROMO_CLEARANCE } : null,
    ],
    [isExpanded, promoHeight, styles],
  )

  const refresh = useMemo(
    () => (
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} {...refreshSpinner} />
    ),
    [refreshing, onRefresh, refreshSpinner],
  )

  const fadeStyle = useMemo(
    () => [styles.scrollFade, { bottom: promoHeight }],
    [promoHeight, styles],
  )

  const list = (
    <FlatList
      ref={listRef}
      style={styles.scroll}
      contentContainerStyle={contentStyle}
      data={state === "loaded" ? posts : NO_POSTS}
      keyExtractor={postKeyExtractor}
      renderItem={renderItem}
      ItemSeparatorComponent={FeedRowSeparator}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={footer}
      showsVerticalScrollIndicator={false}
      onEndReached={loadMore}
      onEndReachedThreshold={POST_LIST_END_REACHED_THRESHOLD}
      onScroll={onListScroll}
      scrollEventThrottle={16}
      refreshControl={refresh}
    />
  )

  return (
    <View style={styles.scrollHost}>
      {list}
      <NewPostsPill count={pendingNewPosts} onPress={showNewPosts} />
      {isExpanded && IS_WEB ? <View pointerEvents="none" style={fadeStyle} /> : null}
    </View>
  )
}

const IS_WEB = Platform.OS === "web"

const FEED_SCROLL_FADE_HEIGHT = 24
/** Gap kept between the last row and the floating app-promo card the list pads itself above. */
const PROMO_CLEARANCE = 14
const EMPTY_FILL_MIN_HEIGHT = 300
const webScrollFade = (t: Theme): ViewStyle =>
  IS_WEB
    ? ({
        backgroundImage: `linear-gradient(to bottom, ${alpha(t.colors.bg, 0)}, ${t.colors.bg})`,
      } as unknown as ViewStyle)
    : {}

const useStyles = makeThemedStyles((t) => ({
  scroll: { flex: 1, backgroundColor: t.colors.bg },
  scrollHost: { flex: 1 },
  scrollFade: { position: "absolute", left: 0, right: 0, height: FEED_SCROLL_FADE_HEIGHT, ...webScrollFade(t) },
  content: {
    flexGrow: 1,
    paddingHorizontal: POST_SURFACE === "flat" ? 0 : 14,
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
  },
  contentExpanded: { paddingTop: 14 },
  headerInset: { paddingHorizontal: POST_SURFACE === "flat" ? POST_CARD_RHYTHM.rowPaddingH : 0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: HEADER_CONTROL_SIZE, marginBottom: t.space["3"] },
  heading: { fontFamily: t.fontFamily.bodyExtraBold, fontSize: 32, lineHeight: 39, letterSpacing: -0.5, color: t.colors.text },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 9 },
  list: { gap: POST_SURFACE === "flat" ? 0 : t.space["3"] },
  emptyFill: { flexGrow: 1, minHeight: EMPTY_FILL_MIN_HEIGHT },
  skeletonCard: { flexDirection: "row", gap: POST_CARD_RHYTHM.gutterGap, paddingVertical: POST_CARD_RHYTHM.rowPaddingTop },
  skeletonAvatar: { width: POST_CARD_RHYTHM.avatar, height: POST_CARD_RHYTHM.avatar, borderRadius: POST_CARD_RHYTHM.avatar / 2, backgroundColor: t.colors.bgAlt },
  skeletonCopy: { flex: 1, gap: t.space["2"], paddingTop: t.space["1"] },
  skeletonLine: { height: 10, borderRadius: 5, backgroundColor: t.colors.bgAlt },
  skeletonLineWide: { width: "88%" },
  skeletonLineShort: { width: "62%" },
  rowSeparator: { height: t.space["3"] },
  footer: { gap: t.space["3"] },
  caughtUp: { alignItems: "center", paddingVertical: t.space["4"] },
  caughtUpText: { fontFamily: t.fontFamily.bodyBold, fontSize: 11.5, lineHeight: 16, color: t.colors.textSubtle },
  bottomPad: { height: t.space["8"] },
}))

const postKeyExtractor = (item: PostDTO): string => item.id
