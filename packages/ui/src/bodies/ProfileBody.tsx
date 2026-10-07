import React, { useCallback, useMemo } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { CleanupDTO, ReportDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
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
import { InvitationsSection } from "./profile/InvitationsSection"
import { pushCleanup } from "../nav/verbs"

const REPORTS_PREVIEW_LIMIT = 3

function DashboardRow({ onOpen }: { onOpen: () => void }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("profile")
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={t("dashboard.title")}
      {...focusRingProps}
      style={({ pressed }) => [styles.dashboardRow, pressed ? styles.dashboardRowPressed : null]}
    >
      <View style={styles.dashboardIcon}>
        <Icon icon={iconMap.Calendar} size={16} color={th.colors.brand.sky} />
      </View>
      <View style={styles.dashboardMeta}>
        <Text style={styles.dashboardTitle} numberOfLines={1}>
          {t("dashboard.title")}
        </Text>
        <Text style={styles.dashboardSub} numberOfLines={1}>
          {t("dashboard.sub")}
        </Text>
      </View>
      <Icon icon={iconMap.ChevronRight} size={18} color={th.colors.textSubtle} />
    </Pressable>
  )
}

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
  const reportsQuery = useMyReports(REPORTS_PREVIEW_LIMIT)

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

  const onOpenDashboard = useCallback(() => {
    requireAuth(() => pushKind("event-dashboard"), { next: "/dashboard" })
  }, [pushKind, requireAuth])

  const profileReports: ProfileReports = useMemo(
    () => ({
      items: (reportsQuery.data?.pages ?? []).flatMap((page) => page.items).slice(0, REPORTS_PREVIEW_LIMIT),
      isLoading: reportsQuery.isLoading,
      isError: reportsQuery.isError,
      onOpen: onOpenReport,
      onSeeAll: () => pushKind("myreports"),
    }),
    [onOpenReport, pushKind, reportsQuery.data, reportsQuery.isError, reportsQuery.isLoading],
  )

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

  if (!isAuthenticated) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.stateContent}
        showsVerticalScrollIndicator={false}
      >
        <SignInPrompt
          icon={iconMap.User}
          iconSize={32}
          variant="detail"
          title={t("signin.title")}
          body={t("signin.body")}
          onSignIn={() => requireAuth(() => {}, { next: "/profile" })}
        />
      </ScrollView>
    )
  }

  if (query.isError || !profile) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.stateContent}
        showsVerticalScrollIndicator={false}
      >
        <EmptyState
          variant="detail"
          tone="neutral"
          icon={iconMap.CloudOff}
          iconColor={th.colors.textSubtle}
          iconSize={30}
          title={t("error.title")}
          body={t("error.body")}
        />
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
        onOpenEvent={onOpenEvent}
        onOpenConnections={onOpenConnections}
        posts={posts}
        onOpenSaved={onOpenSaved}
        reports={profileReports}
        hours={<ServiceHoursSection variant="own" totalHours={profile.volunteerHours} />}
        dashboardSlot={
          <View style={styles.dashboardStack}>
            <InvitationsSection />
            <DashboardRow onOpen={onOpenDashboard} />
          </View>
        }
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
  dashboardStack: {
    gap: t.space["4"],
  },
  dashboardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"] + 2,
    borderRadius: t.radius.lg,
    paddingVertical: t.space["3"],
    paddingHorizontal: t.space["3"] + 1,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s1,
  },
  dashboardRowPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  dashboardIcon: {
    width: 32,
    height: 32,
    borderRadius: t.radius.md,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.sky["50"],
  },
  dashboardMeta: {
    flex: 1,
    minWidth: 0,
  },
  dashboardTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  dashboardSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
    marginTop: 1,
  },
}))
