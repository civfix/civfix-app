# @civfix/shared

## 0.53.0

### Minor Changes

- c6ac49c: City communications contract. New built-in forward-email defaults: `DEFAULT_FORWARD_SUBJECT_TEMPLATE` is `[civfix: {referenceCode}] {title}` and `DEFAULT_FORWARD_BODY_TEMPLATE` states that replies reach civfix operators and the reporter, lists photos inline via `{photoCount}` / `{photoLinks}` (which suppresses the backend's auto-appended photo block) and ends with the public pin URL. Three admin report-chat endpoints in the new `adminReportChatEndpoints` group: `adminReportMessages` (GET, reusing the citizen report-chat history request/response shapes), `adminSendReportMessage` (POST) and `adminRemoveReportMessage` (POST, mirroring `removeUserMessage`). Additive list facets: `needs_verification` on the admin report filter with an optional `needsVerification` count, `user_report` on the moderation filter, `deleted` and `banned` on the users filter with optional matching counts, and optional `moderationQueue` / `inboxUnread` totals on the admin home summary.

## 0.52.0

### Minor Changes

- Forward-email templates become a real, validated, previewable system. `forward-template.ts` adds
  `DEFAULT_FORWARD_SUBJECT_TEMPLATE` / `DEFAULT_FORWARD_BODY_TEMPLATE` (the built-in default as a
  template string), `FORWARD_TEMPLATE_SAMPLE_VALUES` (the static sample every preview renders with),
  `FORWARD_TEMPLATE_VARIABLE_NAMES`, `forwardTemplateIssues` / `describeForwardTemplateIssue`,
  `templateUsesToken`, and `ForwardTemplateSubjectSchema` / `ForwardTemplateBodySchema`, which
  `SaveContactsRequest` and `PatchJurisdictionRequest` now use - a template containing an unknown
  `{token}` or any `{{double-brace}}` is rejected at the boundary. The palette drops `{reporterName}`
  (the packet never names the reporter) and `{dept}` (no department is modelled). Three admin
  endpoints: `getForwardTemplateDefault` (`GET /admin/mail/forward-template`),
  `setForwardTemplateDefault` (`PUT /admin/mail/forward-template`) and `previewForwardTemplate`
  (`POST /admin/mail/forward-template/preview`); registry 318 -> 321. `RouteReportRequest` drops
  `contactEmailOverride` - a report is routed only to its jurisdiction's contact on file.
  `admin/common.ts` adds `ADMIN_REPORT_STATUS_TRANSITIONS` + `canTransitionReportStatus`, the one
  report status machine the backend enforces and the admin UI renders. `MailMessageDTO` gains
  `delivery` (`pending | sent | failed | null`) and `ReportOutreach` gains an optional `sendFailed`. Versions 0.49.0-0.51.0 on the registry were published
  from the feed-and-polish branch, whose entries now sit below this one. See DECISIONS §51.

## 0.51.0

### Minor Changes

- 4559605: Address system contract: street-level resolve endpoint, precision ladder, address provenance.

  - New `resolveAddress` endpoint (`POST /map/resolve-address`, auth optional, csrf false, v1) with `ResolveAddressRequestSchema` (strict lat/lng) and `ResolveAddressResponseSchema` (`address`, `precision`, `cityStateLabel`). `reverseLabel` is unchanged. Registry 323 -> 324.
  - New enums in `entities.ts`: `AddressPrecisionSchema` (`street | intersection | landmark | locality`), `EventAddressSourceSchema` (`resolved | edited | manual`), `ReportAddressSourceSchema` (`resolved | user`).
  - `CleanupDTO.addressSource`, `CreateCleanupRequest.addressSource`, `UpdateCleanupRequest.addressSource` (all optional; `address` stays wire-optional for old clients).
  - `ReportDTO.addrSource` and `ReportDTO.addrPrecision` (both optional).
  - New `@civfix/shared/address` helpers: `ADDRESS_PRECISION_LADDER`, `isLocatedPrecision`, `needsNearPrefix`, `comparePrecision`, `isVerifiedEventAddress`, `isVerifiedReportAddress`, `roundGeocodeCoord`, `geocodePointKey`.
  - Named length caps: `MAX_EVENT_ADDRESS_LENGTH` (200), `MAX_REPORT_ADDR_LENGTH` (300, now applied to the anon report request too).

## 0.50.0

### Minor Changes

- 391d01c: Event announcements and one consolidated event-analytics read, both additive.

  Announcements ride the existing broadcast pipeline as `BroadcastKind` `announcement` (appended
  last): `AnnouncementDTO`, `AnnouncementAudience` (a `BroadcastSegment` subset proved by
  `announcementAudienceToSegment`) and three endpoints — `createEventAnnouncement`
  (POST `/cleanups/:id/announcements`, auth required, csrf), `listEventAnnouncements` and
  `getEventAnnouncement` (GET, auth optional, since an announcement is public event content whose
  audience decides who is notified, not who may read). Delivery counts and the audience snapshot are
  optional fields present only on the host projection.

  New `getEventAnalytics` (`GET /cleanups/:id/analytics`, auth required, `scope=card|full`) answers
  the dashboard card and the analytics page in one round trip, composing the existing `SeriesPoint`,
  `Panel`, `SuppressedRate` and `FunnelStep` schemas and keeping `ANALYTICS_SUPPRESSION_K`. The five
  per-panel `eventAnalytics*` endpoints are unchanged. Registry 319 → 323; see DECISIONS §48 and §49.

## 0.49.0

### Minor Changes

- 3872b02: Admin report list rows carry a presigned `thumbnailUrl`

  `AdminReportListItemDTO` gains `thumbnailUrl`: a presigned preview of the report's first ready image asset (the pipeline thumbnail when one exists, else the served image), so the admin reports list can render the report's own photo instead of the category pin. Nullable and defaulted to `null`, so a report with no usable image and a response from a server that does not yet send the field both parse unchanged.

- 2d59670: Feed ranking contract: scored cursor, counts endpoint, realtime topics, `FEED_RANKING` schema

  `GET /feed/home` keeps its method, path, query and response schemas; its `nextCursor` may now be a
  ranked `"<score>|<postId>"` cursor alongside the legacy `"<iso>|<postId>"` one, and the contract
  owns the codec (`FeedScoreCursorSchema`, `formatFeedScoreCursor`, `parseFeedScoreCursor`,
  `quantizeFeedScore`, `isAfterFeedScoreCursor`, `FEED_SCORE_CURSOR_PRECISION`) so both forms stay
  unambiguous and the continuation predicate has one definition.

  New `getFeedCounts` (`POST /feed/counts`, auth required, no CSRF) takes up to
  `FEED_COUNTS_MAX_IDS` post ids and returns counts only, with unreadable ids simply absent —
  registry 318 → 319. `SignalTopicSchema` gains `feed` and `feed_counts` with `UserSignalSchema`
  unchanged, so a stale client drops the new frames instead of failing. `FeedRankingConfigSchema` /
  `FeedRankingConfig` / `DEFAULT_FEED_RANKING` add the strict, fully defaulted 27-knob ranking
  profile that the backend loads from a JSON `FEED_RANKING` env var. All additive; see DECISIONS §47.

## 0.48.2

### Patch Changes

- terms of service and privacy policy 2026-09-21: the civfix software is AGPL-3.0 open source, and the operator is named as Reach Out Los Angeles Inc.

## 0.48.1

### Patch Changes

- legal document versions for the donation-link terms

## 0.48.0

### Minor Changes

- b630ce6: remove platform-processed donations; add donationUrl to organizations and people

## 0.47.0

### Minor Changes

- 0225dfd: approximate location endpoint

## 0.46.0

### Minor Changes

- Event status becomes a clock reading and event times gain a zone. Registry unchanged at 344; every
  change is additive. `host/phase.ts` adds `DEFAULT_EVENT_DURATION_MS` (with `DEFAULT_DURATION_MS` kept
  as its alias), `EventWindowLike`, `eventStartsAtMs`, `eventEndsAtMs`, `hasEventStarted`,
  `hasEventEnded`, `deriveCleanupStatus`, `HostStage` + `hostStage` and `nextEventBoundaryMs`;
  `eventPhase` is now time-only (the `status === "done"` short-circuit is gone) and `EventPhaseClock`
  keeps `completedAt` but no helper reads it. `datetime.ts` adds the zone layer — `WallClock`,
  `zoneOffsetMs`, `wallClockInZone`, `wallClockToInstantMs`, `wallClockExistsInZone`, `zoneShortName`,
  `sameOffsetAt`, `isValidTimeZone`, `supportedTimeZones`, `COMMON_TIMEZONES` — plus an optional
  trailing `timeZone` on `eventChip`, `dowLabel`, `timeLabel` and `timeRangeLabel`, and the composed
  `EventWhenParts` / `eventWhenParts` / `eventWhenLabel`. `LinkedEventRefSchema` gains
  `timezone: string | null`, and `schemas/cleanups.ts` exports `MIN_EVENT_DURATION_MINUTES`,
  `MAX_EVENT_DURATION_MINUTES` and `DEFAULT_EVENT_DURATION_MINUTES` as the single source for the event
  window bounds. See DECISIONS §40-42.

## 0.45.0

### Minor Changes

- 6c6808e: Host tools batch. Slots may be shifts: `EventSlotDTO`/`EventSlotInput` gain `startsAt`/`endsAt` (both-or-neither, ≥ `MIN_SLOT_DURATION_MINUTES`, inside the event window; `MAX_GENERATED_SHIFTS`). Hours by organization: `OrganizationDTO` gains `volunteerHours`/`volunteerCount`; `MyVolunteerHoursDTO` and `PublicVolunteerHoursResponse` gain `byOrganization: OrgHoursDTO[]`; `EventInsights` gains `topVolunteers`; `HostedEventsAnalyticsResponse` gains `totalHours`, `volunteersCredited`, `topVolunteers`; `HostedEventDTO` gains `hoursCredited`. `LeaderboardEntryDTO` moves to `entities.ts` (re-exported from `volunteer.ts`, same names). `timeRangeLabel` added to `datetime`. All additive; registry unchanged.
- 5686580: `listReplies` gains `authorReplies`: for each listed reply the focal post's author has answered, their most recent answer. The thread screen inlines one under its parent as a connected row; deeper replies stay on that reply's own thread.

## 0.44.0

### Minor Changes

- 33b7792: Semantic colour tokens: `tokens.color.semantic` (selection, danger, success and chart roles) in both
  schemes, with per-scheme contrast floors asserted in the token tests (DECISIONS §37). Additive — no
  existing token changes value.
- 7387f8a: `getEventInsights` (`GET /cleanups/:id/insights`): one per-event host read with exact seat counts, a
  registration trend, per-ticket-type and per-source seats, the broadcast log, arrival offsets, credited
  hours, donations and returning volunteers, plus `EventPhaseSchema` and `eventPhase()` in
  `@civfix/shared/host` as the one phase vocabulary (DECISIONS §36). Portfolio analytics report exact
  values for roster-capable viewers; the response shape is unchanged. `money.netMinor` is a signed
  integer so a fully refunded event can report the processor fee it kept.
- 21ce583: Lighten the light neutral ramp: paper #EDE6D8 -> #F4EFE6, paper2 #E5DDCD -> #EAE3D6, cardTint #F8F1E4 -> #FAF6EE, ink5 #ECE5D8 -> #E6DFD2. The dark scheme is unchanged.

## 0.43.0

### Minor Changes

- Organization affiliation, the event dashboard contract and org payouts; the "verified community
  organizer" system is retired. Registry 337 -> 343 (of which 107 are admin, down from 108):
  `myVerification` and `setUserVerified` REMOVED, `listOrganizationEvents`, `duplicateCleanup`,
  `listMyOrgInvites`, `acceptMyOrgInvite`, `declineMyOrgInvite`, `getOrgBalance`, `createOrgPayout`
  and `listOrgPayouts` ADDED. See DECISIONS §34.

  BREAKING within 0.x (deliberate, §34): `schemas/verification.ts` is deleted
  (`VerificationStatusSchema`, `MyVerificationDTOSchema`, `GetMyVerificationResponseSchema`), along
  with `SetUserVerifiedRequest`, `PersonDTO.verified`, `LeaderboardEntryDTO.verified`,
  `AdminUserDTO.verificationStatus` and the `verification` value of `MediaPurpose`.
  `VolunteerHoursCreditor.verified` becomes `organization?: OrganizationRefDTO | null`. ORG
  verification (`OrgVerificationStatus`/`Kind`, `OrganizationRefDTO.verified`, the admin queue, the
  donations gate) and `reportVerified` are UNCHANGED.

  Affiliation: `PersonDTO.organization?: OrganizationRefDTO | null` (the primary affiliation badge),
  `UserDTO.primaryOrganizationId?: string | null`, `UpdateSettingsRequest.primaryOrganizationId`.
  Posting as an org: `PostComposeInput.organizationId?` (refused on `kind:"repost"` by a
  `superRefine`), `PostDTO.organization?` and `PostRefDTO.organization?`.

  Enums (mirrored byte-identical by the backend value arrays): `OrganizationInviteStatusSchema`
  appends `declined` LAST; `NotificationTypeSchema` appends `org_invite` LAST; new
  `PayoutStatusSchema = pending | in_transit | paid | failed | canceled`. `MediaPurposeSchema` drops
  `verification` (the one non-append change, per §34).

  Capabilities: `HostCapabilitySchema` appends `manage_org_members` LAST (19 values), and
  `ORG_ADMIN` gains that - NOT the event-team `manage_team`, which would have let an org admin seat
  a cohost on any org event and inherit the `export` this release withholds from admins. Org owner
  and admin hold `manage_org_members` (list / invite / revoke the org roster); role changes and
  removals stay owner-only, matching the web console. See §34.

  Org invite inbox (`schemas/host/organizations.ts`), mirroring §33's event-invite trio:
  `PendingOrganizationInviteDTO` (`{ id, organization, role, invitedBy, createdAt, expiresAt }`, no
  email field), `listMyOrgInvites` (`GET /me/org-invites`), `acceptMyOrgInvite`
  (`POST /me/org-invites/:inviteId/accept`, token-free, answers `AcceptOrganizationInviteResponse`),
  `declineMyOrgInvite` (`POST /me/org-invites/:inviteId/decline`). The emailed
  `acceptOrganizationInvite` token path is unchanged.

  Public org events: `listOrganizationEvents` (`GET /orgs/by-slug/:slug/events`, auth optional,
  `when=upcoming|past`, keyset-paged, limit <= 50) -> `pageResponse(CleanupDTO)`, public visibility
  only, §32 suspension rule.

  Duplicate event: `duplicateCleanup` (`POST /cleanups/:id/duplicate`) with
  `DuplicateCleanupRequestSchema` (`{ id, scheduledAt, endsAt?, includeTicketTypes = true,
includeQuestions = true, includePage = false }`), answering the same shape as `createCleanup`.

  Payments (`schemas/payments.ts`, §26 amended by §34 - civfix still never holds funds): `PayoutDTO`,
  `OrgBalanceDTO`, `getOrgBalance`, `createOrgPayout` (required uuid `idempotencyKey`) and
  `listOrgPayouts`. The `Payments` seam gains `retrieveBalance`, `createPayout` and `listPayouts`,
  all executed on the org's connected account, with matching `FakePayments` implementations.

  Admin: `AdminUserDTO.organizations?` (`{ id, slug, name, role }[]`) replaces the removed
  `verificationStatus`.

## 0.42.0

### Minor Changes

- Event collaborators: a third invitable tier and an invitee-side invite inbox. Additive: 3 new
  endpoints (registry 334 -> 337, of which 108 are admin), no existing shape tightened. Every new
  response field is optional, nullable or defaulted, so a payload from a 0.41.0 server still parses.

  Enums (mirrored byte-identical by the backend value arrays): `CleanupMemberRoleSchema` appends
  `coordinator` LAST (the day-of tier between `cohost` and `staff`); `EventTeamRoleSchema` becomes
  `cohost | staff | coordinator`, still append-last and still a subset of `CleanupMemberRole` in the
  same relative order; `EventTeamInviteStatusSchema` appends `declined` LAST (the invitee refusing,
  distinct from the host's `revoked`); `NotificationTypeSchema` appends `event_team_invite`;
  `SetMemberRoleRequestSchema.role` accepts `coordinator`.

  Capabilities (`host/capabilities.ts`, DECISIONS §33): `coordinator` holds `view_event_private`,
  `view_roster`, `view_answers`, `view_analytics`, `check_in`, `broadcast`, `moderate_chat` - derived
  as `COHOST_CAPABILITIES` minus `view_guest_contact`, `manage_event`, `manage_tickets`,
  `manage_page`, `export`. It never reads attendee contact details and can never export.
  `HostCapability` itself is unchanged (still 18 values).

  Invitee inbox (`schemas/host/team.ts`, `hostEndpoints`): `PendingEventTeamInviteDTO`
  (`{ id, role, event, invitedBy, createdAt, expiresAt }`, no email field) over the new
  `InviteEventRef` in `schemas/entities.ts` (`id`, `title`, `startsAt`, `endsAt`, `status`,
  `coverThumbUrl`, `address`), `listMyEventInvites` (`GET /me/event-invites`, paginated),
  `acceptMyEventInvite` (`POST /me/event-invites/:inviteId/accept`, token-free, answers the SEATED
  role plus the `CleanupDTO`), `declineMyEventInvite`
  (`POST /me/event-invites/:inviteId/decline`). `acceptEventTeamInvite` (the emailed token path) is
  unchanged.

  Consumes `@civfix/shared` `^0.42.0`.

## 0.41.0

### Minor Changes

- Admin org management and organization invites. Additive: 12 new endpoints (registry 322 -> 334, of
  which 108 are admin), no existing shape tightened. Every new response field is optional, nullable or
  defaulted, so a payload from a 0.40.0 server still parses.

  Admin (`schemas/admin/orgs.ts`, `hostAdminEndpoints`, DECISIONS §32): `adminListOrgs`
  (`GET /admin/orgs`, facets `verified`/`kind`/`suspended`/`donationsEnabled`, page-one `counts`),
  `adminCreateOrg` (`POST /admin/orgs`, owner by `ownerUserId`, optional `verifiedKind` creates the org
  already verified), `adminUpdateOrg` (`PATCH /admin/orgs/:id`, incl. `slug`), `adminSetOrgSuspended`
  (`POST /admin/orgs/:id/suspend`), `adminListOrgMembers` / `adminAddOrgMember`
  (`/admin/orgs/:id/members`; `role: "owner"` is an ownership transfer), `adminSetOrgMemberRole` /
  `adminRemoveOrgMember` (`/admin/orgs/:id/members/:userId`), `adminListOrgEvents`
  (`GET /admin/orgs/:id/events`, `when` facet, rows are `AdminEventListItemDTO`). Every mutation
  carries a mandatory audit `reason`. `AdminOrgDTO` gains optional `suspendedAt`, `suspendedReason`,
  `updatedAt`, `socialLinks`, `logoMediaId`.

  Host (`schemas/host/organizations.ts`, `hostEndpoints`): `OrganizationInviteDTO` (pending org
  membership invite, mirrors event team invites), `listOrganizationInvites` (`GET /orgs/:id/invites`),
  `revokeOrganizationInvite` (`DELETE /orgs/:id/invites/:inviteId`), `acceptOrganizationInvite`
  (`POST /org-invites/accept`, `{ token }` only; its response `role` is the accepter's seated role,
  `owner|admin|member`, since an existing owner keeps their seat). `InviteOrganizationMemberResponse` gains optional
  `invite`. `MAX_ORG_INVITES_PER_ORG = 50`. `OrganizationDTO` gains optional `suspended`.

  Consumes `@civfix/shared` `^0.41.0`.

## 0.40.0

### Minor Changes

- Event host platform contract. Additive: 111 new endpoints (registry 211 -> 322, of which 99 are
  admin), seventeen new schema modules, and no existing shape tightened. Every new response field is
  optional, nullable or defaulted, so a payload from an older server still parses.

  Enums (`schemas/common.ts`, all mirrored byte-identical by the backend value arrays):
  `CleanupMemberRoleSchema` appends `staff` LAST (day-of helper - roster read + check-in only);
  `MediaPurposeSchema` appends `event_cover`, `event_gallery`, `org_logo`; `NotificationTypeSchema`
  appends `event_broadcast`; `SignalTopicSchema` appends `host`. New: `EventVisibility`,
  `OrganizationMemberRole`, `OrgVerificationStatus`/`Kind`, `TicketTypeVisibility`,
  `RegistrationStatus`/`Source`, `SeatStatus`, `CheckinMethod`, `WaitlistStatus`,
  `EventQuestionKind`, `EventPageStatus`/`BlockKind`, `ThemeAccent`, `HostExportKind`/`Status`,
  `HostCapability` (18 values, plus `HOST_CAPABILITY_VALUES`), `BroadcastKind`/`Status`/`Channel`,
  `DeliveryStatus`, `BroadcastSegment` (a seven-branch discriminated union, deliberately not
  compound), `PageViewSource`, `DonationStatus`, `DonationDisputeState`, `OrgPaymentsState`,
  `DonateState`, `EligibilityVerdict`, `EligibilitySource`, `LegalDocumentType`, `ConsentSurface`.

  Cross-domain DTOs (`schemas/entities.ts`): `MoneyDTO` (`{ amountMinor, currency: "USD" }` -
  integer minor units, no float anywhere), `FeeBreakdownDTO`, `LegalDocumentVersionDTO`,
  `OrganizationDTO` (+ optional `donationsEnabled`, `donateSlug`), `OrganizationRefDTO`,
  `OrganizationMemberDTO`, `TicketTypeDTO`, `EventSeatDTO`, `EventAnswerDTO`,
  `EventRegistrationDTO`, `MyEventRegistrationRef`, `EventPageBlock` (ten block kinds, capped at 24
  per page), `EventPageDTO`, `HostedEventDTO`, `BroadcastDTO`, `DonationDTO`. `CleanupDTO` gains
  `endsAt`, `timezone`, `visibility` (default `public`), `coverUrl`, `galleryUrls`, `donationUrl`,
  `donationClicks`, `donationOrg`, `pageSlug`, `pageStatus`, `registrationOpensAt`/`ClosesAt`,
  `capacity`, `organization`, `ticketTypes`, `registrationState`, `myRegistration`,
  `myCapabilities` and the host counters - all optional or defaulted.

  New modules: `schemas/host/{organizations,team,tickets,questions,registrations,waitlist,checkin,
pages,portfolio,exports,broadcasts,analytics}.ts`, `schemas/payments.ts`, `schemas/legal.ts`, and
  the admin surfaces `schemas/admin/{orgs,pages,hosts,payments}.ts`. All are re-exported from the
  root barrel.

  Guest RSVP extends rather than forking: `GuestRsvpRequest`/`Verify` gain optional `ticketTypeId`,
  `partySize`, `accessCode`, `answers` and `consent`, and the verify response gains `registration`
  and `ticketTokens` (defaulted `[]`). No guest-only endpoint was added.

  `ErrorCode` gains exactly one member, `PAYMENT_UNAVAILABLE` (503, with an `AppError`
  factory), for payments disabled / organization blocked / ineligible / processor 5xx. No
  `PAYMENT_DECLINED`, `ORG_NOT_ELIGIBLE` or `AMOUNT_OUT_OF_RANGE`: amounts are `VALIDATION.fields`,
  a missing organization is `NOT_FOUND`, stale consent is `CONFLICT`.

  `NotificationPrefsDTO` gains `hostBroadcasts`, DEFAULTED to `true` so an older server's prefs
  response still parses and the shallow `.partial()` `UpdateNotificationPrefsRequest` keeps
  accepting a patch that omits it.

  BREAKING-ADJACENT, deliberately: `UpdateCleanupRequestSchema` gains a REQUIRED `id: IdSchema` so
  the `PATCH /cleanups/:id` path param has a home (the backend merges the path id into the body
  before parse, exactly as `cancelCleanup` already does). This retires the last entry in
  `endpoints.test.ts`'s ":param with no request key" allowlist, which is now empty, and retires the
  `as unknown as` cast in `@civfix/ui`'s `updateCleanup` hook. Callers already passed `id`; they now
  pass it to a schema that declares it.

  `endpoints` is now COMPOSED from four sub-registries - `coreEndpoints`, `hostEndpoints`,
  `paymentsEndpoints`, `hostAdminEndpoints` - and typed as their intersection. A single object
  literal of 310 entries exceeds the TS7056 declaration-serializer cap; the intersection of four
  named `typeof`s stays short while every per-endpoint request/response type remains exact, and the
  runtime value is an ordinary merged object. Every new deep DTO is likewise pre-annotated as
  `z.ZodType<T, z.ZodTypeDef, unknown>` (the treatment `PostRefDTOSchema` needed in 0.39.0);
  `CleanupDTOSchema` is one of them, so `.shape`/`.extend` on it (used nowhere) would need the
  underlying object schema.

  Backend-integration follow-ups (also additive; they close the gaps the admin console and the
  ticket surface hit against the first cut of this contract):

  - The admin plane reaches the API ONLY through `/v1/admin/*` — the Access-gated edge site proxies
    nothing else — so three reads it needed had no reachable route. Added `adminGetMedia`
    (`GET /admin/media/:id`, AUDITED, short-lived signed URL regardless of the asset's lane, which is
    what makes showing an operator someone's identity document defensible), `adminGetEventPage`
    (`GET /admin/pages/:id`, the page CONTENT at ANY status — `getPublicEventPage` 404s an
    unpublished or flagged page by design, which is exactly the page an operator must read), and
    `adminGetLegalVersions` (`GET /admin/legal/versions`, the same document set the public route
    serves). The alternative — widening the edge matcher to `/v1/media/*`, `/v1/pages/*` and
    `/v1/legal/*` — was rejected: it would have left the flagged-page read broken anyway and made an
    unaudited media read reachable from the operator host.
  - `adminListHosts` (`GET /admin/hosts`) makes host-messaging suspension READABLE. It was
    write-only: `SetHostMessagingSuspendedResponse` returned the new state and nothing read the
    current one, so the console had to offer both Suspend and Restore and say it did not know which
    applied. It also carries server-computed activity counters over an explicit `windowDays`,
    replacing a client-side window over however many broadcast pages an operator had loaded.
    `AdminBroadcastListQuery` gains `createdBy`, `from` and `to` for the same reason.
  - `adminDonationTotalsByOrg` (`GET /admin/donations/summary`, `from`+`to` required) computes
    per-organization period totals server-side. `AdminDonationListResponse.totals` is platform-wide
    for the current filter, so a California AG Form PL-4 artifact was being aggregated across
    whatever pages a human clicked; a filing must not depend on that. The response has no cursor by
    design — it caps at 500 organizations and sets `truncated` instead, because a partially-paged
    filing total is worse than a missing one.
  - `adminGetPlatformDonationSettings` (`GET /admin/payments/settings`) exposes the CA AG
    registration number and the fee/amount configuration at the PLATFORM level. It previously
    existed only on the per-organization public donate page, and reading a platform fact off one
    charity's public page would have been wrong. No secret is included.
  - `AdminPaymentsEligibilityRowDTO` gains `donationsDisabledReason`, so the eligibility queue can
    say WHY donations are off instead of rendering a neutral pill. `AdminOrgDTO.paymentsState` is
    narrowed from `z.string()` to `OrgPaymentsStateSchema` — the field is new in this unpublished
    version and no consumer has ever seen a value outside the enum.
  - Eligibility operator actions (three admin endpoints, csrf, operator scope):
    `adminSetOrgEligibilityEin` (`POST /admin/orgs/:id/payments/eligibility/ein`) sets or corrects
    the EIN an organization is screened under, `adminConfirmOrgCentralOrg`
    (`POST /admin/orgs/:id/payments/eligibility/central-org`) records or withdraws the
    central-organization confirmation a group-exemption subordinate needs, and
    `adminEvaluateOrgEligibility` (`POST /admin/orgs/:id/payments/eligibility/evaluate`) queues an
    on-demand screen + verdict. `AdminPaymentsEligibilityRowDTO` gains optional `einSource`
    (`EinSourceSchema`: `org_verification` | `operator`), `groupExemptionSubordinate` and
    `centralOrgConfirmedAt`; `AdminPlatformDonationSettingsDTO` gains optional
    `reviewRequiredBlocks`.
  - `@civfix/shared/payments` eligibility: `review_required` (an OFAC name hit) no longer counts as
    blocking by itself — `isDonationEligible(result, { reviewRequiredBlocks })` and the new
    `verdictPermitsDonations(verdict, options)` default to `REVIEW_REQUIRED_BLOCKS_DONATIONS =
false` (counsel flips the constant to block). `EligibilityEvidence` gains optional
    `pub78Checked` / `bmfChecked`, and an `unknown` verdict now says
    `positive_sources_not_yet_checked` when neither positive list has been screened yet, versus
    `no_positive_listing` when a screen ran and found nothing. `review_required` is reachable ONLY
    from an otherwise eligible state (an unlisted organization with an SDN name collision stays
    `unknown`, reasons `[..., "ofac_sdn_match"]`), and `EligibilityResult.contributionsDeductible`
    carries deductibility as a property of the exemption evidence so receipts and donate pages stop
    inferring it from the verdict. Both additive.
  - `getEventIcs` (`GET /cleanups/:id/ics`, auth optional) returns the calendar entry for one event
    and fills `MyEventTicketDTO.icsUrl`, which had no endpoint to point at. The document is returned
    INSIDE the JSON envelope (`{ ics, filename }`) rather than as a `text/calendar` body: every
    versioned path in this contract is a typed JSON endpoint, and a second content type on one route
    would make the generated client lie about what it returns. The read rides the same visibility
    gate as `getCleanup`, so a private event 404s before it can leak a title or address.
  - `eventIcsUid(cleanupId)` (`@civfix/shared/ics`) — `cleanup-<id>@civfix.org`, the UID every builder
    of an event's calendar file must use. The server, the ticket screen's offline fallback and the
    public signup page all produce `.ics` for the same event; a calendar dedupes and updates on UID, so
    three UID schemes meant three copies of one event. See DECISIONS §29.
  - `QueryBooleanSchema` (`schemas/common.ts`) replaces `z.coerce.boolean()` on
    `AdminEventPageListQuery.flagged` and `AdminHostListQuery.suspended`. `z.coerce.boolean()` is
    `Boolean(value)`, so the literal string `"false"` a GET query carries coerced to `true` and the
    filter silently inverted. Only `true`/`false`/`1`/`0` are accepted; anything else is a 422.
  - `tokens.scan` + the named `qrInk` / `qrPaper` exports (`@civfix/shared/tokens`) — the ticket QR
    plate's pure black-on-white. Deliberately OUTSIDE `colorSchemes`: `scan` is a sibling of `color`,
    not a member of it, so `ColorPalette` gains nothing from it and the plate cannot re-tune with the
    dark scheme (a camera decodes on luminance contrast).
  - `ColorPalette` itself DOES grow, and `darkColor` mirrors every new key: `color.chipInk`
    (`bloom`/`moss`/`sun`/`sky`/`lilac` — the AA-contrast chip label inks), `color.sun["700"]` and
    `color.lilac["700"]`. `tokens` stays the light scheme; the dark values are re-tuned, not reused.

  Round-2 comms follow-ups (still inside the unreleased 0.40.0, all additive):
  `openUnsubscribeBroadcasts` - a GET twin of `unsubscribeBroadcasts` on the same
  `/broadcasts/unsubscribe` path, because Apple Mail and Outlook render `List-Unsubscribe` as a link
  a person clicks (the POST stays the RFC 8058 one-click handler; the GET 302s to the web
  confirmation page, carrying its OWN `OpenUnsubscribeBroadcastsRequestSchema` keyed on `t` - the
  key the mail link and the server read - and an empty response schema, because a redirect to HTML
  is a browser landing and never a typed-client call). `MailSendError` (`types/errors.ts`) - an `AppError` subclass carrying the
  provider's SMTP `responseCode`/`command`/`response`/`code` in a typed `smtp` field, so a Mailer
  adapter can classify a failure without the caller parsing message text. `host/derive.ts` gains
  complementary suppression with BOUNDED inference: `seriesClosure` governs the daily points, the
  cumulative points and every terminal number of one series, publishing a cut only when the hidden
  group it exposes (`n` cells, mass `S`) leaves each cell its full `[0, k-1]` interval - `S === 0`
  or `(k-1) <= S <= (n-1)(k-1)` - and exposing `totalPublishable` so a caller can gate the KPI that
  IS that total. The same rule now gates the totals of `hourlySeries` and `arrivalsCurve`.
  `breakdownClosure(rows, { k, totalPublishable })` (re-exported through `breakdown`) closes the
  other half: a panel that partitions a published number applies SECONDARY suppression - after the
  rows under `k` are hidden, the smallest SHOWN row is hidden too until the hidden group reaches the
  band, so `[General 20, VIP 3]` beside a published `registered = 23` yields the panel and keeps the
  KPI; `totalPublishable: false` suppresses a panel whose total an upstream chain withheld; and a
  suppressed panel now carries an EMPTY `rows` array, since a key list of nulls advertises both the
  category count and that every category is under `k`. `NotificationPrefsDTO.hostBroadcasts` is documented
  as a channel-wide opt-out for the host-composed kinds only (`host_broadcast`, `thank_you`).

  Six NEW subpath exports (`package.json#exports`, mirrored 1:1 by `tsup.config.ts#entry`), so the
  root barrel is no longer the only way in: `@civfix/shared/host` (capabilities, k-anonymity
  suppression, the `derive` read-model selectors, grapheme helpers, broadcast rendering + link
  inspection, `GUEST_RSVP_TURNSTILE_ACTION`, and the shared safe-URL predicate),
  `@civfix/shared/markdown` (the constrained markdown SUBSET parser, its AST, `markdownToPlainText`,
  `isSafeMarkdownHref`/`isSafeHttpsUrl`), `@civfix/shared/ics` (`buildIcs`, `eventIcsUid`),
  `@civfix/shared/payments` (fee math, donation state, eligibility), `@civfix/shared/legal` (the
  document set, hashes and the donation-disclosure template) and `@civfix/shared/chip-contrast` (the
  WCAG 2.x contrast helpers behind the chip inks). Every one is framework-free and dependency-free
  apart from zod where a schema is involved.

  Four of the new non-GET endpoints are deliberately PUBLIC and csrf-free, each because the caller
  has no session to protect: `recordEventPageView` (an anonymous page-view beacon),
  `getGuestEventTicket` (a POST read whose capability token must not ride a URL - DECISIONS §17's
  converse), `unsubscribeBroadcasts` (the RFC 8058 one-click handler an inbox POSTs with no cookies)
  and `createDonationCheckout` (a signed-out donor starting a checkout). They join the 17 pre-existing
  public flows; every other new mutation carries `csrf: true`.

  Also new, and easy to miss in the list above: `CleanupDTO.hostReplyTo` (`HostEventEmailSchema`, the
  reply-to a host's event mail is sent under - opt-in, never a member's address),
  `CreateCleanupRequest.idempotencyKey` (optional, 8-128 chars, so a retried create cannot double-book
  an event), `CleanupDTO.registrationOutcome` (`RegisterOutcomeSchema`, nullable - what the viewer's
  last registration attempt actually did), `PushPayload.channelId` (`@civfix/shared/interfaces`,
  optional - the Android notification channel a push should land on),
  `GUEST_RSVP_TURNSTILE_ACTION` (`@civfix/shared/host`, the single action name the guest-RSVP
  Turnstile widget and its server-side verification must agree on),
  `HostBroadcastChannelsSchema`'s `hostBroadcastChannelsValid` refine (push rides the in-app
  notification, so `"push"` is only valid alongside `"inapp"` - `PUSH_REQUIRES_INAPP_MESSAGE` is the
  exported copy), and `SetMemberRoleRequestSchema.role` growing `["cohost","member"]` ->
  `["cohost","staff","member"]` to match the `CleanupMemberRole` enum growth (a request-side literal
  set, additive).

  Contract-review follow-ups (all inside the unreleased 0.40.0):

  - ONE markdown body maximum. `MARKDOWN_SUBSET_MAX_CHARS` is 8000 (was 5000) and is now the source
    `MAX_BROADCAST_BODY` and the `about` block's `body` max both reference. The parser's default
    truncation used to sit BELOW the field maxima, so a 5001-8000 character broadcast body was
    silently cut in every rendered channel while the composer preview showed it whole. A contract test
    asserts every markdown-bearing field max stays at or below the parser default. Callers that pass
    an explicit `maxChars` are unaffected.
  - Page-block link fields are validated at the boundary. `SafeHttpsLinkSchema` (https only, no
    userinfo, no IP literal host, no punycode, max 500) now guards the `donate` block's `url` and each
    `sponsors` entry's `url`, and `HostEventEmailSchema` guards the `contact` block's `replyTo`. All
    three were bare `z.string()` maxima on NEW fields, so a `javascript:` donate URL parsed as a valid
    `SaveEventPageRequest`; the client-side href gates were the only thing standing between it and a
    rendered anchor. `PageImageUrlSchema` shares the same predicate and so additionally rejects
    punycode hosts now.
  - One safe-URL predicate, not four. `src/markdown/safe-url.ts` (`isSafeHttpsUrl`,
    `isSafeMarkdownHref`, `unsafeHostReason`, `httpsUrlAuthority`, `hostOfAuthority`, re-exported from
    both `@civfix/shared/markdown` and `@civfix/shared/host`) is now the single host/scheme rule
    behind `isSafeMarkdownHref`, `inspectBroadcastLinks`, `PageImageUrlSchema` and
    `SafeHttpsLinkSchema`. `isSafeMarkdownHref` consequently rejects IPv4/IPv6 literals and `xn--`
    hosts, which the broadcast gate already did.
  - `buildIcs` emits UTC `DTSTART`/`DTEND` (`...Z`) and no longer emits a `TZID` parameter it ships no
    `VTIMEZONE` for (RFC 5545 3.2.19): Google and Apple resolve a bare IANA id, Outlook desktop may
    treat it as floating and move the event. A recognized `timezone` now rides as a calendar-level
    `X-WR-TIMEZONE` display hint instead, and an unrecognized one is dropped. `eventIcsUid` is
    unchanged, so a document built before and after this change still dedupes to one calendar entry.
  - `MyEventTicketDTO.status` is `RegistrationStatusSchema` rather than `z.string()`. The field is new
    in this unpublished version and the backend can only emit `registered`/`cancelled`/`transferred`
    (the repository row type and the `cleanup_registrations_status_check` constraint agree).

## 0.39.0

### Minor Changes

- Dark color scheme tokens. Additive: `darkColor` (`ColorPalette`, the same key tree as `tokens.color` with
  every hex re-tuned for dark surfaces - warm near-black paper, lifted brand/category hues that keep each
  pin recognizable and clear a 3:1 floor on the dark paper), `darkShadow` (`ShadowTokens`, black-based
  web shadow strings), `colorSchemes` / `shadowSchemes` (`Record<ColorSchemeName, ...>`), the
  `ColorSchemeName` (`"light" | "dark"`), `ColorPalette` and `ShadowTokens` types, and `cleanupColorFor(scheme)`.
  `categoryColor(category, scheme = "light")` gains an optional second argument; every existing call
  resolves exactly as before. `tokens` itself is unchanged - it stays the light scheme.

- Per-user conversation hiding. Additive: one new endpoint, no existing shape changed.

  `schemas/report-chat.ts` gains `ToggleHiddenRequestSchema`/`ToggleHiddenRequest` (`{ roomKind, roomId,
hidden }`, `.strict()`) and `ToggleHiddenResponseSchema`/`ToggleHiddenResponse` (`{ hidden }`), wired as
  the endpoint `toggleConversationHidden` (PUT `/conversations/hidden`, auth required, csrf). Hiding is
  per-viewer and non-destructive: the room, its messages and every other participant's inbox are
  untouched, and the thread returns to the hider's list as soon as a message arrives after the hide.
  `MessageThreadDTO` is unchanged - hidden threads are filtered out of `listThreads` in each source's
  own page SQL (a `conversation_hides` join, kept only while the room's latest activity is strictly
  after `hidden_at`), so the `LIMIT` counts visible rooms and a page is never short or empty beside a
  non-null `nextCursor`.

- Reposts embed their original. Additive: `PostRefDTO` (the denormalized preview carried on
  `PostDTO.repostOf` / `PostDTO.replyTo`) gains optional `body` (`string | null`, the referenced post's
  FULL text - `excerpt` stays as the truncated fallback for older servers), `event`
  (`LinkedEventRef | null`) and `report` (`LinkedReportRef | null`), so a repost row renders the original
  post whole - author, text, media grid and linked event/report card - without a second fetch. Every new
  key is optional; a response from an older server parses unchanged and no existing shape moved.
  `PostRefDTOSchema` is now annotated as `z.ZodType<PostRefDTO, z.ZodTypeDef, unknown>` (the same object
  schema, one named type instead of a structural blow-up) - without it the `endpoints` registry's inferred
  type crosses the TS7056 serializer cap and the `.d.ts` build fails. `parse`/`safeParse`/`nullable`/
  `optional` and the inferred `PostRefDTO` are unchanged; the schema is no longer a `ZodObject`, so
  `.shape`/`.extend` on it (used nowhere) would need the underlying object.

## 0.38.0

### Minor Changes

- Guest event RSVP, the `SmsSender` seam, and paged profile events. Additive: every new response field is
  optional or nullable and no existing shape changed.

  Guest RSVP (`schemas/cleanups.ts`): `GuestContactChannelSchema`, `MAX_GUEST_NAME`, `GuestPhoneSchema`
  (US-only E.164), `GUEST_MANAGE_TOKEN_MIN_LENGTH`/`GUEST_MANAGE_TOKEN_MAX_LENGTH`,
  `GuestRsvpRequestRequestSchema`/`GuestRsvpRequestResponseSchema`,
  `GuestRsvpVerifyRequestSchema`/`GuestRsvpVerifyResponseSchema`,
  `GuestRsvpCancelRequestSchema`/`GuestRsvpCancelResponseSchema`, `CleanupGuestDTOSchema`, and
  `GetCleanupGuestsRequestSchema`/`GetCleanupGuestsResponseSchema` (cursor-paged, `nextCursor`), plus the
  endpoints `guestRsvpRequest`, `guestRsvpVerify`, `guestRsvpCancel` (all public, csrf-free) and
  `getCleanupGuests` (auth-required, organizer/cohost scoped server-side). `CleanupDTO` gains optional
  `guestCount`; `going` now includes verified, non-cancelled guests — a behavioral widening of an
  existing number, pinned across every `going` field in DECISIONS.md section 18.

  `OtpCodeSchema` is now exported from `schemas/auth.ts` as the single definition of the accepted OTP
  code space (6-digit or reviewer code), shared by `EmailOtpVerifyRequest` and `GuestRsvpVerifyRequest`.

  SMS seam: `SmsSender` + `SentSms` (`@civfix/shared/interfaces`) and `FakeSmsSender` + `CapturedSms`
  (`@civfix/shared/fakes`). `SessionResponse` and `SessionCheckResponse` gain optional
  `guestSmsEnabled` so a client hides the SMS channel when the deployment has no provider.

  Guest verify errors are structural: `GUEST_OTP_ERROR_FIELD` (`"otp"`) and `GuestOtpErrorReason`
  (`invalid_code` | `attempts_exhausted` | `locked_out`) are exported so backend and UI key on the same
  strings — refusals stay `UNAUTHORIZED` on the wire with the reason in `AppError.fields`.
  `GetCleanupGuestsResponse.count` means ACTIVE (non-cancelled) guests, the same number as
  `CleanupDTO.guestCount`; the cursor-paged roster still lists cancelled rows, so `count` can be lower
  than the rows rendered.

  Profile events: `UserProfileDTO` gains optional `upcomingEvents` (hosting for public viewers,
  hosting + attending for self) and `pastEventsCursor`; new `ProfileEventsRequestSchema` /
  `ProfileEventsResponseSchema` and the `getProfileEvents` endpoint (`GET /people/:id/events`,
  auth-optional) page the strictly-past list via the shared pagination helpers.

  See DECISIONS.md sections 18-20.

## 0.37.0

### Minor Changes

- BREAKING: `claimNudge` is now `POST /claim/nudge` with a request body.

  The handler mints and rotates the pending claim code, so registering it as a GET left it CSRF-able via
  a cross-site top-level navigation carrying the `SameSite=Lax` `civfix_anon` cookie, and put the mobile
  `anonToken` into request URLs and access logs. The endpoint is now POST, and the new
  `ClaimNudgeRequestSchema` (`{ anonToken?: string }`, `.strict()`) carries the token in the body instead
  of the query. The response schema is unchanged; the generated client method becomes
  `api.claimNudge({ anonToken? })`.

## 0.36.0

### Minor Changes

- Wave A additive contract release.

  `@civfix/shared`: bound the WS client-frame `clientId` (1..64); add `MIN_EVENT_HOURS` and a minimum on per-attendee event hours; add `POST /push/unregister` with `UnregisterPushTokenRequest`; add optional `tz` to `QuietHours`; cap `RegisterPushTokenRequest.token` at 2048; add an `expect` param to `AbuseChecks.verifyTurnstile`; cap anon `mediaUploadIds` at 5; add optional `truncated` to `MailMessageDTO`; paginate `GET /me/blocks` (cursor request + `nextCursor` response).

  `@civfix/ui`: adopt `@civfix/shared` 0.36.0 and enforce the shared `MIN_EVENT_HOURS` floor in the hours-entry validators.

## 0.35.0

### Minor Changes

- BREAKING: remove the per-user public activity stream from the contract (privacy).

  `GET /people/:id/activity` merged a named person's public actions (`created_report`, `hosted_event`,
  `attended_event`, `followed_user`) into one auth-optional, cursor-paginated behavioral timeline that
  anyone could page through signed out. The rows were individually public; the merge was a profiling
  surface. The product owner asked for the whole feature — frontend and backend — gone, so the contract
  drops it.

  Removed exports:

  - `listUserActivity` (endpoints registry entry + the generated typed-client method)
  - `UserActivityKindSchema` / `UserActivityKind`
  - `UserActivityItemDTOSchema` / `UserActivityItemDTO`
  - `UserActivityListQuerySchema` / `UserActivityListQuery`
  - `UserActivityListResponseSchema` / `UserActivityListResponse`

  This is a breaking removal; on 0.x it ships as a minor bump. Every consumer must be on a release with
  its activity references already removed before adopting the new range (`@civfix/ui` and the backend
  are done in the same delivery set). No database change: the stream was a read-model over tables that
  other features own. What is removed is the cross-domain merge, not each contributing surface —
  `getProfile`, `listFollowers`/`listFollowing` and `listUserPosts` are unchanged. See DECISIONS §15.

- Make the reviewer OTP bypass reachable through the contract.

  `EmailOtpVerifyRequest.code` now accepts EITHER a 6-digit emailed OTP (`/^\d{6}$/`, unchanged) OR a
  20..128-character reviewer bypass code. The previous digits-only regex rejected every valid reviewer
  code at the request boundary, before the service that owns the bypass decision could see it, so the
  bypass could not be used end-to-end. The schema stays `.strict()`; widening an accepted input set is
  additive and backward compatible (every previously valid payload is still valid, no response shape
  changed).

  Also exports the reviewer account and code bounds from `schemas/auth.ts` so the clients and the
  backend stop hardcoding them separately: `REVIEWER_OTP_EMAIL`, `REVIEWER_OTP_CODE_MIN_LENGTH` (20, the
  same secret-material floor the backend enforces), `REVIEWER_OTP_CODE_MAX_LENGTH` (128). Clients use
  the address to render a plain long-code field instead of the 6-digit segmented input. See DECISIONS
  §14.

- Messaging inbox: a raw last-message timestamp on the thread DTO, and an HTTP mark-thread-read endpoint.

  - `MessageThreadDTO` gains `lastMessageAt` (`string().datetime().nullable().optional()`), the last
    message's ISO timestamp — null for an empty room, absent from older servers. Purely additive: the
    server-rendered `ago` string stays exactly as it is, so every existing consumer keeps working. New
    clients can render (and re-render) their own relative time instead of holding a string that ages.
  - New endpoint `markThreadRead` — `PUT /threads/read`, auth required, csrf true, v1 — with
    `MarkThreadReadRequestSchema` (`{ roomKind, roomId }`, strict, the four room kinds) and
    `MarkThreadReadResponseSchema` (`{ ok: true }`). Marking a conversation read was WS-only until now
    (the `ack` frame needs a message id the inbox list does not have); this is the id-free equivalent
    the inbox can call over HTTP. The backend advances the same per-family read watermark the WS
    join path uses and clears the room's conversation bells.

## 0.34.0

### Minor Changes

- 00c5cfa: Mobile audit: chat cache-as-source-of-truth with fetch-race journaling, viewer-field-preserving inbound merge (preserveViewerFields + reconcileInbound viewerTruth), discriminated chat send outcomes, transient vs fatal room errors, reconnect gap-heal, poll vote gating + inert state, thread nav seams (onOpenEntry), nested-shell back arbitration (NestedShellHostProvider), SegmentedCodeInputHandle, media thumb renditions + lightbox intrinsic fit, DST-safe event scheduling, locale threading, perf memoization, a11y hit targets, token cleanup.

## 0.33.0

### Minor Changes

- Report and event chats get a real chat-info surface.

  - `@civfix/shared`: adds the `getReportChatParticipants` endpoint contract (`GET /reports/:id/chat/participants`) with `ReportChatParticipantDTO` / `ReportChatParticipantsResponse`. A report chat previously had join/leave but no way to list who was in it.
  - `@civfix/ui`: tapping the title of a report or event chat now opens the group-chat treatment instead of a bare link row - a hero (photo/glyph, the report or event's real title, address, member count), Mute/Unmute, Leave chat (report rooms only), the existing View report / View event row, and the roster. Report rosters come from the new endpoint; event rosters keep the attendee list. Adding members is deliberately absent: these rooms have no invite path. The surface is titled "Chat info" rather than "Members" for these room kinds.

  Leaving is offered on report rooms only. An event chat's membership IS the RSVP, so a "Leave chat" there would silently un-RSVP the viewer from the event itself.

## 0.32.0

### Minor Changes

- Person profile block state and error coercion helpers.

  - `@civfix/shared`: `UserProfileDTOSchema` gains an optional `blockedByMe` flag, and `types/errors` exports `AppErrorLike`, `isAppErrorLike` and `toAppError` for turning unknown/serialized failures back into an `AppError`.
  - `@civfix/ui`: person detail surfaces block state, the member picker and new-channel body pick up the shared error coercion, direct-message hooks gain a query key for it, and the en/es/de/ko locales cover the new profile + channel-create strings.

## 0.31.1

### Patch Changes

- Six mobile-feedback fixes: full-page details, camera-first report flow, honest wizard, leaderboard visibility, and hours integrity.

  - **All detail pull-ups are full pages on native.** `SHEET_ONLY_KINDS` is down to `drop-pin`; a platform seam (`detailPresentationPlatform`) keeps web byte-identical. The shell overlay layer gained a shared `DetailHeader`, a back affordance for drag-less pages, and a bottom safe-area reserve. `blend` gets a title fallback so no page is headerless.
  - **The camera IS the capture step on mobile.** The cream "Capture the issue" card is unreachable when a Viewfinder is injected; there is no X on the embedded camera (`CameraViewfinderProps.onCancel` is now optional — absent means "draw no exit chrome"). The progress rail is index/total-driven; located drafts skip the location step (`stepAfterCapture`).
  - **The location picker never centers on the middle of the US** (native and web): no map mounts until a real point exists; `useApproxCenter` shares the app-wide user-location cache with a 4s device-fix cap and never downgrades a seeded point.
  - **Report-tab performance:** the report body is retained in a native keep-alive slot (with a liveness gate so a detached body arms no global BackHandler), the camera mount is deferred past the tab transition, MapLibre is lazily retained across compact tab switches, and tab cells are memoized.
  - **Discovery leaderboard renders whenever a jurisdiction is known** — including an empty "be the first" state with `participantCount` — instead of hiding on empty boards; shared location resolve hardened (timeout + ipLocate fallback).
  - **Page backgrounds:** ProfileBody, SavedPostsBody, and PostDetailBody paint the page color (no more tan band on glass) and the latter two own a real scroll host.
  - `@civfix/shared`: `REPORT_VOLUNTEER_HOURS` is deprecated — the backend no longer credits volunteer hours for filed reports; `"report"` remains in `VOLUNTEER_HOURS_SOURCES` for rendering historical rows.

## 0.31.0

### Minor Changes

- d5c19f3: Service-hours transcript, event slots, host event completion, and privacy-flag contract.
  The @civfix/ui minor is a deliberate lockstep guard — see the release notes.

  Shared adds: `EventSlotDTOSchema`/`EventSlotInputSchema` plus `slots`/`slotCount` on `CleanupDTO`;
  `CompleteCleanupRequestSchema` and `ClaimEventSlotRequestSchema`; the itemised volunteer-hours
  transcript schemas (`VolunteerHoursEntryDTOSchema`, `MyVolunteerHoursEntries*`,
  `PublicVolunteerHours*`, `EventHoursQuery`/`EventHoursResponse`); `schemas/certificates.ts` for
  service-hours certificates; `showVolunteerHours` on `UserDTO`/`UserProfileDTO`/`UpdateSettingsRequest`;
  the `cleanup_slot` and `hours_logged` notification types; and `contentDisposition` on the storage
  `put`/`head` interfaces. `LeaderboardQuerySchema` gains a REQUIRED `geoid` and `listUserPosts`
  becomes `auth: "optional"` — both are breaking for callers and must ship with the matching backend
  release.

  Why `@civfix/ui` takes a MINOR rather than the patch a shared-only changeset would produce: a patch
  would publish `@civfix/ui@0.36.2`, which web's `^0.36.0` and mobile's `^0.36.1` both match. Those apps
  would silently pick up a UI whose `@civfix/shared` dependency is `^0.31.0` while the app itself is
  pinned to `^0.30.0` — two zod realms, two `endpoints` objects, and a broken `instanceof AppError`. A
  minor (0.37.0) falls outside the 0.x caret, so the consumers stay coherent until they are bumped
  deliberately.

## 0.30.0

### Minor Changes

- Feed: Twitter-style timeline row, create-from-composer, and the four gaps it left open.

  **@civfix/ui**

  - `PostCard` is a timeline row. The ROW opens the thread; avatar/name/@handle open the profile; the
    timestamp is the post's permalink; a new `...` menu offers Copy link / View profile / Report post /
    Delete (wiring the previously caller-less `useDeletePost`); media opens the lightbox. Previously the
    root was a plain `View` and a full-width author link went to the profile, so the body, the media and
    the lower half of the row were inert.
  - New `timeline` `PostActionBar` density (reply/repost/like/save left-packed with counts, share pinned
    trailing) and a `POST_SURFACE` token selecting flat rows (default) or the previous rounded cards.
  - The fix showcase is now ADDITIVE. It no longer replaces the post, which had made an ordinary post
    mutate days after publication - author, avatar and body deleted - the day its linked report resolved.
  - The composer can CREATE the report or event it attaches: "New report" / "New event" launch the
    existing flows and return with the result attached. Reports attach by snapshot, so a just-created one
    is not dropped by the stale-attachment guard.
  - The composer clears its draft on submit DISPATCH rather than on success (dismissing mid-request left
    it staged and the same post could be published twice) and restores it if the create fails.
  - Feed gains pull-to-refresh; a loaded feed previously had no refresh path at all.
  - Accessibility: `aria-selected` on the filter tabs (rn-web drops `accessibilityState`), action counts
    exposed via `accessibilityValue`, @mentions given a link role and name, and a new `colors.accentText`
    (#B03A2C) for coral used as TEXT - the brand coral is a fill colour and failed WCAG AA as ink on all
    three civfix surfaces. Fills are unchanged.
  - The detail sheet no longer slides an empty card off screen on dismiss.

  **@civfix/shared**

  - `ContentReportSubject` and `ModerationSubjectType` gain `"post"`, so a feed post - the only UGC in
    civfix with no report path - can be reported and actioned.
  - `PostDTO.replyTo` carries a preview of the parent, so a reply in the home feed can say what it is
    replying to. `PostRefDTO.media` carries the referenced post's own media, so a quote card can show
    what it quotes.

  Requires the API deployed with migration `0060_moderation_subject_post.sql` before "Report post" works.

## 0.29.0

### Minor Changes

- f0389cf: Contract cleanup + correctness fixes.

  - **`ISODateSchema` no longer accepts non-string, non-Date input.** A bare `z.coerce.date()` ran
    `new Date(input)` on anything, and `new Date(null)` / `new Date(false)` / `new Date(0)` are all
    _valid_ Dates at the epoch — so `{ scheduledAt: null }` used to parse into an event scheduled at
    1970-01-01 instead of failing validation. Such values are now rejected.
  - **One chat-history window for every room kind.** `ChatHistoryQueryShape` and
    `rejectAroundWithBefore` are now exported from `schemas/chat.ts`; `schemas/groups.ts` consumed a
    verbatim copy of the `around`/`before` mutual-exclusion rule, exactly the sort of cross-field rule
    that drifts into a different error for one route.
  - **BREAKING (validation tightened):** `DmHistoryRequestSchema` and `ReportChatHistoryRequestSchema`
    are now `.strict()`, matching `GroupHistoryRequestSchema`, so an unknown query key is rejected
    rather than silently stripped. The `before` cursor is now `IdSchema` rather than `z.string()` — it
    has always been a message id (the server sets `nextCursor` to the oldest row's `id`).
  - **BREAKING (unused public API):** removed `ToggleChatReactionBodySchema` / `ToggleChatReactionBody`
    and `ResolveReportResponseSchema` / `ResolveReportResponse`, plus the curated-places geocode path
    (`HOST_PLACES`, `HostPlace`, `searchCuratedPlaces`, `suggestPlaces`). None had a consumer in any
    repo.
  - `SuggestPlacesRequestSchema` accepts an optional `language` (the caller's app locale). Optional so
    older clients keep working; the server defaults to `"en"`.
  - **API client responses are validated.** A 2xx body is now run through the endpoint's response
    schema, so the `.default()`s and `.catch()`es the DTOs document actually apply on the read path
    (previously the inferred types lied whenever the deployed server was older than the client). It
    never throws: a body that does not match is passed through raw after one `console.warn` per
    endpoint.
  - `monogram()` takes the first _code point_, so a name starting with an emoji or an astral-plane glyph
    no longer renders as a lone surrogate.
  - `mergeChatItems()` parses each timestamp once and treats an unparsable `createdAt` as the epoch. A
    `NaN` comparator result violates the sort contract and let rows land in engine-defined (Hermes vs
    V8) order that shifted between renders.
  - `makeIdFactory(0)` no longer returns the same id forever — `0` is a fixed point of xorshift32.

## 0.28.0

### Minor Changes

- Home feed endpoint accepts anonymous viewers (public feed for signed-out users; write actions stay auth-gated).

## 0.27.1

### Patch Changes

- Correct the Hanken body token in `@civfix/shared`. Refine `@civfix/ui` with the portrait feed-first shell, redesign fidelity, and animation, interaction, and accessibility fixes.

## 0.27.0

### Minor Changes

- b355984: Social feed contracts + redesign tokens: first-class Post DTOs (PostDTO/PostRefDTO/PostKind, counts + viewer), the PostComposeInput schema with quote/reply/attachment refinements, the shared FeedPageDTO + home-feed/replies/user-posts/saves response schemas, 13 post endpoints (create/get/delete/replies/repost/like/save/homeFeed/userPosts/saves) in the registry, 5 new post-interaction notification types + a `postInteractions` prefs flag, and the "liquid glass" palette swap (sand bg, cream cards, coral accent, category colors) with the UI body font repointed Manrope -> Hanken Grotesk.

### Patch Changes

- b355984: Fix admin contracts for save-and-route forwarding templates, nullable anonymous reporters, and explicit moderation destinations.

## 0.26.0

### Minor Changes

- 2951e09: Chat P0: `message_update` WS server frame (full refreshed DTO, upsert-by-id), unified roomKind-scoped `editChatMessage` endpoint (`PATCH /messages`), `MESSAGE_BODY_MAX` raised 150 → 2000, new `EDIT_WINDOW_HOURS = 48`.
- 8814836: Chat P1: expand reaction set with laugh and sad
- 7d8192c: Chat P2: reply DTO + replyToId on send/persist, around-mode history with prevCursor. `ReplyToDTOSchema` (denormalized quoted-message preview) + `replyToId`/`replyTo` on `ChatMessageDTOSchema`, `replyToId` on the WS `send` frame and `PersistChatInput`, and `around` (mutually exclusive with `before`) on the cleanup/dm/report history query schemas with `prevCursor` (cursor toward newer messages) on their responses.
- ef7958c: Chat P3: message pinning — pinnedAt DTO field, setMessagePinned endpoint, pins on initial history pages
- 6fc1a0b: Chat P4: group room kind — chat_groups DTOs, 9 group endpoints, group_chat notification type
- b15bedb: Chat P5: channels — `MessageThreadDTO.channel` inbox flag and `joinChatGroup` endpoint for public groups/channels.
- b1cc623: Chat P6: polls — poll message kind, PollDTO, create/vote/close endpoints
- f641dae: Event co-hosts, member management, and per-attendee volunteer hours (WS4/WS5 schema layer).

  - `CleanupMemberRoleSchema` is now `["organizer", "cohost", "member"]` (backend `CLEANUP_MEMBER_ROLE_VALUES` mirror must be updated byte-identically).
  - `CleanupDTO` gains `myRole` (the viewer's membership role; null/absent when not a member).
  - New `AttendeeDTOSchema` (= `PersonDTO` + `role`); `CleanupAttendeesResponse.attendees` is now `AttendeeDTO[]` (`PersonDTO` itself unchanged).
  - New `SetMemberRoleRequest/Response` and `RemoveMemberRequest/Response` + endpoints `setCleanupMemberRole` (`PATCH /cleanups/:id/members/:userId`) and `removeCleanupMember` (`DELETE /cleanups/:id/members/:userId`).
  - `NotificationType` gains `cleanup_role` (appended last; backend `NOTIFICATION_TYPE_VALUES` mirror must match).
  - BREAKING-ish: `LogEventHoursRequest` is now `{ id, entries: [{ userId, hours }] }` (per-attendee; the flat `hours` field is gone — apps and backend move in lockstep). New `EventHoursEntrySchema` export.

- Follow suggestions — nearby organizers ranking + SocialBody suggestions list.

  - `@civfix/shared`: new `followSuggestions` endpoint (`GET /users/follow-suggestions`, v1). Ranking tiers: nearby organizers (~25km) → nearby people → organizers elsewhere → rest; excludes self, already-followed, and blocked users.
  - `@civfix/ui`: SocialBody renders a "Suggested for you" list (via the new `useFollowSuggestions` hook) when no search query is typed, alongside the existing contacts and volunteer-leaderboard entries. Also adds compact-mode BodyTransition nav animations (openDetail crossfade, push/pop slide-fade via `useStackDirection`).

## 0.25.0

### Minor Changes

- 2de6f24: Report chat as a group chat: promote per-report discussion into a first-class group conversation on the chat backbone.

  - `ChatMessageDTO`: nullable `from` + `kind:"system"` + `system` payload (report timeline events) + `cityMention`/`forwardedToCity`.
  - `MessageThreadDTO`: `report` kind + `muted`; `NotificationType`: `report_chat`.
  - Report chat is view-only until you Join (join/leave + per-conversation mute endpoints); it appears in the `/threads` inbox; `ReportDTO` carries report-chat metadata (joined/memberCount/messageCount/unread).
  - UI: `ConversationBody` report mode (Join banner, centered system rows, @city pill, Mute/Leave), `ReportDetailBody` "View chat" + inline timeline (bell removed), inbox report rows + muted glyph, `report_chat` notification glyph.
  - Removes the per-report discussion schemas/endpoints/UI, the `report_discussion` roomKind, and the report-follow hooks. `ReportDTO.following` is deprecated (always false).

## 0.24.3

### Patch Changes

- Additive contract changes from the backend security audit: optional `nonce` on `GoogleSignInRequestSchema` (Google id-token replay defense, parity with Apple), `LinkEventReportsRequestSchema.reportIds` capped at 100, `AdminUserListResponse.counts` made optional (first-page-only facet), and a new `WsTicketResponseSchema` + `wsTicket` (`POST /ws-ticket`) endpoint for single-use WebSocket connect tickets.

## 0.24.2

### Patch Changes

- 69414ea: Report chat contract (issue #76): reports gain a real-time group chat by extending the existing chat stack with a `"report"` room kind. Adds `"report"` to `RoomKind`, `ChatMessageDTO.roomKind`, and `PersistChatInput.roomKind`, plus the `reportMessages` (GET /reports/:id/messages, public-read), `deleteReportMessage`, and `toggleReportMessageReaction` endpoints and their request schemas — mirroring cleanup chat. Additive / backward-compatible; the report-discussion contract stays (deprecated) for the migration window.
- cfba7ee: Social profile links (issue #76): add `SocialLinksSchema` (Facebook/Instagram/TikTok/X handles + a WhatsApp E.164 number, each validated against a strict charset — bare handles only, never URLs), the `SOCIAL_PLATFORMS` / `SOCIAL_PLATFORM_LABELS` metadata, and a `socialLinkUrl(platform, value)` helper that builds the canonical https link from a fixed template (no open-redirect / `javascript:` surface). `socialLinks` is added — additive, optional, nullable — to `UserProfileDTO` (profile-only, NOT base `PersonDTO`) and to `UpdateProfileRequest`, so clients/servers built against the prior contract still parse.
- 163f3d3: Volunteer hours + per-jurisdiction leaderboard contract (issue #76): adds the `volunteer.ts` schemas — `MyVolunteerHoursDTO`, `GetMyHoursResponse`, `LeaderboardEntryDTO`, `LeaderboardResponse`, `LeaderboardQuery`, `LogEventHoursRequest`/`Response`, the `VolunteerHoursSource` enum, and the `REPORT_VOLUNTEER_HOURS` (0.1) / `MAX_EVENT_HOURS` constants — plus the `getMyHours`, `logEventHours`, and `getJurisdictionLeaderboard` endpoints in the registry, and an additive optional `volunteerHours` total on `UserProfileDTO`. All additive / backward-compatible.

## 0.24.0

### Minor Changes

- Admin mail stats: drop fabricated deliverability metrics, keep only measured signals.

  `MailStatsResponse` is reshaped to `{ unread, threads, sent, bounced, failed }` — the
  unmeasurable `placement7d`, `delivered7d`, `bounceRate`, `complaintRate`, and `domainHealth`
  fields are removed, and `MailDomainHealthSchema` is deleted. `MailSummary` (home) drops its
  `bounceRate` field. Coordinated breaking change for the admin dashboard, the sole consumer of
  these admin DTOs.

## 0.21.0

### Minor Changes

- Sign in with Apple, web redirect flow: add the `appleStart` / `appleCallback` endpoints and the
  `AppleCallbackBody` schema (Apple returns its web callback as an `application/x-www-form-urlencoded`
  `form_post`). Mirrors the existing Google web flow.

## 0.20.0

### Minor Changes

- Encampment is now its own report category (split out of `hazard`), plus a viewport-biased address search and consent primitive.

  - **shared**: add `encampment` to `ReportCategorySchema`, `REPORT_CATEGORY_LABELS`, the `color.category` token (teal `#2FA39A`), and remap `REPORT_TYPE_TO_CATEGORY.encampment`/`WEB_REPORT_TYPES` from `hazard` → `encampment`. `photonSuggest` gains optional `proximityZoom` + `locationBiasScale` to tune proximity bias.
  - **ui**: `encampment` pin glyph + `CATEGORY_ICONS`/`PIN_GLYPHS`/`icon-map` (lucide `Tent`); new `useMapViewport` bus + viewport-biased `AddressSearch`; new `TermsConfirmation` consent primitive (sibling of `AgeConfirmation`); `useReportSubmit` now invalidates the map-reports queries so a freshly filed report shows on the map immediately; removed the success-screen teardrop pin.

## 0.19.2

### Patch Changes

- `FakeInboundMail`: harden `extractThreadToken` against false positives, keeping parity with the real
  `CfInboundMail` adapter. The reply-address match is now anchored to the local-part start and the token is
  only accepted from a recipient on our reply domain (new optional `FakeInboundMail(replyDomain?)`
  constructor arg, default `civfix.org`). This prevents a city's own `report-*@city.gov` alias or a foreign
  CC from being mis-read as a thread token now that the `-` separator is in use. Fake-only; backward
  compatible (the constructor arg is optional).

## 0.19.1

### Patch Changes

- `FakeInboundMail.extractThreadToken`: keep the fake in parity with the real `CfInboundMail` adapter
  for the new reply-address scheme. The token shape gate is now permissive (`/^[a-z0-9]{8,40}$/`) so it
  accepts both the current 12-char base32 thread token and the legacy 24-hex token, and the local-part
  matcher recognizes the `-` separator (`report-`/`event-`/`reply-`) in addition to the legacy `+` form.
  Fake-only; no schema/type/API change.

## 0.19.0

### Minor Changes

- Reference codes, report verdicts, report-verified users, full-body timeline, jurisdiction codes,
  event resource requests, and resolve-either report/cleanup lookup. All additive and
  backward-compatible (every new field is optional/nullish/defaulted; new requests keep `.strict()`).

  - `common.ts`: `REPORT_TYPE_CODE` (`Record<ReportType, string>` TYPECODE map, the single source of
    truth for the `{TYPECODE}-{JURCODE}-{NNNNNN}` reference code) + the derived inverse
    `REPORT_CODE_TO_TYPE`. New `ReportRefOrIdSchema` (`z.string().min(1).max(64)`) for the report/cleanup
    by-id routes so the backend can resolve a record by its uuid OR its `reference_code`.
  - `entities.ts`: `ReportDTO.referenceCode` (optional) and `CleanupDTO.referenceCode` (optional) +
    `CleanupDTO.jurisdictionGeoid` (nullish); `ReportTimelineEntryDTO` gains optional `kind` + `body`
    (full city-reply body for a collapsible timeline node). Both create responses already return the full
    DTO, so `referenceCode` is exposed for post-create navigation with no endpoint change.
  - `map.ts`: `JurisdictionDTO.code` (optional incremental JURCODE).
  - `admin/reports.ts`: `AdminReportDTO` gains `referenceCode`, `verificationVerdict`
    (`approved`|`rejected`, nullish), `verifiedAt` (nullish), and `reporterReportVerified`. New
    `setReportVerdict` endpoint (`POST /admin/reports/:id/verdict`) with `SetReportVerdictRequest` +
    `SetReportVerdictResponse`.
  - `admin/users.ts`: `AdminUserDTO.reportVerified` (optional); `UserMessageItemDTO.source`
    (`chat`|`dm`|`report`, optional). New `setUserReportVerified` endpoint
    (`POST /admin/users/:id/report-verify`) with `SetUserReportVerifiedRequest`.
  - `cleanups.ts`: new `requestEventResources` endpoint (`POST /cleanups/:id/request-resources`) with
    `RequestEventResourcesRequest` + `RequestEventResourcesResponse` (a verified host forwards a resource
    request to the event's jurisdiction).

## 0.18.0

### Minor Changes

- Admin jurisdiction directory: filter by jurisdiction TYPE. `listJurisdictions` query gains an optional
  `layer` (`state` | `county` | `place` | `federal` | `tribal`) that narrows the directory to one type
  server-side. It is independent of `filter` (routing posture) — the two combine — and the first-page
  `total`/`facets` are scoped to the active `layer`, so the header + routing chips count within the
  selected type. Additive and backward-compatible: omitting `layer` returns every type as before.

## 0.17.0

### Minor Changes

- Admin jurisdiction directory: server-driven search/sort/pagination + a boundary map.

  - `listJurisdictions` query: `sort` narrowed to `population` (default) | `reports` | `name`; `filter` gains `routed` (any contact on file). The list is now ordered + paged entirely server-side so the admin can reach all ~28k jurisdictions instead of the first 100.
  - `JurisdictionDirectoryResponse`: adds optional `total` (count of jurisdictions matching the search) and `facets` (`{ routed, unrouted }`) — both returned only on the first page, so the change is additive and a prior-contract client still parses.
  - New endpoint `getJurisdictionGeometry` (`GET /admin/jurisdictions/:geoid/geometry`): returns one jurisdiction's simplified GeoJSON boundary + bbox + interior point, so the directory can render the boundary on a map for location verification.

## 0.16.0

### Minor Changes

- Make a jurisdiction's discussion @handle editable from the admin panel. Adds `JurisdictionHandleSchema`
  (normalizes a leading "@"/casing to a bare lowercase slug, 2-40 `[a-z0-9_]`, empty clears), a nullable
  `handle` on `JurisdictionDirectoryDTO` (read), and an optional normalized `handle` on
  `PatchJurisdictionRequest` (write). Reserved-word + case-insensitive uniqueness are enforced server-side.

## 0.15.1

### Patch Changes

- Behavior-preserving frontend cleanup (zero visual/animation change): removed redundant comments and dead code, enforced strict ASCII (em/en-dash, implies/right arrows, Unicode ellipsis, approx, curly quotes -> ASCII in comments and inconsistent rendered copy), and applied cross-cutting DRY.

  - `@civfix/shared`: comment/ASCII normalization only; no schema, type, client, or runtime behavior change.
  - `@civfix/ui`: internal dedup helpers (`appErrorCode`, nav helpers `openThread`/`pushCleanup`/`idKeyExtractor`, a shared reaction reducer, extracted byte-identical seam StyleSheets for `MediaPreview`/`SearchHeader`) plus additive `theme.colors` scrim tokens (`scrim`/`scrimModal`/`scrimStrong`, equal to the rgba literals they replace). No rendered output or animation changes.

## 0.15.0

### Minor Changes

- Profile-picture consistency.

  - `@civfix/shared`: `AdminUserDTO` / `AdminUserListItemDTO` now carry `avatar` (gradient pair) + `avatarUrl`, so admin can show real photos. (PersonDTO already had `avatarUrl`.)
  - `@civfix/ui`: `useUpdateProfile` now pushes the updated user into the host auth store via a new optional `onUserUpdated(user)` data seam (so the top-left account avatar + sheet headers refresh immediately after a photo change instead of staying stale until reload) and invalidates the people/profile caches. Hosts wire `onUserUpdated` to their session store.

  Pairs with the backend change that makes `users.avatar_url` the canonical (public-CDN) avatar on upload and exposes `avatarUrl` on people/chat/dm/discussion/admin projections, so the same uploaded photo shows everywhere.

## 0.14.0

### Minor Changes

- App-Store remediation batch (+ analytics new-users + pin-glow).

  Contract (@civfix/shared):

  - New owner endpoint `unlistReport` (`POST /reports/:id/unlist`) — reporter hides/re-lists their own report (toggles `reports.visibility`), never deletes.
  - New host endpoint `cancelCleanup` (`POST /cleanups/:id/cancel`) — organizer cancels an event; the server notifies attendees + writes a timeline row + unlists from the map.
  - `NotificationTypeSchema` += `"cleanup_cancelled"`; `NotificationPrefsDTOSchema` += `mentions` (mentions mute).
  - Client transport fix: a `DELETE` may now carry a JSON body (was excluded), required by the OTP-gated `deleteAccount({ emailOtp })`.
  - Analytics: home/KPI "Volunteers" → "New users".

  UI (@civfix/ui):

  - Report detail: owner-only "Hide from map / Show on map again" + hidden banner.
  - Event detail: host "Cancel event" + CancelEventSheet + "Cancelled" banner.
  - Guest browsing supported end-to-end (every account action funnels through requireAuth/SignInPrompt).
  - Per-photo "Report" on report gallery / comments / chat attachments; one-tap Block from group chat + member list; "Mentions" notification toggle.
  - Pin glow fix (shape-following focus glow on map pins).

## 0.13.0

### Minor Changes

- Feature batch (2026-06-20):

  - **Chat/DM attachments**: WS `send` frame gains `mediaUploadIds`; new `media_assets.chat_message_id` association; optimistic local-preview bubbles. Shared composer helpers `useAutoGrowInput`, `composerKeyPress`, `useComposerAttachments`, `ComposerThumbs`; Enter-to-send and auto-grow fixes in both composers; emoji button replaced by a "+" attach affordance (`EmojiTray` removed).
  - **@handle as the public identifier**: UUID is now internal-only; `/people/<handle>` routing; `UserDTO.handleChangeableAt` (30-day rename cooldown); reserved-handle blocklist; `GET /people/:id` resolves a uuid or handle.
  - **Verification → schedule-a-call**: removed the doc-upload verification apply contract and the admin verification review queue; added `setUserVerified` (admin direct verify/unverify toggle). New `GetVerifiedBody` info screen replaces `VerificationApplyBody`.
  - **Mail recipient + compose polish**: `MailMessageDTO`/`MailThreadListItemDTO` gain a `to` recipient field so composed/outbound-only threads show who they were sent to.
  - **Keyboard-avoidance seam**: `KeyboardAwareScroll` ScrollHost wrapper for on-screen-keyboard avoidance across mobile + web text inputs.
  - **Report detail map-focus**: new `mapFocusStore` / `useMapFocus` seam — opening a pin detail focuses the main home map on the pin instead of embedding a MiniMap.
  - New primitives: `PopoverMenu` (fixes clipped 3-dot menus); chat `members` kind + `MembersBody`; data-export feedback.

## 0.12.0

### Minor Changes

- App Store / Play submission remediation + content safety.

  - Public UGC content reporting: `reportContent` (POST /content-reports) writing to the moderation queue; `ContentReportSubject`/`ContentReportReason` enums; `ReportContentSheet` + discrete Report buttons on comments, chat/DM messages, reports/pins, events, and profiles.
  - In-app account deletion: `deleteAccount` (DELETE /me) soft-deletes (keeps posts), and `requestDataExport` (POST /me/data-export) emails the user a full data compilation. ProfileBody danger zone + Blocked-accounts list + Contact support.
  - Deleted-account handling: `PersonDTO.deleted` / `DiscussionAuthorDTO.deleted` render "Deleted User" publicly (`DELETED_USER_LABEL`); admin keeps real identity.
  - User-deletable messages: `deleteDmMessage` / `deleteCleanupMessage`; `ChatMessageDTO.deletedAt`/`mine`; `useChat().delete` + tombstone.
  - Admin: `ModerationKind += user_report`, new `ModerationSubjectType`, `ModerationListItem/ItemDTO.subjectType`, `AdminUserDTO.deletedAt`, admin message `deletedAt`, `removeUserMessage`.
  - Map attribution on `LocationPicker.native`.

## 0.11.0

### Minor Changes

- Jurisdiction email routing (issue #40):

  - `Mailer` seam gains a first-class `sendOutbound(email) → { messageId }` carrying `from` / `replyTo` /
    `messageId` / attachments, so operator outreach is no longer forced through the no-reply
    OTP/transactional template. `OutboundEmail` / `OutboundAttachment` / `SentMail` are exported from
    `@civfix/shared/interfaces`, and `FakeMailer` now captures the full envelope (so a dropped From/Reply-To
    can't pass tests).
  - `FakeInboundMail.extractThreadToken` now shape-validates the token (`^[0-9a-f]{24}$`) exactly like the
    real adapter, closing the fake/real divergence that hid the `geo-{geoid}` reply-threading bug.
  - Admin report DTO gains `geoid` and an `outreach` block (`{ status: not_sent|sent|delivered|replied|
bounced, threadId, routedTo, routedAt }`); the timeline `kind` enum gains `reply` (an inbound
    jurisdiction reply). New `routeReport` endpoint (`POST /v1/admin/reports/:id/route`,
    `RouteReportRequest`/`RouteReportResponse`) — approve a report and email it to its jurisdiction with an
    optional per-report contact override.
  - New `NOT_ROUTABLE` error code (422) for "no routing contact on file".

## 0.10.0

### Minor Changes

- Event report-linking overhaul:

  - Pick reports **before** setting the meeting location, with text **search**, a separate **filter-by-type** chip row, and a **load more** button. Report rows now lead with the type and show the description beneath.
  - New public report-search contract: `searchReports({ q?, categories?, cursor?, limit? }) → { items, nextCursor }` (`GET /v1/reports/search`), and `ReportPinDTO` now carries `description`.
  - Map "event-link mode" (`eventReportLinkStore`): while creating/editing an event the map temporarily shows only the filtered report pins, each with a **+ (not added) / ✓ (added)** badge; tapping a pin opens its detail with an **Add to event** action. Normal map behavior is unchanged when not linking.
  - Phones get a **"Pick on map"** affordance that collapses the sheet to reveal the map for tapping.

## 0.9.0

### Minor Changes

- Seven UI/UX features:

  - Event(cleanup) form links reports as full cards (image/title/category/status) instead of raw ids — picker, "Host an event" pre-seed, and edit-flow links; `/map/reports` pins enriched with `title`/`thumbUrl` and `ReportPinDTO` extended to match.
  - Report detail: status badge, "Notifying", and "Host an event" forced onto a single inline row.
  - Expanded layout: the Home header button is hidden when Back already returns to the home card.
  - Profile: sign-out moved inline with the name in the hero (new `ProfileView` `signOut` prop).
  - Followers/Following list: client-side search filter over name + handle.
  - Composers (direct messages + report comments): Enter sends, Shift+Enter inserts a newline (web, IME-safe).
  - Message editing: edit your own direct messages and comments via a shared `MessageEditModal`, with an "(edited)" marker. New `editDmMessage` / `editDiscussionMessage` client endpoints + `EditChatMessageRequest` / `EditDiscussionMessageRequest` schemas; `useChat().edit()` and `useEditDiscussionMessage` hooks.

## 0.8.0

### Minor Changes

- 85c89c0: Home "Your next event" backed by a viewer-scoped events filter.

  - Contract: `ListCleanupsRequestSchema.when` gains `"attending"` - a viewer-scoped filter returning the upcoming events the signed-in viewer is a member of (RSVP'd or hosting, since the organizer is auto-joined), soonest-first. Anonymous callers receive an empty list. Additive (the other `when` values are unchanged), so existing consumers keep parsing.
  - UI: new `useAttendingCleanups` hook (auth-gated, keyed `["cleanups","attending"]`, refetched by the RSVP settle invalidation). The home sidebar's "Your next event" now reads `data[0]` instead of client-filtering the global upcoming list, so an attending event outside the nearby radius is never missed; the suggested-events gallery excludes everything the viewer already attends.

  The matching backend implementation (the `when=attending` membership filter in the cleanup list query) ships in the civfix-backend repo and consumes this contract once published.

- 98d7145: Profile-picture upload + Followers/Following lists.

  - Contract: `UpdateProfileRequestSchema` gains an optional `avatarUploadId` (a finalized media upload id) so the own-profile avatar picker can set a profile photo through the existing media pipeline. Adds `ConnectionsListQuerySchema` and two endpoints — `listFollowers` (GET `/people/:id/followers`) and `listFollowing` (GET `/people/:id/following`), both anon-ok and cursor-paginated, reusing `ListPeopleResponseSchema`.
  - UI: the own-profile avatar shows a camera affordance that picks an image, uploads it (presign → PUT → finalize), and sets it via `PUT /me/profile`. Tapping the Followers/Following cells opens a new `ConnectionsBody` list (new `followers`/`following` nav kinds), each row a tappable person with a Follow button.

## 0.7.0

### Minor Changes

- a316a4e: Add event<->report linking (contract + community UI).

  UI (@civfix/ui):

  - shared CleanupForm (used by Create + the new host-gated EditCleanupBody) with a Cleanup|Other Volunteer kind selector, a "Meet location" relabel, and an inline cleanup-only linked-reports picker.
  - EventDetailBody "Reports we'll handle" gallery + host Edit affordance; ReportDetailBody "Host an event" pill (auth-gated) + "Cleanup events" gallery + a synthesized "Linked to cleanup" timeline node from ReportDTO.linkedEvents.
  - map: EventPin diverges by eventKind (cleanup gold calendar vs other_volunteer marker) and the Map.web marker signature includes eventKind; new nav DetailKind "edit-cleanup" (/cleanups/:id/edit) + a reportId thread-through for host-from-report; useUpdateCleanup hook.

  Contract (@civfix/shared), additive + backward-compatible.

  - entities: new EventKindSchema (cleanup|other_volunteer) + EVENT_KIND_VALUES/EVENT_KIND_LABELS, and the light cross-refs LinkedReportRefSchema + LinkedEventRefSchema for the linking galleries.
  - CleanupDTO gains eventKind (default "cleanup") and linkedReports (default []); ReportDTO gains linkedEvents (default []).
  - cleanups: CreateCleanupRequest gains eventKind (default "cleanup") + optional linkedReportIds; new UpdateCleanupRequest (strict, all-optional) for PATCH /cleanups/:id.
  - map: CleanupPinDTO gains eventKind (default "cleanup") so the map can branch the marker.
  - admin: AdminEvent list/detail gain eventKind + linkedReports; the event timeline kind enum adds "linked"/"unlinked"; AdminReportDTO gains linkedEvents.
  - client: new endpoints updateCleanup (PATCH /cleanups/:id), linkEventReports (POST /admin/events/:id/link-reports), unlinkEventReport (DELETE /admin/events/:id/reports/:reportId).

- bd2e090: Add user document-verification + expanded-profile contract (additive, backward-compatible).

  - entities: PersonDTO gains `verified` (optional). Because PersonDTO is embedded as CleanupDTO.organizer and extended by UserProfileDTO, this lights the verified mark on profiles, person detail, event hosts, and chat authors from one field.
  - common: new MediaPurposeSchema (report|verification) — verification document media is isolated from the public report-media serve path.
  - verification (new module): VerificationStatusSchema (unverified|pending|verified|rejected), VerificationDocumentSchema, MyVerificationDTO, ApplyForVerificationRequest (uploadIds + note), and the document signed-URL response.
  - social: UpdateProfileRequest gains optional `bio` (max 500) for the own-profile bio editor; new per-user activity DTOs (UserActivityKind/UserActivityItemDTO/UserActivityListQuery/Response) for GET /people/:id/activity.
  - admin: new admin/verification module (AdminVerificationDTO + list/approve/reject); AdminUserDTO gains optional `verificationStatus`.
  - client: new endpoints listUserActivity, myVerification, applyForVerification, myVerificationDocumentUrl, listAdminVerifications, getAdminVerification, adminVerificationDocumentUrl, approveVerification, rejectVerification.

- 04a348d: Add a public per-report DISCUSSION, separate from the status timeline (additive, backward-compatible).

  @civfix/shared (contract):

  - entities (new, cross-domain): DiscussionMessageDTO (id, reportId, parentId, author, body, attachments: MediaDTO[], reactions, replyCount, cityMention, forwardedToCity, timestamps, mine), DiscussionAuthorDTO, ReactionSummaryDTO, CityMentionDTO.
  - discussion (new module): CreateDiscussionMessageRequest, ToggleReactionRequest, the history query/page schemas, DISCUSSION_BODY_MAX (4000), REACTION_EMOJIS (the 6 ASCII reaction names) + ReactionEmoji.
  - reports: ReportDTO gains optional discussionCount, cityHandle, cityName, canForwardToCity (powers the Discussion tab + the @city chip without a second fetch).
  - ws: RoomKind gains "report_discussion"; WsServerMessage gains a { type:"discussion", reportId, event } refresh-signal frame.
  - client: new endpoints getReportDiscussion, getDiscussionReplies, postDiscussionMessage, toggleDiscussionReaction, deleteDiscussionMessage (public read, sign-in to write), plus admin getAdminReportDiscussion + removeDiscussionMessage.

  @civfix/ui (community UI):

  - ReportDetailBody gains a "Timeline | Discussion" segmented tab. Timeline = the existing status-update rail (unchanged); Discussion = the new public thread. The dead client-only "Send a follow-up" composer + its synthesized timeline node were removed.
  - New data hooks (useReportDiscussion / useDiscussionReplies / usePostDiscussionMessage / useToggleReaction / useDeleteDiscussionMessage) under a dedicated ["discussions", ...] query-key namespace, plus realtime refresh over the existing chat WebSocket (a public report_discussion room).
  - New primitives: ReactionBar/ReactionChip, DiscussionMessageRow, DiscussionComposer (threaded replies, reactions, media attachments, and a report-scoped @city mention chip that forwards to the report's own jurisdiction by email).

## 0.5.2

### Patch Changes

- Add the `dm` notification type to `NotificationTypeSchema` for direct-message bell notifications, and cap chat/DM message bodies at 150 characters via a new `MESSAGE_BODY_MAX` constant with `.max(MESSAGE_BODY_MAX)` on the WS `send` frame body (enforced server-side at the gateway for both cleanup group chat and 1:1 DMs, mirrored client-side as the composer `maxLength`). Both changes are additive and backward-compatible.

## 0.5.0

### Minor Changes

- 09cb3f2: Admin contract data-quality pass:

  - Remove the meaningless "Verified neighbor"/trust label (every OTP account is email-verified, so it
    carried no signal): drop `TrustLabelSchema`/`TrustLabel` and the `trust` field from `AdminActorRef`,
    `AdminUserListItemDTO`, and `ModerationUser`.
  - Add server-side per-bucket list counts so the filter chips are accurate (not first-page-capped):
    `counts` on the reports / users / events list responses.
  - Add the user `messages` tab count to `AdminUserDTO`.
  - Add `setEventOutcome` (`POST /admin/events/:id/outcome`) — log a cleanup's bags collected (the only
    write path for `cleanups.bags`).

## 0.4.0

### Minor Changes

- a05e06a: Add additive datetime helpers (eventChip, dowLabel, timeLabel) used by the shared event/cleanup bodies.
  Backward compatible; existing consumers keep compiling.
