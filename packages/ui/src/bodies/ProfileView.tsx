import React, { useEffect, useMemo, useRef, useState } from "react"
import { View, Pressable, StyleSheet, Linking } from "react-native"
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  socialLinkUrl,
  type SocialLinks,
  type UserProfileDTO,
  type CleanupDTO,
  type OrganizationRefDTO,
} from "@civfix/shared"
import { makeThemedStyles, space, radius, useTheme, noShadow, focusRingProps, headingLevel } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import {
  Avatar,
  SkeletonBlock,
  SkeletonGroup,
  SkeletonList,
  SkeletonText,
} from "../primitives"
import { useNavStore } from "../nav"
import { useT } from "../i18n"
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

function SocialLinksRow({ links }: { links: SocialLinks | null | undefined }) {
  const styles = useStyles()
  const { t } = useT("profile-view")
  if (!links) return null
  const present = SOCIAL_PLATFORMS.filter((platform) => {
    const value = links[platform]
    return typeof value === "string" && value.trim().length > 0
  })
  if (present.length === 0) return null
  return (
    <View style={styles.socialRow}>
      {present.map((platform) => {
        const value = (links[platform] as string).trim()
        const label = SOCIAL_PLATFORM_LABELS[platform]
        return (
          <Pressable
            key={platform}
            onPress={() => {
              void Linking.openURL(socialLinkUrl(platform, value)).catch(() => {})
            }}
            accessibilityRole="link"
            accessibilityLabel={t("social.link_a11y", { platform: label })}
            {...focusRingProps}
            style={({ pressed }) => [styles.socialChip, pressed ? styles.socialChipPressed : null]}
          >
            <Text style={styles.socialChipText}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export interface ProfileViewProps {
  profile: UserProfileDTO
  subtitle?: string
  onShare?: () => void
  onClose?: () => void
  onOpenEvent?: (event: CleanupDTO) => void
  onOpenConnections?: (which: "followers" | "following") => void
  actions?: React.ReactNode
  organization?: OrganizationRefDTO | null
  dashboardSlot?: React.ReactNode
  posts?: ProfilePosts
  onOpenSaved?: () => void
  reports?: ProfileReports
  hours?: React.ReactNode
}

export function ProfileView({
  profile,
  subtitle,
  onShare,
  onClose,
  onOpenEvent,
  onOpenConnections,
  actions,
  organization,
  dashboardSlot,
  posts,
  onOpenSaved,
  reports,
  hours,
}: ProfileViewProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("profile-view")
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
  const affiliation = organization ?? profile.organization ?? null
  const heroSub = subtitle ?? (profile.handle ? `@${profile.handle}` : "")

  const pastEvents = useProfilePastEvents(profile)
  const eventSplit = useMemo(
    () => splitProfileEvents(pastEvents.events, profile.upcomingEvents, profile.id, Date.now()),
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
        {onShare ? (
          <Pressable
            onPress={onShare}
            accessibilityRole="button"
            accessibilityLabel={t("hero.share_a11y")}
            hitSlop={6}
            {...focusRingProps}
            style={({ pressed }) => [styles.heroBtn, pressed ? styles.heroBtnPressed : null]}
          >
            <Icon icon={iconMap.Share} size={17} color={th.colors.text} />
          </Pressable>
        ) : null}
        {onClose ? (
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("hero.close_a11y")}
            hitSlop={6}
            {...focusRingProps}
            style={({ pressed }) => [styles.heroBtn, styles.heroBtnPlain, pressed ? styles.heroBtnPressed : null]}
          >
            <Icon icon={iconMap.Close} size={18} color={th.colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>

      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      {affiliation ? <AffiliationRow organization={affiliation} style={styles.affiliation} /> : null}

      <ProfileStatsRow
        followers={profile.followers}
        following={profile.following}
        stats={profile.stats}
        onOpenConnections={onOpenConnections}
      />

      <SocialLinksRow links={profile.socialLinks} />

      {dashboardSlot ? <View style={styles.dashboardSlot}>{dashboardSlot}</View> : null}

      {actions ? <View style={styles.actions}>{actions}</View> : null}

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
    fontSize: 13,
    color: t.colors.textSubtle,
    marginTop: 1,
  },
  heroBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s1,
  },
  heroBtnPlain: {
    backgroundColor: t.colors.bgAlt,
    borderColor: "transparent",
    ...noShadow,
  },
  heroBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.94 }],
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

  socialRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["2"],
    marginTop: HEADER_CLUSTER_GAP,
  },
  socialChip: {
    paddingVertical: 6,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  socialChipPressed: {
    opacity: 0.8,
  },
  socialChipText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 12.5,
    color: t.colors.accentText,
  },

  dashboardSlot: {
    marginTop: HEADER_CLUSTER_GAP,
  },

  actions: {
    flexDirection: "row",
    gap: t.space["3"],
    marginTop: HEADER_CLUSTER_GAP,
  },
}))
