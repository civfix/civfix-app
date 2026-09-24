import React from "react"
import { View, Pressable } from "react-native"
import type { PostDTO } from "@civfix/shared"
import { focusRingProps } from "../../theme"
import { Text } from "../../typography"
import type { useUserPosts } from "../../data/hooks/posts"
import { useT } from "../../i18n"
import { PostCard } from "../PostCard"
import { PROFILE_TIMELINE_BLEED, ProfileTimelineLane } from "../profile/ProfileTimelineLane"
import { useSectionStyles } from "../profile/sectionStyles"
import { usePersonDetailStyles } from "./personDetailStyles"

export function PersonPostsTab({
  postsQuery,
  postItems,
  onLoadMorePosts,
}: {
  postsQuery: ReturnType<typeof useUserPosts>
  postItems: PostDTO[]
  onLoadMorePosts: () => void
}) {
  const styles = usePersonDetailStyles()
  const sectionStyles = useSectionStyles()
  const { t } = useT("profile-person")

  if (postsQuery.isLoading) return <Text style={styles.postsState}>{t("posts.loading")}</Text>
  if (postsQuery.isError) return <Text style={styles.postsState}>{t("posts.error")}</Text>
  if (postItems.length === 0) return <Text style={styles.postsState}>{t("posts.empty")}</Text>

  return (
    <>
      <View style={styles.postsLane}>
        <ProfileTimelineLane bleed={PROFILE_TIMELINE_BLEED}>
          {postItems.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </ProfileTimelineLane>
      </View>
      {postsQuery.hasNextPage ? (
        <Pressable
          {...focusRingProps}
          style={({ pressed }) => [
            sectionStyles.loadMore,
            pressed ? sectionStyles.loadMorePressed : null,
          ]}
          onPress={onLoadMorePosts}
          disabled={postsQuery.isFetchingNextPage}
          accessibilityRole="button"
          accessibilityState={{ disabled: postsQuery.isFetchingNextPage, busy: postsQuery.isFetchingNextPage }}
          accessibilityLabel={t("posts.load_more_a11y")}
        >
          <Text style={sectionStyles.loadMoreText}>
            {postsQuery.isFetchingNextPage ? t("posts.loading_more") : t("posts.load_more")}
          </Text>
        </Pressable>
      ) : null}
    </>
  )
}
