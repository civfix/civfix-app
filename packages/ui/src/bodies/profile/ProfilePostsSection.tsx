import React from "react"
import { View, Pressable } from "react-native"
import type { PostDTO } from "@civfix/shared"
import { makeThemedStyles, focusRingProps, webCursorPointer, webTransition, MIN_TOUCH_TARGET } from "../../theme"
import { Text } from "../../typography"
import { useT } from "../../i18n"
import { PostCard } from "../PostCard"
import { SectionEyebrow } from "./SectionHeadings"
import { useSectionStyles } from "./sectionStyles"
import { PROFILE_TIMELINE_BLEED, ProfileTimelineLane } from "./ProfileTimelineLane"

export interface ProfilePosts {
  items: PostDTO[]
  isLoading: boolean
  isError: boolean
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore?: () => void
}

export interface ProfilePostsSectionProps {
  posts: ProfilePosts
  onOpenSaved?: () => void
}

export function ProfilePostsSection({ posts, onOpenSaved }: ProfilePostsSectionProps) {
  const styles = useStyles()
  const sectionStyles = useSectionStyles()
  const { t } = useT("profile-view")
  return (
    <>
      <View style={styles.headRow}>
        <SectionEyebrow>{t("posts.section")}</SectionEyebrow>
        {onOpenSaved ? (
          <Pressable
            onPress={onOpenSaved}
            accessibilityRole="button"
            accessibilityLabel={t("posts.saved_a11y")}
            {...focusRingProps}
            style={({ pressed }) => [
              styles.saved,
              webCursorPointer,
              webTransition,
              pressed ? styles.savedPressed : null,
            ]}
          >
            <Text style={styles.savedText}>{t("posts.saved")}</Text>
          </Pressable>
        ) : null}
      </View>
      {posts.isLoading ? (
        <Text style={sectionStyles.empty}>{t("posts.loading")}</Text>
      ) : posts.isError ? (
        <Text style={sectionStyles.empty}>{t("posts.error")}</Text>
      ) : posts.items.length === 0 ? (
        <Text style={sectionStyles.empty}>{t("posts.empty")}</Text>
      ) : (
        <>
          <View style={styles.lane}>
            <ProfileTimelineLane bleed={PROFILE_TIMELINE_BLEED}>
              {posts.items.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </ProfileTimelineLane>
          </View>
          {posts.hasMore && posts.onLoadMore ? (
            <Pressable
              onPress={posts.onLoadMore}
              disabled={posts.isLoadingMore}
              accessibilityRole="button"
              accessibilityLabel={t("posts.load_more_a11y")}
              {...focusRingProps}
              style={({ pressed }) => [
                sectionStyles.loadMore,
                pressed ? sectionStyles.loadMorePressed : null,
              ]}
            >
              <Text style={sectionStyles.loadMoreText}>
                {posts.isLoadingMore ? t("posts.loading_more") : t("posts.load_more")}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </>
  )
}

const useStyles = makeThemedStyles((t) => ({
  lane: {
    marginTop: t.space["3"],
    marginBottom: t.space["4"],
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["3"],
  },
  saved: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingLeft: t.space["3"],
    borderRadius: t.radius.xs,
  },
  savedPressed: {
    opacity: 0.7,
  },
  savedText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    lineHeight: 14,
    color: t.colors.textMuted,
    textDecorationLine: "underline",
  },
}))
