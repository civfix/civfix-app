import React from "react"
import { Pressable } from "react-native"
import { makeThemedStyles, focusRingProps } from "../theme"
import { Text } from "../typography"
import { usePost } from "../data/hooks/posts"
import { useT } from "../i18n"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { FeedNotice } from "./FeedNotice"
import { PostCard } from "./PostCard"
import { postDetailViewState } from "./feedModel"
import { ProfileTimelineLane } from "./profile/ProfileTimelineLane"
import { useSectionStyles } from "./profile/sectionStyles"

export function PostDetailBody({ id }: { id: string }) {
  const styles = useStyles()
  const sectionStyles = useSectionStyles()
  const { t } = useT("home-feed")
  const { ScrollView } = useScrollHost()
  const query = usePost(id)
  const view = postDetailViewState({ hasId: id.length > 0, hasData: query.data != null, isError: query.isError })
  if (view !== "ready" || !query.data) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {view === "error" ? (
          <FeedNotice
            plain
            icon="CloudOff"
            title={t("thread.post_error")}
            body={t("feed.error_body")}
            actionLabel={id ? t("thread.retry") : undefined}
            onAction={id ? () => void query.refetch() : undefined}
          />
        ) : (
          <Text style={styles.state}>{t("thread.loading_post")}</Text>
        )}
      </ScrollView>
    )
  }
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <ProfileTimelineLane bleed={0}>
        <PostCard post={query.data} onOpenPost={(postId) => useNavStore.getState().push({ kind: "post-thread", id: postId })} />
      </ProfileTimelineLane>
      <Pressable
        accessibilityRole="button"
        {...focusRingProps}
        style={({ pressed }) => [
          sectionStyles.loadMore,
          pressed ? sectionStyles.loadMorePressed : null,
        ]}
        onPress={() => useNavStore.getState().push({ kind: "post-thread", id })}
      >
        <Text style={sectionStyles.loadMoreAccentText}>{t("thread.view_conversation")}</Text>
      </Pressable>
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
  content: { flexGrow: 1, paddingBottom: t.space["4"] },
  state: { padding: t.space["6"], textAlign: "center", color: t.colors.textSubtle },
}))
