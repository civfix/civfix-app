import React from "react"
import { Pressable } from "react-native"
import type { PostDTO } from "@civfix/shared"
import { makeThemedStyles, focusRingProps } from "../theme"
import { Text } from "../typography"
import { useSaves } from "../data/hooks/posts"
import { useT } from "../i18n"
import { useScrollHost } from "../shell/ScrollHost"
import { PostCard } from "./PostCard"
import { POST_LIST_END_REACHED_THRESHOLD } from "./feedModel"
import { ProfileTimelineLane } from "./profile/ProfileTimelineLane"
import { useSectionStyles } from "./profile/sectionStyles"

export function SavedPostsBody() {
  const styles = useStyles()
  const sectionStyles = useSectionStyles()
  const { t } = useT("home-feed")
  const { FlatList } = useScrollHost()
  const query = useSaves()
  const items = React.useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page.items),
    [query.data],
  )
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query
  const loadMore = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const renderItem = React.useCallback(
    ({ item }: { item: PostDTO }) => <PostCard post={item} />,
    [],
  )
  const keyExtractor = React.useCallback((item: PostDTO) => item.id, [])

  const empty = (
    <>
      {query.isLoading ? <Text style={styles.state}>{t("saved.loading")}</Text> : null}
      {query.isError ? <Text style={styles.state}>{t("saved.error")}</Text> : null}
      {!query.isLoading && !query.isError ? <Text style={styles.state}>{t("saved.empty")}</Text> : null}
    </>
  )

  const footer = hasNextPage ? (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isFetchingNextPage }}
      disabled={isFetchingNextPage}
      {...focusRingProps}
      style={({ pressed }) => [
        sectionStyles.loadMore,
        pressed ? sectionStyles.loadMorePressed : null,
      ]}
      onPress={loadMore}
    >
      <Text style={sectionStyles.loadMoreText}>
        {isFetchingNextPage ? t("thread.loading") : t("saved.load_more")}
      </Text>
    </Pressable>
  ) : null

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={items.length > 0 ? <ProfileTimelineLane bleed={0}>{null}</ProfileTimelineLane> : null}
      ListEmptyComponent={empty}
      ListFooterComponent={footer}
      showsVerticalScrollIndicator={false}
      onEndReached={loadMore}
      onEndReachedThreshold={POST_LIST_END_REACHED_THRESHOLD}
    />
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
  content: { flexGrow: 1, paddingBottom: t.space["4"] },
  state: { paddingVertical: t.space["6"], paddingHorizontal: t.space["4"], textAlign: "center", color: t.colors.textSubtle },
}))
