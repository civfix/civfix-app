import React from "react"
import { Pressable } from "react-native"
import { makeThemedStyles, focusRingProps } from "../theme"
import { Text } from "../typography"
import { usePost } from "../data/hooks/posts"
import { useT } from "../i18n"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { PostCard } from "./PostCard"
import { ProfileTimelineLane } from "./profile/ProfileTimelineLane"

export function PostDetailBody({ id }: { id: string }) {
  const styles = useStyles()
  const { t } = useT("home-feed")
  const { ScrollView } = useScrollHost()
  const query = usePost(id)
  if (query.isLoading || query.isError || !query.data) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.state}>
          {query.isLoading ? t("thread.loading_post") : t("thread.post_error")}
        </Text>
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
        style={styles.threadButton}
        onPress={() => useNavStore.getState().push({ kind: "post-thread", id })}
      >
        <Text style={styles.threadText}>{t("thread.view_conversation")}</Text>
      </Pressable>
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
  content: { flexGrow: 1, paddingBottom: t.space["4"] },
  state: { padding: t.space["6"], textAlign: "center", color: t.colors.textSubtle },
  threadButton: { alignSelf: "center", marginTop: t.space["4"], paddingHorizontal: t.space["5"], paddingVertical: t.space["2"], borderRadius: t.radius.pill, backgroundColor: t.colors.bgAlt },
  threadText: { color: t.colors.accentText, fontFamily: t.fontFamily.bodyBold },
}))
