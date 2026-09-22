import React, { useCallback, useMemo, useState } from "react"
import { View, Pressable, Modal, Platform, StyleSheet } from "react-native"
import {
  resolveAvatarGradient,
  type CleanupDTO,
  type ContentReportReason,
} from "@civfix/shared"
import { eventChip } from "@civfix/shared/datetime"
import { makeThemedStyles, radius, useTheme, wash, focusRingProps, useLayoutMode, webScrimProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import {
  Avatar,
  DonateBlock,
  EmptyState,
  FollowButton,
  MetaDot,
  PopoverMenu,
  ReportContentSheet,
  SkeletonBlock,
  SkeletonGroup,
  SkeletonList,
  SkeletonText,
  SocialLinksRow,
  usePopoverAnchor,
  useToast,
} from "../primitives"
import type { PopoverMenuItem, AnchorRect } from "../primitives"
import {
  useProfile,
  useStartDm,
  useBlockUser,
  useUnblockUser,
  useReportContent,
  useRequireAuth,
  useProfilePastEvents,
} from "../data"
import { useUserPosts } from "../data/hooks/posts"
import { useNavStore } from "../nav"
import { useT, useEventWhen, useLocale } from "../i18n"
import { useScrollHost } from "../shell/ScrollHost"
import {
  DETAIL_BACK_SIZE,
  DETAIL_BACK_RADIUS,
  DETAIL_BACK_ICON_SIZE,
  detailTitleStyle,
} from "../shell/detailHeader"
import { pushCleanup } from "./navHelpers"
import { AffiliationRow } from "./AffiliationRow"
import { ProfileStatsRow } from "./ProfileStatsRow"
import { PostCard } from "./PostCard"
import { ProfileTabBar } from "./profile/ProfileTabBar"
import { PROFILE_TIMELINE_BLEED, ProfileTimelineLane } from "./profile/ProfileTimelineLane"
import { ServiceHoursSection } from "./profile/ServiceHoursSection"
import { PROFILE_DEFAULT_TAB, buildProfileTabsModel, type ProfileTabId } from "./profileTabsModel"
import { splitProfileEvents } from "./profile/profileEventSplit"
import { useSectionStyles } from "./profile/sectionStyles"

function MiniEventRow({
  event,
  role,
  onPress,
}: {
  event: CleanupDTO
  role: string
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("profile-person")
  const { locale } = useLocale()
  const when = useEventWhen(event)
  const { day, month } = eventChip(event.scheduledAt, locale, when.timeZone)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("events.row_a11y", { title: event.title, role })}
      {...focusRingProps}
      style={({ pressed }) => [styles.mini, pressed ? styles.miniPressed : null]}
    >
      <View style={styles.dateChip}>
        <Text style={styles.dateDay}>{day}</Text>
        <Text style={styles.dateMonth}>{month}</Text>
      </View>
      <View style={styles.miniMeta}>
        <Text style={styles.miniTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <View style={styles.miniSubRow}>
          <Text style={styles.miniSub} numberOfLines={1}>
            {role}
          </Text>
          <MetaDot color={th.colors.textSubtle} style={styles.miniSubDot} />
          <Text style={[styles.miniSub, styles.miniSubWhen]} numberOfLines={1}>
            {when.dow} {when.timeWithZone}
          </Text>
        </View>
      </View>
      <Icon icon={iconMap.ChevronRight} size={16} color={th.colors.textSubtle} />
    </Pressable>
  )
}

function PersonScroll({ children }: { children: React.ReactNode }) {
  const styles = useStyles()
  const { ScrollView } = useScrollHost()
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  )
}

export function PersonDetailBody({ id, onBack }: { id: string; onBack?: () => void }) {
  const styles = useStyles()
  const sectionStyles = useSectionStyles()
  const th = useTheme()
  const { t } = useT("profile-person")
  const { t: tNav } = useT("nav")
  const back = onBack ?? useNavStore.getState().back
  const layoutMode = useLayoutMode()
  const { start } = useStartDm()
  const query = useProfile(id)
  const profile = query.data?.profile
  const postsQuery = useUserPosts(profile?.id)
  const pastEvents = useProfilePastEvents(profile)
  const profileId = profile?.id
  const upcomingEvents = profile?.upcomingEvents
  const pastEventList = pastEvents.events
  const eventSplit = useMemo(
    () => splitProfileEvents(pastEventList, upcomingEvents, profileId ?? "", Date.now()),
    [pastEventList, upcomingEvents, profileId],
  )
  const upcoming = useMemo(
    () => [...eventSplit.upcomingHosting, ...eventSplit.upcomingGoing],
    [eventSplit],
  )
  const postsData = postsQuery.data
  const postItems = useMemo(
    () => (postsData?.pages ?? []).flatMap((page) => page.items),
    [postsData],
  )
  const [requestedTab, setRequestedTab] = useState<ProfileTabId>(PROFILE_DEFAULT_TAB)
  const fetchMorePosts = postsQuery.fetchNextPage
  const postsFetchingMore = postsQuery.isFetchingNextPage
  const onLoadMorePosts = useCallback(() => {
    if (postsFetchingMore) return
    void fetchMorePosts()
  }, [fetchMorePosts, postsFetchingMore])

  const onMessage = useCallback(() => {
    if (!profile?.id) return
    start(
      { id: profile.id, name: profile.name, handle: profile.handle },
      `/people/${profile.handle ?? id}`,
      {
        onResolved: ({ roomId, thread }) =>
          useNavStore.getState().push({
            kind: "thread",
            id: roomId,
            roomKind: "dm",
            peer: thread.peer ?? undefined,
          }),
      },
    )
  }, [start, id, profile?.id, profile?.name, profile?.handle])

  const onOpenEvent = useCallback((event: CleanupDTO) => {
    pushCleanup(event)
  }, [])

  const onOpenConnections = useCallback(
    (which: "followers" | "following") => {
      if (!profile?.id) return
      useNavStore.getState().push({ kind: which, id: profile.id })
    },
    [profile?.id],
  )

  const requireAuth = useRequireAuth()
  const blockUser = useBlockUser()
  const unblockUser = useUnblockUser()
  const reportContent = useReportContent()
  const toast = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuRect, setMenuRect] = useState<AnchorRect | null>(null)
  const { ref: menuAnchorRef, measure: measureMenu } = usePopoverAnchor(setMenuRect)
  const [confirmingBlock, setConfirmingBlock] = useState(false)
  const [reporting, setReporting] = useState(false)

  const profilePath = `/people/${profile?.handle ?? id}`

  const startBlock = useCallback(() => {
    setConfirmingBlock(true)
  }, [])
  const confirmBlock = useCallback(() => {
    const blockId = profile?.id
    if (!blockId) return
    requireAuth(
      () =>
        blockUser.mutate(blockId, {
          onError: () => toast.show(t("block.error"), { variant: "error" }),
          onSuccess: () => {
            setConfirmingBlock(false)
            useNavStore.getState().back()
          },
        }),
      { next: profilePath },
    )
  }, [requireAuth, blockUser, profile?.id, profilePath, toast, t])
  const onUnblock = useCallback(() => {
    const targetId = profile?.id
    if (!targetId) return
    requireAuth(
      () =>
        unblockUser.mutate(targetId, {
          onError: () => toast.show(t("blocked.unblock_error"), { variant: "error" }),
        }),
      { next: profilePath },
    )
  }, [requireAuth, unblockUser, profile?.id, profilePath, toast, t])
  const startReport = useCallback(() => {
    requireAuth(
      () => {
        reportContent.reset()
        setReporting(true)
      },
      { next: profilePath },
    )
  }, [requireAuth, reportContent, profilePath])
  const closeReport = useCallback(() => {
    if (reportContent.isPending) return
    setReporting(false)
  }, [reportContent.isPending])
  const onSubmitReport = useCallback(
    (reason: ContentReportReason, details?: string) => {
      const subjectId = profile?.id
      if (!subjectId) return
      reportContent.mutate(
        { subjectType: "profile", subjectId, reason, ...(details ? { details } : {}) },
        {
          onSuccess: () => {
            setReporting(false)
            toast.show(t("report.toast_submitted"), { variant: "success" })
          },
        },
      )
    },
    [reportContent, profile?.id, toast, t],
  )

  const header = layoutMode === "expanded" ? (
    <View style={[styles.header, styles.headerPanel]}>
      <Pressable
        onPress={back}
        accessibilityRole="button"
        accessibilityLabel={tNav("a11y.back")}
        hitSlop={6}
        {...focusRingProps}
        style={styles.headerChip}
      >
        <Icon icon={iconMap.ArrowLeft} size={DETAIL_BACK_ICON_SIZE} color={th.colors.text} />
      </Pressable>
      <Text style={styles.headerPanelTitle} numberOfLines={1} accessibilityRole="header">
        {profile?.name ?? tNav("title.person")}
      </Text>
    </View>
  ) : (
    <View style={styles.header}>
      <Pressable
        onPress={back}
        accessibilityRole="button"
        accessibilityLabel={tNav("a11y.back")}
        hitSlop={6}
        {...focusRingProps}
        style={styles.headerButton}
      >
        <Icon icon={iconMap.ArrowLeft} size={21} color={th.colors.text} />
      </Pressable>
      <View pointerEvents="none" style={styles.headerTitleWrap}>
        <Text variant="heading" numberOfLines={1}>
          {profile?.name ?? tNav("title.person")}
        </Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  )

  if (query.isLoading) {
    return (
      <View style={styles.root}>
        {header}
        <PersonScroll>
          <SkeletonGroup>
            <View style={styles.hero}>
              <SkeletonBlock width={72} height={72} radius={36} />
              <SkeletonText width={168} height={18} style={styles.skeletonName} />
              <SkeletonText width={104} height={12} style={styles.skeletonHandle} />
              <SkeletonText width={248} height={12} style={styles.skeletonBio} />
              <SkeletonText width={196} height={12} style={styles.skeletonBioLast} />
            </View>
            <View style={styles.skeletonStats}>
              <SkeletonBlock width="30%" height={44} radius={radius.md} />
              <SkeletonBlock width="30%" height={44} radius={radius.md} />
              <SkeletonBlock width="30%" height={44} radius={radius.md} />
            </View>
            <View style={styles.actions}>
              <SkeletonBlock width="100%" height={40} radius={radius.pill} style={styles.followAction} />
              <SkeletonBlock width={40} height={40} radius={20} />
            </View>
            <View style={styles.skeletonTabs}>
              <SkeletonBlock width={72} height={30} radius={radius.pill} />
              <SkeletonBlock width={72} height={30} radius={radius.pill} />
              <SkeletonBlock width={72} height={30} radius={radius.pill} />
            </View>
            <SkeletonList rows={3} kind="text" />
          </SkeletonGroup>
        </PersonScroll>
      </View>
    )
  }
  if (query.isError || !profile) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.stateFill}>
          <EmptyState
            variant="detail"
            tone="neutral"
            icon={iconMap.User}
            iconColor={th.colors.textSubtle}
            iconSize={30}
            title={t("error.title")}
            body={t("error.body")}
          />
        </View>
      </View>
    )
  }

  const hosting = eventSplit.pastHosted
  const going = eventSplit.pastAttended
  const hasEvents = upcoming.length > 0 || hosting.length > 0 || going.length > 0

  const blockMenuItem: PopoverMenuItem = {
    key: "block",
    label: t("menu.block"),
    icon: "Ban",
    destructive: true,
    onPress: startBlock,
  }
  const unblockMenuItem: PopoverMenuItem = {
    key: "unblock",
    label: t("menu.unblock"),
    icon: "Ban",
    disabled: unblockUser.isPending,
    onPress: onUnblock,
  }
  const reportMenuItem: PopoverMenuItem = {
    key: "report",
    label: t("menu.report"),
    icon: "Flag",
    onPress: startReport,
  }
  const menuItems: PopoverMenuItem[] = profile.blockedByMe
    ? [unblockMenuItem, reportMenuItem]
    : [blockMenuItem, reportMenuItem]

  const tabsModel = buildProfileTabsModel(requestedTab, {
    posts: true,
    events: true,
    hours: profile.volunteerHours != null && profile.showVolunteerHours !== false,
    reports: false,
  })

  return (
    <View style={styles.root}>
      {header}
      <PersonScroll>
        <View style={styles.hero}>
          <Avatar
            name={profile.name}
            seed={profile.id}
            photoUrl={profile.avatarUrl}
            gradient={resolveAvatarGradient(profile.avatar, profile.id)}
            size={72}
          />
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.name}
            </Text>
          </View>
          {profile.handle ? (
            <View style={styles.handleRow}>
              <Text style={styles.handle} numberOfLines={1}>
                @{profile.handle}
              </Text>
            </View>
          ) : null}
          {profile.bio ? (
            <Text style={styles.bio} numberOfLines={4}>
              {profile.bio}
            </Text>
          ) : null}
        </View>

        {profile.organization ? (
          <AffiliationRow organization={profile.organization} style={styles.affiliation} />
        ) : null}

        <SocialLinksRow links={profile.socialLinks} style={styles.socialRow} />

        <ProfileStatsRow
          followers={profile.followers}
          following={profile.following}
          stats={profile.stats}
          onOpenConnections={onOpenConnections}
        />

        <DonateBlock url={profile.donationUrl} ownerName={profile.name} />

        <View style={styles.actions}>
          {profile.blockedByMe ? (
            <Text style={styles.blockedLabel}>{t("blocked.label")}</Text>
          ) : (
            <>
              <FollowButton
                personId={profile.id}
                isFollowing={profile.isFollowing}
                nextPath={profilePath}
                size="md"
                style={styles.followAction}
              />
              <Pressable
                onPress={onMessage}
                accessibilityRole="button"
                accessibilityLabel={t("actions.message_a11y", { name: profile.name })}
                {...focusRingProps}
                style={({ pressed }) => [styles.secondary, pressed ? styles.secondaryPressed : null]}
              >
                <Icon icon={iconMap.MessageCircle} size={17} color={th.colors.text} />
                <Text style={styles.secondaryText}>{t("actions.message")}</Text>
              </Pressable>
            </>
          )}
          <Pressable
            ref={menuAnchorRef}
            onPress={() => {
              measureMenu()
              setMenuOpen(true)
            }}
            accessibilityRole="button"
            accessibilityLabel={t("actions.more_options")}
            accessibilityState={{ expanded: menuOpen }}
            {...focusRingProps}
            style={({ pressed }) => [styles.overflowBtn, pressed ? styles.secondaryPressed : null]}
          >
            <Icon icon={iconMap.Ellipsis} size={18} color={th.colors.text} />
          </Pressable>
        </View>

        <ProfileTabBar model={tabsModel} onSelect={setRequestedTab} />

        {tabsModel.active === "posts" ? (
          postsQuery.isLoading ? (
            <Text style={styles.postsState}>{t("posts.loading")}</Text>
          ) : postsQuery.isError ? (
            <Text style={styles.postsState}>{t("posts.error")}</Text>
          ) : postItems.length === 0 ? (
            <Text style={styles.postsState}>{t("posts.empty")}</Text>
          ) : (
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
        ) : null}

        {tabsModel.active === "events" && !hasEvents ? (
          <Text style={styles.postsState}>{t("events.empty")}</Text>
        ) : null}
        {tabsModel.active === "events" && hasEvents ? (
          <View style={styles.events}>
            <Text style={styles.eventsLabel}>{t("events.label")}</Text>
            {upcoming.length > 0 ? (
              <>
                <Text style={styles.eventsGroupLabel}>{t("events.group_upcoming")}</Text>
                {eventSplit.upcomingHosting.map((ev) => (
                  <MiniEventRow
                    key={`uh-${ev.id}`}
                    event={ev}
                    role={t("events.role_hosting")}
                    onPress={() => onOpenEvent(ev)}
                  />
                ))}
                {eventSplit.upcomingGoing.map((ev) => (
                  <MiniEventRow
                    key={`ug-${ev.id}`}
                    event={ev}
                    role={t("events.role_going")}
                    onPress={() => onOpenEvent(ev)}
                  />
                ))}
              </>
            ) : null}
            {hosting.length > 0 || going.length > 0 ? (
              <Text style={styles.eventsGroupLabel}>{t("events.group_past")}</Text>
            ) : null}
            {hosting.map((ev) => (
              <MiniEventRow
                key={`h-${ev.id}`}
                event={ev}
                role={t("events.role_hosting")}
                onPress={() => onOpenEvent(ev)}
              />
            ))}
            {going.map((ev) => (
              <MiniEventRow
                key={`g-${ev.id}`}
                event={ev}
                role={t("events.role_going")}
                onPress={() => onOpenEvent(ev)}
              />
            ))}
            {pastEvents.isError ? (
              <Text style={styles.postsState}>{t("events.load_more_error")}</Text>
            ) : null}
            {pastEvents.canLoadMore ? (
              <Pressable
                onPress={pastEvents.loadMore}
                disabled={pastEvents.isLoadingMore}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: pastEvents.isLoadingMore,
                  busy: pastEvents.isLoadingMore,
                }}
                accessibilityLabel={t("events.load_more_a11y")}
                {...focusRingProps}
                style={({ pressed }) => [
                  sectionStyles.loadMore,
                  pressed ? sectionStyles.loadMorePressed : null,
                ]}
              >
                <Text style={sectionStyles.loadMoreText}>
                  {pastEvents.isLoadingMore
                    ? t("events.loading_more")
                    : pastEvents.isRetry
                      ? t("events.load_more_retry")
                      : t("events.load_more")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {tabsModel.active === "hours" ? (
          <ServiceHoursSection
            variant="public"
            userId={profile.id}
            totalHours={profile.volunteerHours}
          />
        ) : null}
      </PersonScroll>

      <PopoverMenu
        visible={menuOpen}
        anchorRect={menuRect}
        onClose={() => setMenuOpen(false)}
        items={menuItems}
      />

      <Modal
        visible={confirmingBlock}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmingBlock(false)}
      >
        <View style={styles.confirmRoot}>
          <Pressable
            style={styles.confirmBackdrop}
            accessibilityRole="button"
            accessibilityLabel={t("block.cancel")}
            onPress={() => setConfirmingBlock(false)}
            {...webScrimProps}
          />
          <View style={styles.confirm} accessibilityRole="alert">
            <Text style={styles.confirmText}>
              {t("block.confirm_message", { name: profile.name })}
            </Text>
            <View style={styles.confirmRow}>
              <Pressable
                onPress={() => setConfirmingBlock(false)}
                accessibilityRole="button"
                accessibilityLabel={t("block.cancel")}
                {...focusRingProps}
                style={({ pressed }) => [styles.confirmCancel, pressed ? styles.pressed : null]}
              >
                <Text style={styles.confirmCancelText}>{t("block.cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={confirmBlock}
                disabled={blockUser.isPending}
                accessibilityRole="button"
                accessibilityLabel={t("block.confirm")}
                {...focusRingProps}
                style={({ pressed }) => [styles.confirmBlock, pressed ? styles.pressed : null]}
              >
                <Text style={styles.confirmBlockText}>{t("block.confirm")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ReportContentSheet
        visible={reporting}
        subjectLabel={t("report.subject_label")}
        pending={reportContent.isPending}
        error={reportContent.isError ? t("report.error") : null}
        onSubmit={onSubmitReport}
        onClose={closeReport}
      />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  header: {
    minHeight: 52,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: t.space["4"],
    backgroundColor: t.colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -t.space["3"],
  },
  headerPanel: {
    minHeight: 0,
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomColor:
      Platform.OS === "web" ? wash(t.colors.borderStrong, 0.45, t) : t.colors.border,
  },
  headerChip: {
    width: DETAIL_BACK_SIZE,
    height: DETAIL_BACK_SIZE,
    borderRadius: DETAIL_BACK_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  headerPanelTitle: { ...detailTitleStyle(18, t), flex: 1 },
  headerTitleWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 52,
  },
  headerSpacer: { width: 44 },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingBottom: t.space["10"],
  },
  stateFill: {
    flex: 1,
  },

  skeletonName: { marginTop: 10 },
  skeletonHandle: { marginTop: 8 },
  skeletonBio: { marginTop: 10 },
  skeletonBioLast: { marginTop: 6 },
  skeletonStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: t.space["2"],
    marginTop: t.space["3"],
  },
  skeletonTabs: {
    flexDirection: "row",
    gap: t.space["2"],
    marginTop: t.space["4"],
    marginBottom: t.space["3"],
  },
  hero: {
    alignItems: "center",
    paddingTop: t.space["2"],
    paddingBottom: t.space["1"],
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    maxWidth: "100%",
  },
  name: {
    flexShrink: 1,
    fontFamily: t.fontFamily.displayBold,
    fontSize: 21,
    color: t.colors.text,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  handleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    maxWidth: "100%",
  },
  handle: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.textSubtle,
    textAlign: "center",
  },
  bio: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: t.colors.textMuted,
    marginTop: 8,
    textAlign: "center",
    maxWidth: 320,
  },
  affiliation: {
    marginTop: t.space["3"],
    marginHorizontal: t.space["4"],
  },
  socialRow: {
    marginTop: t.space["3"],
    marginHorizontal: t.space["4"],
  },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"] + 2,
    marginTop: t.space["4"],
    marginHorizontal: 2,
  },
  followAction: {
    flex: 1,
  },
  secondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 42,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  secondaryPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  secondaryText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14,
    color: t.colors.text,
  },
  blockedLabel: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 13,
    color: t.colors.textMuted,
  },

  overflowBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  confirmRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: t.space["4"],
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.scrimModal,
  },
  confirm: {
    width: "100%",
    maxWidth: 320,
    padding: t.space["4"],
    gap: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s3,
  },
  confirmText: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: t.colors.text,
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: t.space["2"],
  },
  confirmCancel: {
    paddingHorizontal: t.space["3"],
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
  },
  confirmCancelText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 13,
    color: t.colors.textMuted,
  },
  confirmBlock: {
    paddingHorizontal: t.space["3"],
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.brand.bloom,
  },
  confirmBlockText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.onAccent,
  },
  pressed: {
    opacity: 0.85,
  },

  events: {
    marginTop: t.space["5"],
  },
  eventsLabel: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: t.colors.textSubtle,
    marginBottom: t.space["2"],
  },
  eventsGroupLabel: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: t.colors.textSubtle,
    marginTop: t.space["2"],
    marginBottom: t.space["1"],
  },
  mini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 10,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    marginBottom: t.space["2"],
    ...t.shadows.s1,
  },
  miniPressed: {
    opacity: 0.9,
  },
  dateChip: {
    flexShrink: 0,
    width: 34,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: t.colors.sun["50"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.sun["100"],
    alignItems: "center",
  },
  dateDay: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: 15,
    lineHeight: 16,
    color: t.colors.sun["700"],
  },
  dateMonth: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 8,
    letterSpacing: 0.5,
    color: t.colors.sun["700"],
    marginTop: 2,
  },
  miniMeta: {
    flex: 1,
    minWidth: 0,
  },
  miniTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13.5,
    color: t.colors.text,
  },
  miniSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  miniSub: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },
  miniSubWhen: {
    flexShrink: 1,
  },
  miniSubDot: {
    marginHorizontal: 5,
  },

  postsLane: {
    marginBottom: t.space["5"],
  },
  postsState: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    color: t.colors.textSubtle,
    paddingVertical: t.space["2"],
  },
}))
