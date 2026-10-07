import React from "react"
import { StyleSheet, View } from "react-native"
import { makeThemedStyles, useTheme } from "../theme"
import { Text } from "../typography"
import { BlurSurface } from "../surface"
import {
  SocialBody,
  PersonDetailBody,
  ProfileBody,
  ConnectionsBody,
  LeaderboardBody,
  ReportsBody,
  ReportDetailBody,
  FeedBody,
  EventsBody,
  EventDetailBody,
  CreateCleanupBody,
  EditCleanupBody,
  NotificationsBody,
  NotificationPrefsBody,
  MessagingListBody,
  ConversationBody,
  ReportFlowBody,
  ClusterReportsBody,
  BlockedAccountsBody,
  LanguageSettingsBody,
  AppearanceSettingsBody,
  SettingsBody,
  SettingsAccountBody,
  SettingsPrivacyBody,
  MembersBody,
  NewGroupBody,
  NewChannelBody,
  GroupInfoBody,
  SearchBody,
  PostComposer,
  PostThreadBody,
  PostDetailBody,
  SavedPostsBody,
  DropPinBody,
  HostModeBody,
  HostCheckinBody,
  HostAnnounceBody,
  HostTeamBody,
  HostLogHoursBody,
  MyTicketBody,
  OrgPageBody,
  OrgManageBody,
  EventDashboardBody,
  AnnouncementBody,
  AnnouncementsBody,
  EventAnalyticsBody,
} from "../bodies"
import type { DetailEntry, View as NavView } from "../nav"
import { VIEW_BODY, DETAIL_BODY, type BodyId } from "./bodyRoutes"

function Stub({ label }: { label: string }) {
  const themed = useStyles()
  const t = useTheme()
  return (
    <View style={styles.center}>
      <BlurSurface kind="sheet" style={themed.card}>
        <Text variant="bodyStrong" color={t.colors.textMuted}>
          {label}
        </Text>
      </BlurSurface>
    </View>
  )
}

const idOf = (entry: DetailEntry | null): string => entry?.id ?? ""
const roomKindOf = (entry: DetailEntry | null) => entry?.roomKind ?? "cleanup"

type BodyRenderer = (entry: DetailEntry | null) => React.ReactNode

// Arrows rather than component factories: each body binding is read at render time, never while the
// bodies barrel may still be initialising behind the shell import it depends on.
const BODY_RENDERERS: Record<BodyId, BodyRenderer> = {
  feed: () => <FeedBody />,
  events: () => <EventsBody />,
  messagingList: () => <MessagingListBody />,
  social: () => <SocialBody />,
  reports: () => <ReportsBody />,
  personDetail: (entry) => <PersonDetailBody id={idOf(entry)} />,
  reportDetail: (entry) => <ReportDetailBody id={idOf(entry)} />,
  eventDetail: (entry) => <EventDetailBody id={idOf(entry)} />,
  createCleanup: () => <CreateCleanupBody />,
  editCleanup: (entry) => <EditCleanupBody id={idOf(entry)} />,
  notifications: () => <NotificationsBody />,
  notificationPrefs: () => <NotificationPrefsBody />,
  conversation: (entry) => (
    <ConversationBody
      id={idOf(entry)}
      roomKind={roomKindOf(entry)}
      {...(entry?.peer ? { peer: entry.peer } : {})}
      {...(entry?.jumpToMessageId ? { jumpToMessageId: entry.jumpToMessageId } : {})}
    />
  ),
  pinnedMessages: (entry) => <ConversationBody id={idOf(entry)} roomKind={roomKindOf(entry)} pinnedOnly />,
  newGroup: () => <NewGroupBody />,
  newChannel: () => <NewChannelBody />,
  groupInfo: (entry) => <GroupInfoBody id={idOf(entry)} />,
  reportFlow: () => <ReportFlowBody />,
  clusterReports: (entry) => <ClusterReportsBody reports={entry?.reports ?? []} event={entry?.event ?? null} />,
  connections: (entry) => (
    <ConnectionsBody id={idOf(entry)} mode={entry?.kind === "following" ? "following" : "followers"} />
  ),
  leaderboard: (entry) => <LeaderboardBody geoid={entry?.geoid ?? ""} />,
  members: (entry) => <MembersBody id={idOf(entry)} roomKind={roomKindOf(entry)} />,
  profile: () => <ProfileBody />,
  blockedAccounts: () => <BlockedAccountsBody />,
  languageSettings: () => <LanguageSettingsBody />,
  appearanceSettings: () => <AppearanceSettingsBody />,
  settings: () => <SettingsBody />,
  settingsAccount: () => <SettingsAccountBody />,
  settingsPrivacy: () => <SettingsPrivacyBody />,
  mapView: () => <View style={styles.empty} />,
  search: () => <SearchBody />,
  post: (entry) => <PostDetailBody id={idOf(entry)} />,
  saves: () => <SavedPostsBody />,
  postThread: (entry) => <PostThreadBody id={idOf(entry)} />,
  postComposer: (entry) => <PostComposer mode={entry?.composerMode ?? "post"} targetPostId={entry?.targetPostId} />,
  dropPin: (entry) => <DropPinBody lat={entry?.lat ?? null} lng={entry?.lng ?? null} />,
  hostMode: (entry) => <HostModeBody id={idOf(entry)} />,
  hostCheckin: (entry) => <HostCheckinBody id={idOf(entry)} />,
  hostAnnounce: (entry) => <HostAnnounceBody id={idOf(entry)} />,
  hostTeam: (entry) => <HostTeamBody id={idOf(entry)} />,
  hostLogHours: (entry) => <HostLogHoursBody id={idOf(entry)} />,
  myTicket: (entry) => <MyTicketBody id={idOf(entry)} {...(entry?.seatId ? { seatId: entry.seatId } : {})} />,
  orgPage: (entry) => <OrgPageBody slug={entry?.slug ?? ""} />,
  orgManage: (entry) => <OrgManageBody slug={entry?.slug ?? ""} />,
  eventDashboard: () => <EventDashboardBody />,
  eventAnalytics: (entry) => <EventAnalyticsBody id={idOf(entry)} />,
  announcements: (entry) => <AnnouncementsBody id={idOf(entry)} />,
  announcement: (entry) => <AnnouncementBody id={idOf(entry)} announcementId={entry?.announcementId ?? ""} />,
  stub: (entry) => <Stub label={entry ? (entry.id ? `${entry.kind} #${entry.id}` : entry.kind) : "stub"} />,
}

export interface BodyRouterProps {
  entry: DetailEntry | null
  view: NavView
}

export function BodyRouter({ entry, view }: BodyRouterProps) {
  const id = entry
    ? entry.kind === "view"
      ? VIEW_BODY[entry.view ?? view]
      : DETAIL_BODY[entry.kind]
    : VIEW_BODY[view]
  // A restored entry can name a body this build no longer has; such an entry renders nothing.
  const render: BodyRenderer | undefined = BODY_RENDERERS[id]
  return <>{render?.(entry)}</>
}

export const defaultRenderBody = (entry: DetailEntry | null, view: NavView): React.ReactNode => (
  <BodyRouter entry={entry} view={view} />
)

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  empty: {
    flex: 1,
  },
})

const useStyles = makeThemedStyles((t) => ({
  card: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
}))
