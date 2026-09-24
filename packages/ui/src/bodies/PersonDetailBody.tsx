import React, { useCallback, useMemo, useState } from "react"
import { View } from "react-native"
import type { CleanupDTO } from "@civfix/shared"
import { useTheme } from "../theme"
import { Text, iconMap } from "../typography"
import { EmptyState } from "../primitives"
import type { PopoverMenuItem } from "../primitives"
import { useProfile, useStartDm, useProfilePastEvents } from "../data"
import { useUserPosts } from "../data/hooks/posts"
import { useNavStore } from "../nav"
import { useT } from "../i18n"
import { useScrollHost } from "../shell/ScrollHost"
import { pushCleanup } from "../nav/verbs"
import { ProfileTabBar } from "./profile/ProfileTabBar"
import { ServiceHoursSection } from "./profile/ServiceHoursSection"
import { PROFILE_DEFAULT_TAB, buildProfileTabsModel, type ProfileTabId } from "./profileTabsModel"
import { splitProfileEvents } from "./profile/profileEventSplit"
import { PersonActions } from "./personDetail/PersonActions"
import { PersonDetailSkeleton } from "./personDetail/PersonDetailSkeleton"
import { PersonEventsTab, hasPersonEvents } from "./personDetail/PersonEventsTab"
import { PersonHero } from "./personDetail/PersonHero"
import { PersonModerationLayer } from "./personDetail/PersonModerationLayer"
import { PersonPostsTab } from "./personDetail/PersonPostsTab"
import { usePersonModeration } from "./personDetail/usePersonModeration"
import { usePersonDetailStyles } from "./personDetail/personDetailStyles"
import { DetailBodyHeader } from "./DetailBodyHeader"

function PersonScroll({ children }: { children: React.ReactNode }) {
  const styles = usePersonDetailStyles()
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
  const styles = usePersonDetailStyles()
  const th = useTheme()
  const { t } = useT("profile-person")
  const { t: tNav } = useT("nav")
  const back = onBack ?? useNavStore.getState().back
  const { start } = useStartDm()
  const query = useProfile(id)
  const profile = query.data?.profile
  const postsQuery = useUserPosts(profile?.id)
  const pastEvents = useProfilePastEvents(profile)
  const profileId = profile?.id
  const upcomingEvents = profile?.upcomingEvents
  const pastEventList = pastEvents.events
  const eventSplit = useMemo(
    () => splitProfileEvents(pastEventList, upcomingEvents, profileId ?? ""),
    [pastEventList, upcomingEvents, profileId],
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

  const profilePath = `/people/${profile?.handle ?? id}`

  const onMessage = useCallback(() => {
    if (!profile?.id) return
    start(
      { id: profile.id, name: profile.name, handle: profile.handle },
      profilePath,
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
  }, [start, profilePath, profile?.id, profile?.name, profile?.handle])

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

  const moderation = usePersonModeration(profile?.id, profilePath)
  const { startBlock, onUnblock, startReport, unblockUser } = moderation

  const header = (
    <DetailBodyHeader
      title={profile?.name ?? tNav("title.person")}
      backLabel={tNav("a11y.back")}
      onBack={back}
      compactTitle="label"
    />
  )

  if (query.isLoading) {
    return (
      <View style={styles.root}>
        {header}
        <PersonScroll>
          <PersonDetailSkeleton />
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

  const hasEvents = hasPersonEvents(eventSplit)

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
    : profile.official
      ? [reportMenuItem]
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
        <PersonHero profile={profile} onOpenConnections={onOpenConnections} />

        <PersonActions
          profile={profile}
          profilePath={profilePath}
          onMessage={onMessage}
          menuAnchorRef={moderation.menuAnchorRef}
          menuOpen={moderation.menuOpen}
          onOpenMenu={moderation.openMenu}
        />

        <ProfileTabBar model={tabsModel} onSelect={setRequestedTab} />

        {tabsModel.active === "posts" ? (
          <PersonPostsTab
            loading={postsQuery.isLoading}
            error={postsQuery.isError}
            hasMore={postsQuery.hasNextPage}
            loadingMore={postsQuery.isFetchingNextPage}
            postItems={postItems}
            onLoadMorePosts={onLoadMorePosts}
          />
        ) : null}

        {tabsModel.active === "events" && !hasEvents ? (
          <Text style={styles.postsState}>{t("events.empty")}</Text>
        ) : null}
        {tabsModel.active === "events" && hasEvents ? (
          <PersonEventsTab eventSplit={eventSplit} pastEvents={pastEvents} onOpenEvent={onOpenEvent} />
        ) : null}

        {tabsModel.active === "hours" ? (
          <ServiceHoursSection
            variant="public"
            userId={profile.id}
            totalHours={profile.volunteerHours}
          />
        ) : null}
      </PersonScroll>

      <PersonModerationLayer name={profile.name} menuItems={menuItems} moderation={moderation} />
    </View>
  )
}
