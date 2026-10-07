import React from "react"
import { View, Pressable } from "react-native"
import type { PostDTO } from "@civfix/shared"
import { focusRingProps } from "../../theme"
import { Text } from "../../typography"
import { useT } from "../../i18n"
import { PostCard } from "../PostCard"
import { PROFILE_TIMELINE_BLEED, ProfileTimelineLane } from "../profile/ProfileTimelineLane"
import { useSectionStyles } from "../profile/sectionStyles"
import { usePersonDetailStyles } from "./personDetailStyles"
import { personPostsListed } from "./personPostsModel"

/** Once posts are listed they are the person list's own rows, so the head draws only the lane's top rule. */
export function PersonPostsHead(props: {
  loading: boolean
  error: boolean
  postItems: readonly PostDTO[]
}) {
  const styles = usePersonDetailStyles()
  const { t } = useT("profile-person")

  if (personPostsListed(props)) {
    return <ProfileTimelineLane bleed={PROFILE_TIMELINE_BLEED}>{null}</ProfileTimelineLane>
  }
  if (props.loading) return <Text style={styles.postsState}>{t("posts.loading")}</Text>
  if (props.error) return <Text style={styles.postsState}>{t("posts.error")}</Text>
  return <Text style={styles.postsState}>{t("posts.empty")}</Text>
}

export function renderPersonPost({ item }: { item: PostDTO }) {
  return <PostCard post={item} />
}

export function PersonPostsFooter({
  hasMore,
  loadingMore,
  onLoadMorePosts,
}: {
  hasMore: boolean
  loadingMore: boolean
  onLoadMorePosts: () => void
}) {
  const styles = usePersonDetailStyles()
  const sectionStyles = useSectionStyles()
  const { t } = useT("profile-person")

  return (
    <View style={styles.postsFooter}>
      {hasMore ? (
        <Pressable
          {...focusRingProps}
          style={({ pressed }) => [
            sectionStyles.loadMore,
            pressed ? sectionStyles.loadMorePressed : null,
          ]}
          onPress={onLoadMorePosts}
          disabled={loadingMore}
          accessibilityRole="button"
          accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
          accessibilityLabel={t("posts.load_more_a11y")}
        >
          <Text style={sectionStyles.loadMoreText}>
            {loadingMore ? t("posts.loading_more") : t("posts.load_more")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
