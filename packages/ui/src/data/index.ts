export {
  ApiProvider,
  useApi,
  useAuthState,
  useRequireAuth,
  useLogout,
  useSubmitReport,
  useGetTurnstileToken,
  useCartoApiKey,
  useChatSocket,
} from "./context"
export type { ApiProviderProps } from "./context"
export { normalizeAuthState, chatSendOutcome } from "./types"
export type {
  AuthState,
  RawAuthSignals,
  DataContextValue,
  ReportSubmission,
  ReportSubmitResult,
  ChatSocketLike,
  ChatConnState,
  ChatSendOutcome,
  ChatSendResult,
  LegacySendDeliveredResult,
  LegacySendDroppedResult,
} from "./types"
export {
  optimisticPatch,
  optimisticListPatch,
} from "./optimistic"
export type {
  OptimisticAlso,
  OptimisticPatchOptions,
  OptimisticListPatchOptions,
  OptimisticContext,
} from "./optimistic"
export { queryKeys } from "./keys"
export { invalidationKeysForTopic } from "./signals"
export {
  makeFakeDataContext,
  makeFakeApiClient,
  makeFakeChatSocket,
  FAKE_APPROXIMATE_LOCATION,
} from "./fakes"
export type { FakeDataContextOptions } from "./fakes"
export {
  useProfile,
  useMyProfile,
  useFollowPerson,
  useFollowSuggestions,
  useFollowers,
  useFollowing,
  useUpdateProfile,
  useHandleAvailability,
  useMentionSearch,
  useProfileEvents,
  useProfilePastEvents,
} from "./hooks"
export type { ProfilePastEvents } from "./hooks"
export {
  useUserSearch,
  normalizeUserSearchTerm,
  useOpenDm,
  useStartDm,
  useBlockUser,
  useListBlocks,
  useUnblockUser,
} from "./hooks"
export type { DmTarget, ResolvedDm, StartDmHandlers } from "./hooks"
export { useReportContent, useDeleteAccount, useRequestMyData, useRequestEmailCode } from "./hooks"
export { useMyReports, useReport, useResolveReport, useUnlistReport, useResolveJurisdiction, useNearbyReportPins, useNearbyReports, useReportSearch, useMapReports } from "./hooks"
export type { MapReportsArgs } from "./hooks"
export {
  NEARBY_RADIUS_KM,
  NEARBY_KEY_PRECISION,
  PIN_SPAN_MAX_DEG,
  bboxAround,
  roundNearbyCoord,
} from "./hooks"
export {
  useJoinReportChat,
  useLeaveReportChat,
  useReportChatParticipants,
  useToggleMute,
  useHideConversation,
  useMarkThreadRead,
} from "./hooks"
export {
  useCreateGroup,
  useJoinGroup,
  useGroupInfo,
  useGroupMembers,
  useUpdateGroup,
  useAddGroupMembers,
  useRemoveGroupMember,
  useSetGroupMemberRole,
} from "./hooks"
export { useReverseLabel, reverseLabelText, coordsLabel } from "./hooks"
export type { ReverseLabelPoint } from "./hooks"
export { useNearbyCleanups, useFeedNotifications, NEARBY_RADIUS_M, useUserLocation } from "./hooks"
export {
  useApproximateLocation,
  approximateLocationShouldRetry,
  APPROXIMATE_LOCATION_STALE_MS,
} from "./hooks"
export type { UseApproximateLocationOptions } from "./hooks"
export {
  useCleanups,
  useAttendingCleanups,
  useCleanup,
  useCleanupAttendees,
  useJoinCleanup,
  useCreateCleanup,
  useDuplicateCleanup,
  useUpdateCleanup,
  useCancelCleanup,
  useRequestEventResources,
  useSetMemberRole,
  useRemoveMember,
  useClaimEventSlot,
  useGuestRsvpRequest,
  useGuestRsvpVerify,
  useGuestRsvpCancel,
  useCleanupGuests,
  cleanupDetailFilters,
} from "./hooks"
export type {
  DuplicateCleanupVars,
  SetMemberRoleVars,
  RemoveMemberVars,
  ClaimEventSlotVars,
  GuestRsvpRequestVars,
  GuestRsvpVerifyVars,
} from "./hooks"
export {
  useNotifications,
  useMarkNotificationsRead,
  useNotificationPrefs,
  useUpdateNotificationPrefs,
  useUpdatePrivacySettings,
} from "./hooks"
export type { PrivacySettingsVars } from "./hooks"
export { useThreads, useTotalUnread, useChat } from "./hooks"
export type { UseChatResult, UseChatOptions, ChatRoomError, ComposerMedia } from "./hooks"
export {
  useMyHours,
  useJurisdictionLeaderboard,
  useLogEventHours,
  useMyHoursEntries,
  usePublicHoursEntries,
  useEventHours,
  useMyServiceHoursCertificates,
  useIssueServiceHoursCertificate,
  useRevokeServiceHoursCertificate,
  LEADERBOARD_PAGE_SIZE,
} from "./hooks"
export type { LogEventHoursVars, JurisdictionLeaderboardOptions } from "./hooks"

export {
  INVITABLE_EVENT_TEAM_ROLES,
  SETTABLE_EVENT_MEMBER_ROLES,
  eventRoleCapabilities,
  eventRoleLabelKey,
  settableRolesOtherThan,
} from "../bodies/host/eventTeamTiers"
export type { SettableEventMemberRole } from "../bodies/host/eventTeamTiers"

export {
  HOST_COUNTERS_POLL_MS,
  INSIGHTS_IDLE_POLL_MS,
  INSIGHTS_LIVE_POLL_MS,
  HOST_ROSTER_PAGE_SIZE,
  MY_EVENT_INVITES_PAGE_SIZE,
  actsAsHost,
  cleanupHostStanding,
  hasHostCapability,
  broadcastFanoutStarted,
  discardQuickBroadcast,
  hostedEventRows,
  invalidateHostEvent,
  invalidateMyEventInvites,
  legacyRoleCapabilities,
  managesEvent,
  myEventInviteRows,
  rosterRows,
  sameQuickBroadcastVars,
  sendQuickBroadcast,
  useAcceptEventTeamInvite,
  useAcceptMyEventInvite,
  useCancelEventRegistration,
  useCheckInEventSeat,
  useDeclineMyEventInvite,
  useEventInsights,
  useEventQuestions,
  useEventTicketTypes,
  useHostCounters,
  useHostRoster,
  useHostTeam,
  useHostWaitlist,
  useInviteEventTeamMember,
  useJoinEventWaitlist,
  useLeaveEventWaitlist,
  useMarkEventNoShows,
  useMyEventInvites,
  useMyEventTicket,
  useMyHostedEvents,
  useQuickBroadcast,
  useRegisterForEvent,
  useRevokeEventTeamInvite,
  useScanEventTicket,
  useUndoEventCheckIn,
  useWalkupRegistration,
} from "./hooks/host"
export type {
  CancelRegistrationVars,
  CleanupStandingSource,
  EventInsightsOptions,
  HostRosterOptions,
  HostStandingView,
  HostedEventsWindow,
  InviteEventTeamMemberVars,
  QuickBroadcastDiscard,
  QuickBroadcastPorts,
  QuickBroadcastResult,
  QuickBroadcastVars,
  RetainedQuickDraft,
} from "./hooks/host"

export {
  ORG_DONATION_EXPORTS_POLL_MS,
  ORG_MEMBERS_PAGE_SIZE,
  exportsPollInterval,
  actableOrganizations,
  invalidateMyOrgInvites,
  organizationEventRows,
  organizationMemberRows,
  useAcceptMyOrgInvite,
  useDeclineMyOrgInvite,
  useInviteOrganizationMember,
  useMyOrgInvites,
  useMyOrganizations,
  useOrganization,
  useOrganizationEvents,
  useOrganizationInvites,
  useOrganizationMembers,
  useOrgDonationExports,
  useRemoveOrganizationMember,
  useRevokeOrganizationInvite,
  useSetOrganizationMemberRole,
} from "./hooks/orgs"
export type {
  InviteOrganizationMemberVars,
  OrganizationEventsWindow,
  SetOrganizationMemberRoleVars,
} from "./hooks/orgs"

export { useHostedEventsAnalytics } from "./hooks/dashboard"

export {
  ORG_PAYOUTS_PAGE_SIZE,
  clearPayoutIntents,
  payoutRows,
  useCreateOrgPayout,
  useCreateOrgStripeAccountLink,
  useOrgBalance,
  useOrgDonationSummary,
  useOrgPaymentsStatus,
  useOrgPayouts,
} from "./hooks/payouts"
export type {
  CreateOrgPayoutVars,
  OrgDonationSummaryRange,
  OrgStripeAccountLinkKind,
} from "./hooks/payouts"

export { fetchEventIcs, useEventIcs } from "./eventIcs"

export {
  donationRows,
  donationsOffered,
  useMyDonationReceipt,
  useMyDonations,
  useOrgDonationPage,
} from "./hooks/donations"

export {
  CHECKIN_OUTBOX_KEY,
  CHECKIN_OUTBOX_MAX,
  CHECKIN_OUTBOX_TTL_MS,
  CHECKIN_RETRY_BACKOFF_MS,
  EMPTY_CHECKIN_OUTBOX,
  EMPTY_REPLAY_REPORT,
  checkinEntryId,
  checkinOutboxKey,
  dequeueReady,
  dropLegacyOutbox,
  enqueue,
  loadOutbox,
  markFailed,
  markSent,
  mergeQueued,
  parseOutbox,
  pending,
  pruneExpired,
  replayOutcome,
  replayReportNotable,
  replaySubject,
  runReplay,
  saveOutbox,
  serializeOutbox,
  summarizeReplay,
} from "./checkinOutbox"
export type {
  CheckinOutboxEntry,
  CheckinOutboxInput,
  CheckinOutboxMethod,
  CheckinOutboxState,
  CheckinReplayReport,
  ReplayAttempt,
  ReplayDeps,
  ReplayDisposition,
  ReplayDropReason,
  ReplayEvent,
  ReplayOutcome,
  ReplayRefusal,
  ReplayRun,
  ReplaySubject,
} from "./checkinOutbox"

export {
  UPLOAD_MIN_BYTES_PER_SEC,
  UPLOAD_PUT_BASE_TIMEOUT_MS,
  putUpload,
  uploadMedia,
  uploadMediaId,
  uploadPutTimeoutMs,
} from "./uploadMedia"
export type {
  UploadMediaInput,
  UploadPhase,
  UploadProgress,
  UploadedMedia,
} from "./uploadMedia"

export { randomId } from "./randomId"

export { NOW_TICK_MS, useNow } from "./useNow"
export type { UseNowOptions } from "./useNow"

export { useEventBoundaryRefresh } from "./useEventBoundaryRefresh"
