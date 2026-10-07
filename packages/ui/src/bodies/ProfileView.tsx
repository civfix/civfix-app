import React, { useEffect, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import type { UserProfileDTO, CleanupDTO } from "@civfix/shared"
import { makeThemedStyles, space, radius, headingLevel } from "../theme"
import { Text } from "../typography"
import {
  Avatar,
  DonateBlock,
  SocialLinksRow,
  SkeletonBlock,
  SkeletonGroup,
  SkeletonList,
  SkeletonText,
} from "../primitives"
import { useNavStore } from "../nav"
import { AffiliationRow } from "./AffiliationRow"
import { ProfileStatsRow } from "./ProfileStatsRow"
import {
  PROFILE_DEFAULT_TAB,
  buildProfileTabsModel,
  type ProfileTabId,
} from "./profileTabsModel"
import { ProfileEventsSection } from "./profile/ProfileEventsSection"
import { useProfilePastEvents } from "../data"
import { ProfilePostsSection, type ProfilePosts } from "./profile/ProfilePostsSection"
import { ProfileReportsSection, type ProfileReports } from "./profile/ProfileReportsSection"
import { ProfileTabBar } from "./profile/ProfileTabBar"
import { splitProfileEvents, type ProfileEventTab } from "./profile/profileEventSplit"

export type { ProfilePosts } from "./profile/ProfilePostsSection"
export type { ProfileReports } from "./profile/ProfileReportsSection"

export interface ProfileViewProps {
  profile: UserProfileDTO
  onOpenEvent?: (event: CleanupDTO) => void
  onOpenConnections?: (which: "followers" | "following") => void
  dashboardSlot?: React.ReactNode
  posts?: ProfilePosts
  onOpenSaved?: () => void
  reports?: ProfileReports
  hours?: React.ReactNode
}

export function ProfileView({
  profile,
  onOpenEvent,
  onOpenConnections,
  dashboardSlot,
  posts,
  onOpenSaved,
  reports,
  hours,
}: ProfileViewProps) {
  const styles = useStyles()
  const [eventTab, setEventTab] = useState<ProfileEventTab>("upcoming")
  const [requestedTab, setRequestedTab] = useState<ProfileTabId>(
    () => useNavStore.getState().active?.profileTab ?? PROFILE_DEFAULT_TAB,
  )
  const navProfileTab = useNavStore((s) =>
    s.active?.kind === "profile" ? s.active.profileTab : undefined,
  )
  const consumedNavTabRef = useRef<ProfileTabId | undefined>(navProfileTab)
  useEffect(() => {
    if (!navProfileTab || navProfileTab === consumedNavTabRef.current) return
    consumedNavTabRef.current = navProfileTab
    setRequestedTab(navProfileTab)
  }, [navProfileTab])
  const affiliation = profile.organization ?? null
  const heroSub = profile.handle ? `@${profile.handle}` : ""

  const pastEvents = useProfilePastEvents(profile)
  const eventSplit = useMemo(
    () => splitProfileEvents(pastEvents.events, profile.upcomingEvents, profile.id),
    [pastEvents.events, profile.upcomingEvents, profile.id],
  )

  const tabsModel = buildProfileTabsModel(requestedTab, {
    posts: posts != null,
    events: true,
    hours: hours != null,
    reports: reports != null,
  })
  const renderTab = (id: ProfileTabId): React.ReactNode => {
    switch (id) {
      case "posts":
        return posts ? <ProfilePostsSection posts={posts} onOpenSaved={onOpenSaved} /> : null
      case "events":
        return (
          <ProfileEventsSection
            split={eventSplit}
            tab={eventTab}
            onSelectTab={setEventTab}
            onOpenEvent={onOpenEvent}
            more={pastEvents}
          />
        )
      case "hours":
        return hours ?? null
      case "reports":
        return reports ? (
          <ProfileReportsSection reports={reports} totalCount={profile.stats.reports} />
        ) : null
      default:
        return null
    }
  }

  return (
    <View>
      <View style={styles.hero}>
        <Avatar
          name={profile.name}
          seed={profile.id}
          photoUrl={profile.avatarUrl}
          gradient={profile.avatar ?? null}
          size={64}
        />
        <View style={styles.heroWho}>
          <View style={styles.heroNameRow}>
            <Text style={styles.heroName} numberOfLines={1} accessibilityRole="header" {...headingLevel(2)}>
              {profile.name}
            </Text>
          </View>
          {heroSub ? (
            <Text style={styles.heroSub} numberOfLines={1}>
              {heroSub}
            </Text>
          ) : null}
        </View>
      </View>

      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      {affiliation ? <AffiliationRow organization={affiliation} style={styles.affiliation} /> : null}

      <SocialLinksRow links={profile.socialLinks} style={styles.socialRow} />

      <ProfileStatsRow
        followers={profile.followers}
        following={profile.following}
        stats={profile.stats}
        onOpenConnections={onOpenConnections}
      />

      <View style={styles.donate}>
        <DonateBlock url={profile.donationUrl} ownerName={profile.name} />
      </View>

      {dashboardSlot ? <View style={styles.dashboardSlot}>{dashboardSlot}</View> : null}

      <ProfileTabBar model={tabsModel} onSelect={setRequestedTab} />
      {renderTab(tabsModel.active)}
    </View>
  )
}

export function ProfileViewSkeleton() {
  const styles = useStyles()
  return (
    <SkeletonGroup>
      <View style={styles.hero}>
        <SkeletonBlock width={64} height={64} radius={32} />
        <View style={styles.heroWho}>
          <SkeletonText width="62%" height={20} />
          <SkeletonText width="38%" height={12} style={styles.skeletonHeroSub} />
        </View>
      </View>
      <View style={styles.skeletonBio}>
        <SkeletonText width="96%" height={12} />
        <SkeletonText width="72%" height={12} />
      </View>
      <View style={styles.skeletonStats}>
        <SkeletonBlock width="30%" height={44} radius={radius.md} />
        <SkeletonBlock width="30%" height={44} radius={radius.md} />
        <SkeletonBlock width="30%" height={44} radius={radius.md} />
      </View>
      <View style={styles.skeletonTabs}>
        <SkeletonBlock width={72} height={30} radius={radius.pill} />
        <SkeletonBlock width={72} height={30} radius={radius.pill} />
        <SkeletonBlock width={72} height={30} radius={radius.pill} />
      </View>
      <SkeletonList rows={3} kind="text" />
    </SkeletonGroup>
  )
}

const HEADER_BLOCK_GAP = space["3"]
const HEADER_CLUSTER_GAP = space["4"]

const useStyles = makeThemedStyles((t) => ({
  skeletonHeroSub: { marginTop: 5 },
  skeletonBio: { gap: t.space["2"], marginTop: HEADER_BLOCK_GAP },
  skeletonStats: {
    flexDirection: "row",
    gap: t.space["2"],
    marginTop: HEADER_CLUSTER_GAP,
  },
  skeletonTabs: {
    flexDirection: "row",
    gap: t.space["2"],
    marginTop: HEADER_CLUSTER_GAP,
    marginBottom: t.space["3"],
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"] + 2,
    paddingTop: t.space["2"],
  },
  heroWho: {
    flex: 1,
    minWidth: 0,
  },
  heroName: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: t.colors.text,
    flexShrink: 1,
    minWidth: 0,
  },
  heroSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
    marginTop: 1,
  },
  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  bio: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: t.colors.textMuted,
    marginTop: HEADER_BLOCK_GAP,
  },

  affiliation: {
    marginTop: HEADER_BLOCK_GAP,
  },

  donate: {
    marginTop: HEADER_CLUSTER_GAP,
  },

  socialRow: {
    marginTop: HEADER_CLUSTER_GAP,
  },

  dashboardSlot: {
    marginTop: HEADER_CLUSTER_GAP,
  },
}))
