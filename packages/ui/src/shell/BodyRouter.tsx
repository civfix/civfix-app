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
  GetVerifiedBody,
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
  HostBroadcastQuickBody,
  MyTicketBody,
  OrgPageBody,
  MyDonationsBody,
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

function renderBodyId(id: BodyId, entry: DetailEntry | null): React.ReactNode {
  switch (id) {
    case "feed":
      return <FeedBody />
    case "events":
      return <EventsBody />
    case "messagingList":
      return <MessagingListBody />
    case "social":
      return <SocialBody />
    case "reports":
      return <ReportsBody />
    case "personDetail":
      return <PersonDetailBody id={entry?.id ?? ""} />
    case "reportDetail":
      return <ReportDetailBody id={entry?.id ?? ""} />
    case "eventDetail":
      return <EventDetailBody id={entry?.id ?? ""} />
    case "createCleanup":
      return <CreateCleanupBody />
    case "editCleanup":
      return <EditCleanupBody id={entry?.id ?? ""} />
    case "notifications":
      return <NotificationsBody />
    case "notificationPrefs":
      return <NotificationPrefsBody />
    case "conversation":
      return (
        <ConversationBody
          id={entry?.id ?? ""}
          roomKind={entry?.roomKind ?? "cleanup"}
          {...(entry?.peer ? { peer: entry.peer } : {})}
          {...(entry?.jumpToMessageId ? { jumpToMessageId: entry.jumpToMessageId } : {})}
        />
      )
    case "pinnedMessages":
      return (
        <ConversationBody
          id={entry?.id ?? ""}
          roomKind={entry?.roomKind ?? "cleanup"}
          pinnedOnly
        />
      )
    case "newGroup":
      return <NewGroupBody />
    case "newChannel":
      return <NewChannelBody />
    case "groupInfo":
      return <GroupInfoBody id={entry?.id ?? ""} />
    case "reportFlow":
      return <ReportFlowBody />
    case "clusterReports":
      return <ClusterReportsBody reports={entry?.reports ?? []} event={entry?.event ?? null} />
    case "getVerified":
      return <GetVerifiedBody />
    case "connections":
      return (
        <ConnectionsBody
          id={entry?.id ?? ""}
          mode={entry?.kind === "following" ? "following" : "followers"}
        />
      )
    case "leaderboard":
      return <LeaderboardBody geoid={entry?.geoid ?? ""} />
    case "members":
      return <MembersBody id={entry?.id ?? ""} roomKind={entry?.roomKind ?? "cleanup"} />
    case "profile":
      return <ProfileBody />
    case "blockedAccounts":
      return <BlockedAccountsBody />
    case "languageSettings":
      return <LanguageSettingsBody />
    case "appearanceSettings":
      return <AppearanceSettingsBody />
    case "settings":
      return <SettingsBody />
    case "settingsAccount":
      return <SettingsAccountBody />
    case "settingsPrivacy":
      return <SettingsPrivacyBody />
    case "mapView":
      return <View style={styles.empty} />
    case "search":
      return <SearchBody />
    case "post":
      return <PostDetailBody id={entry?.id ?? ""} />
    case "saves":
      return <SavedPostsBody />
    case "postThread":
      return <PostThreadBody id={entry?.id ?? ""} />
    case "postComposer":
      return <PostComposer mode={entry?.composerMode ?? "post"} targetPostId={entry?.targetPostId} />
    case "dropPin":
      return <DropPinBody lat={entry?.lat ?? null} lng={entry?.lng ?? null} />
    case "hostMode":
      return <HostModeBody id={entry?.id ?? ""} />
    case "hostCheckin":
      return <HostCheckinBody id={entry?.id ?? ""} />
    case "hostBroadcastQuick":
      return <HostBroadcastQuickBody id={entry?.id ?? ""} />
    case "myTicket":
      return (
        <MyTicketBody id={entry?.id ?? ""} {...(entry?.seatId ? { seatId: entry.seatId } : {})} />
      )
    case "orgPage":
      return <OrgPageBody slug={entry?.slug ?? ""} />
    case "myDonations":
      return <MyDonationsBody />
    case "stub": {
      const label = entry ? (entry.id ? `${entry.kind} #${entry.id}` : entry.kind) : "stub"
      return <Stub label={label} />
    }
  }
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
  return <>{renderBodyId(id, entry)}</>
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
