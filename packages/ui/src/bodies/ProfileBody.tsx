import React, { useCallback, useMemo } from "react"
import type { CleanupDTO, ReportDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme } from "../theme"
import { iconMap } from "../typography"
import { EmptyState, SignInPrompt } from "../primitives"
import {
  useMyProfile,
  useAuthState,
  useRequireAuth,
  useMyReports,
} from "../data"
import { useUserPosts } from "../data/hooks/posts"
import { useNavStore, type DetailKind } from "../nav"
import { useT } from "../i18n"
import { useScrollHost } from "../shell/ScrollHost"
import {
  ProfileView,
  ProfileViewSkeleton,
  type ProfilePosts,
  type ProfileReports,
} from "./ProfileView"
import { ServiceHoursSection } from "./profile/ServiceHoursSection"
import { pushCleanup } from "./navHelpers"

export function ProfileBody() {
  const styles = useStyles()
  const th = useTheme()
  const { ScrollView } = useScrollHost()
  const { t } = useT("profile")
  const { isAuthenticated, isPending } = useAuthState()
  const requireAuth = useRequireAuth()
  const query = useMyProfile()
  const profile = query.data?.profile

  const postsQuery = useUserPosts(profile?.id)
  const reportsQuery = useMyReports(3)

  const onOpenConnections = useCallback(
    (which: "followers" | "following") => {
      if (!profile) return
      useNavStore.getState().push({ kind: which, id: profile.id })
    },
    [profile],
  )

  const onOpenEvent = useCallback((event: CleanupDTO) => {
    pushCleanup(event)
  }, [])

  const onOpenReport = useCallback((report: ReportDTO) => {
    const nav = useNavStore.getState()
    nav.push({ kind: "pin", id: report.id, title: report.title ?? undefined, lat: report.lat, lng: report.lng })
  }, [])

  const pushKind = useCallback((kind: DetailKind) => {
    useNavStore.getState().push({ kind })
  }, [])

  const onOpenSaved = useCallback(() => pushKind("saves"), [pushKind])

  const profileReports: ProfileReports = useMemo(
    () => ({
      items: (reportsQuery.data?.pages ?? []).flatMap((page) => page.items).slice(0, 3),
      isLoading: reportsQuery.isLoading,
      isError: reportsQuery.isError,
      onOpen: onOpenReport,
      onSeeAll: () => pushKind("myreports"),
    }),
    [onOpenReport, pushKind, reportsQuery.data, reportsQuery.isError, reportsQuery.isLoading],
  )

  const stateContent = (() => {
    if (!isAuthenticated && !isPending) {
      return (
        <SignInPrompt
          icon={iconMap.User}
          iconSize={32}
          variant="detail"
          title={t("signin.title")}
          body={t("signin.body")}
          onSignIn={() => requireAuth(() => {}, { next: "/profile" })}
        />
      )
    }
    if (query.isError || !profile) {
      return (
        <EmptyState
          variant="detail"
          tone="neutral"
          icon={iconMap.CloudOff}
          iconColor={th.colors.textSubtle}
          iconSize={30}
          title={t("error.title")}
          body={t("error.body")}
        />
      )
    }
    return null
  })()

  if (isPending || query.isLoading) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ProfileViewSkeleton />
      </ScrollView>
    )
  }

  if (stateContent || !profile) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.stateContent}
        showsVerticalScrollIndicator={false}
      >
        {stateContent}
      </ScrollView>
    )
  }

  const posts: ProfilePosts = {
    items: (postsQuery.data?.pages ?? []).flatMap((page) => page.items),
    isLoading: postsQuery.isLoading,
    isError: postsQuery.isError,
    hasMore: Boolean(postsQuery.hasNextPage),
    isLoadingMore: postsQuery.isFetchingNextPage,
    onLoadMore: postsQuery.hasNextPage ? () => void postsQuery.fetchNextPage() : undefined,
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ProfileView
        profile={profile}
        subtitle={profile.handle ? `@${profile.handle}` : undefined}
        onOpenEvent={onOpenEvent}
        onOpenConnections={onOpenConnections}
        posts={posts}
        onOpenSaved={onOpenSaved}
        reports={profileReports}
        hours={<ServiceHoursSection variant="own" totalHours={profile.volunteerHours} />}
      />
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["1"],
    paddingBottom: t.space["10"],
  },
  stateContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
}))
