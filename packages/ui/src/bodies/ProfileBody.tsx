import React, { useCallback, useMemo } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { CleanupDTO, ReportDTO, VerificationStatus } from "@civfix/shared"
import { makeThemedStyles, useTheme, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import {
  EmptyState,
  SignInPrompt,
  VerifiedBadge,
} from "../primitives"
import {
  useMyProfile,
  useAuthState,
  useRequireAuth,
  useMyVerification,
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

function VerificationRow({
  status,
  onGetVerified,
}: {
  status: VerificationStatus
  onGetVerified: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("profile")
  if (status === "verified") {
    return (
      <View style={[styles.verifyRow, styles.verifyVerified]}>
        <VerifiedBadge size="sm" />
        <Text style={styles.verifyVerifiedText}>{t("verification.verified")}</Text>
      </View>
    )
  }
  return (
    <Pressable
      onPress={onGetVerified}
      accessibilityRole="button"
      accessibilityLabel={t("verification.get_verified")}
      {...focusRingProps}
      style={({ pressed }) => [styles.verifyRow, styles.verifyApply, pressed ? styles.verifyApplyPressed : null]}
    >
      <View style={styles.verifyApplyIcon}>
        <Icon icon={iconMap.CheckCircle2} size={16} color={th.colors.brand.sky} />
      </View>
      <View style={styles.verifyApplyMeta}>
        <Text style={styles.verifyApplyTitle}>{t("verification.get_verified")}</Text>
        <Text style={styles.verifyApplySub} numberOfLines={1}>
          {t("verification.get_verified_sub")}
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

  const verification = useMyVerification()
  const postsQuery = useUserPosts(profile?.id)
  const reportsQuery = useMyReports(3)

  const onOpenConnections = useCallback(
    (which: "followers" | "following") => {
      if (!profile) return
      useNavStore.getState().push({ kind: which, id: profile.id })
    },
    [profile],
  )

  const onGetVerified = useCallback(() => {
    useNavStore.getState().push({ kind: "verify" })
  }, [])

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
        verificationSlot={
          verification.data ? (
            <VerificationRow
              status={verification.data.verification.status}
              onGetVerified={onGetVerified}
            />
          ) : null
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

  verifyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"] + 2,
    borderRadius: t.radius.lg,
    paddingVertical: t.space["3"],
    paddingHorizontal: t.space["3"] + 1,
  },
  verifyVerified: {
    backgroundColor: t.colors.moss["50"],
  },
  verifyVerifiedText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13.5,
    color: t.colors.moss["700"],
  },
  verifyApply: {
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s1,
  },
  verifyApplyPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  verifyApplyIcon: {
    width: 32,
    height: 32,
    borderRadius: t.radius.md,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.sky["50"],
  },
  verifyApplyMeta: {
    flex: 1,
    minWidth: 0,
  },
  verifyApplyTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14,
    color: t.colors.text,
  },
  verifyApplySub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textSubtle,
    marginTop: 1,
  },
}))
