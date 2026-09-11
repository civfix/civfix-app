# @civfix/ui

## 0.59.0

### Minor Changes

- Organization affiliation, the event dashboard, and the feed / navbar revert. The verified community
  organizer ("verified neighbor") system is retired from the UI: the Get verified row and screen, the
  `verify` nav kind and `/verify` route, the person badges, the log-hours and request-resources gates
  and the create-event notice are all gone. Org verification, the `VerifiedBadge` primitive and the
  report auto-forward flag are untouched.

  Consumes `@civfix/shared` `^0.43.0`.

  ### Affiliation
  - `OrgAffiliationBadge` primitive (organization logo, optional name) next to author names in
    `PostCard`, the thread focal post and reply rows, `EventCard`, `RosterRow`, `EventsBody` and
    `ConnectionsBody`.
  - `AffiliationRow` - the labelled organization row on own and other profiles; pressing it opens the
    organization page. It is the only affiliation surface on a profile; the hero shows the name alone.
  - Posts composed as an organization render the organization as the author with a "via @handle"
    secondary line; `postCardModel.buildPostIdentity` is the single source of that identity.
  - "Post as" picker in `PostComposer` and "Host as" picker in `CleanupForm` / `CreateCleanupBody`,
    both Personal plus every organization the viewer belongs to; the create-event nav entry carries an
    optional `organizationId` that prefills the picker.
  - Settings -> Account gains "Organization on profile" (Automatic, or a specific membership), writing
    `primaryOrganizationId` through `updateSettings`.
  - `OrgPageBody` gains Upcoming and Past event sections backed by `listOrganizationEvents`; Past
    loads only when opened.

  ### Event dashboard
  - New nav kind `event-dashboard` (`/dashboard`, title "Event dashboard"), reached from the row that
    replaced Get verified on your own profile, plus web `/dashboard` and the mobile deep link.
  - Personal and Organization tabs (the organization tab appears only when the viewer belongs to one,
    with a picker above two or more).
  - KPI strip over `hostedEventsAnalytics` with a dependency-free `Sparkline`, range chips for 30 days
    / 90 days / 12 months, and the existing small-sample suppression copy.
  - Upcoming / Past hosted events with per-row Open, Host tools, Email attendees, Duplicate and Edit;
    Email attendees pushes the quick broadcast with the email channel and the registered segment
    preselected; Duplicate opens a date sheet, calls `duplicateCleanup` and lands on the copy's edit
    screen.
  - Invitations: pending event-team invites (moved here from the feed) and pending organization
    invites, each accept or decline.
  - Organization tab adds Money (payments status, available and on-the-way balance, "Export money to
    bank" with a confirmation, recent payouts, and the Stripe onboarding link opened through the
    injected external-URL capability) gated on `view_donations` with the payout action gated on
    `manage_payments`, and Collaborators (members, role changes, removal, invite by handle or email,
    pending invites and revoke) gated on `manage_team`.
  - Web-only "Open full console" row into `/manage/*`; the native build renders nothing there.

  ### Feed, navbar, map, search, header
  - `YourEventsSection` is gone from the feed. The expanded (desktop) layout renders an inline
    composer at the top of the feed; the compact layout keeps the header plus button, which is hidden
    when expanded.
  - The center tab is a camera labelled "Report" and opens the report flow directly (mobile lands on
    the viewfinder, web on the wizard capture step). `CreateMenu`, its store and its layout are
    deleted; the landscape rail follows.
  - The map loses its header plus button and the "Host an event here" drop-pin card; "Report an issue
    here" and the report-detail "host an event" link stay.
  - Native search open and close are both a 200 ms standard-ease timing, with mirrored reveal and exit
    windows.
  - One header control token set (`bodies/headerControls.ts`): 52pt controls and avatars with 26pt
    glyphs, applied to the feed, inbox, search, report root, both map layouts and the detail header.

  ### Data
  - New hooks: `useOrganizationEvents`, `useOrganizationMembers`, `useOrganizationInvites`,
    `useInviteOrganizationMember`, `useRevokeOrganizationInvite`, `useSetOrganizationMemberRole`,
    `useRemoveOrganizationMember`, `useMyOrgInvites`, `useAcceptMyOrgInvite`, `useDeclineMyOrgInvite`,
    `useOrgPaymentsStatus`, `useOrgDonationSummary`, `useOrgBalance`, `useOrgPayouts`,
    `useCreateOrgPayout`, `useCreateOrgStripeAccountLink`, `useHostedEventsAnalytics` and
    `useDuplicateCleanup`. `useMyVerification` and its query key are removed.
  - A payout keeps one idempotency key per organization and amount until the call succeeds, so a retry
    after a timeout cannot send the money twice.

  ### Breaking (internal)
  - `ProfileView`'s `verificationSlot` prop is now `dashboardSlot`.
  - Nav kind `verify` and the `/verify` route no longer exist; `nav:create.*`,
    `home-feed:your_events.*`, `map-ui:dropPin.host.*` and the verification copy are deleted from all
    four locales.

- Updated dependencies
  - @civfix/shared@0.43.0

## 0.58.2

### Patch Changes

- Fix the native Messages row swipe parking mid-lane: a short drag on a closed row now animates home on release instead of leaving part of the Mute / Delete actions exposed, and starting a drag on one row closes whichever other row is open.

## 0.58.1

### Patch Changes

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
  (`POST /org-invites/accept`, `{ token }` only). `InviteOrganizationMemberResponse` gains optional
  `invite`. `MAX_ORG_INVITES_PER_ORG = 50`. `OrganizationDTO` gains optional `suspended`.

  Consumes `@civfix/shared` `^0.41.0`.

- Updated dependencies
  - @civfix/shared@0.41.0

## 0.58.0

### Minor Changes

- Host Mode, ticketed registration, tickets + check-in, organization pages and donation surfaces.

  Consumes `@civfix/shared` `^0.40.0`.

  ### Nav
  - Six new `DetailKind`s with URLs, titles, bodies and layouts: `host-mode`
    (`/cleanups/:id/host`), `host-checkin` (`/cleanups/:id/checkin`), `host-broadcast-quick`
    (`/cleanups/:id/broadcast`), `my-ticket` (`/cleanups/:id/ticket[/:seatId]`), `org` (`/orgs/:slug`)
    and `my-donations` (`/me/donations`).
  - `DetailEntry` gains `slug` and `seatId`, and `entryIdentity` discriminates on both.
  - `/e/:slug` now resolves in-app to the event detail, so a shared signup-page link opens the event
    rather than dead-ending.
  - `host-broadcast-quick` is the only new `FLOW_KIND`: it holds an unsaved message.

  ### Bodies
  - `HostModeBody` - the day-of surface: live counters (20s poll + the `host` realtime signal), scan,
    check-in, quick message, walk-up, and the roster.
  - `EventRosterBlock` - a contact-free registration roster with search, filter chips and one-tap
    check-in/undo. Usable by staff; it carries no addresses at all.
  - `HostCheckinBody` - scan-result cards for every `CheckinOutcome`, manual code entry, an offline
    outbox pill with retry, and undo.
  - `HostBroadcastQuickBody` - subject + markdown-subset body + audience segment, in-app and push only.
  - `MyTicketBody` - one QR per seat (swipeable, seat-addressable from the URL), the event's when/where
    in the EVENT's timezone, add-to-calendar and cancel.
  - `OrgPageBody`, `MyDonationsBody`, `HostWalkupSheet`, `HostCounterStrip`.
  - Registration parts: `RegistrationBlock`, `TicketTypePicker`, `PartySizeStepper`,
    `RegistrationQuestions` (all six question kinds incl. single-level `showIf`), `ConsentChecks`
    (share-identity opt-in defaults OFF) and `WaitlistJoinCard`.

  ### EventDetailBody
  - UI gating now reads the server-computed `CleanupDTO.myCapabilities` instead of comparing role
    strings, with an organizer fallback for a server that predates the field.
  - A "Host dashboard" action row (web navigates to `/manage/events/:id`, native pushes Host Mode) via
    the new `hostDashboardTarget` seam; staff see only "Check in attendees".
  - `RegistrationBlock` replaces `RsvpPill` **only** when the event has ticket types; every other event
    keeps the one-tap pill unchanged.
  - `EventGuestsBlock` gains `canViewContact` (default false): guest contact needs
    `view_guest_contact`, so staff read the roster with the address withheld.
  - A `DonateBlock` renders below the action rows when the event's org has donations enabled.
  - `GuestRsvpSheet` carries ticket type, party size, questions and consent when the event has ticket
    types, so a guest registration is never a row with no consent artifact behind it.

  ### Primitives
  - `QrTicket` (+ the pure `qrPath` matrix→SVG merge), `Markdown` (AST from `@civfix/shared/markdown`,
    never HTML), `DonateBlock`, `scannerPresenter` (`setScanPresenter` / `scannerAvailable` /
    `presentScanner` / `resolveScan`), `saveCalendarFile` and the `donateTarget` seam.
  - `externalUrls` is now the single source of `WEB_ORIGIN` plus `donatePath`/`donateUrl`,
    `managePath`/`manageUrl`, `orgPagePath`, `signupPagePath` and `legalUrlFor`; `primitives/share`
    re-exports `WEB_ORIGIN` from it.
  - `TermsConfirmation` takes optional `documents` + `onAccept` and reads versions from
    `@civfix/shared/legal`; its URLs come from `externalUrls`.
  - `SecondaryButton` gains `disabled`.

  ### Data
  - One upload orchestrator, `data/uploadMedia` (prepare → presign → PUT → finalize, with `onProgress`
    over XHR on web). The report wizard, composer attachments and the avatar editor all route through
    it; the three duplicates are gone. `report/submit` re-exports `putUpload` unchanged.
  - `data/checkinOutbox` - a pure, persisted check-in outbox (dedupe per seat, backoff, 48h ceiling,
    `CONFLICT` counts as success).
  - New hooks: `data/hooks/host` (counters, roster, ticket types, questions, team, waitlist, register,
    cancel, scan, check-in, undo, walk-up, my ticket, quick broadcast, hosted events),
    `data/hooks/orgs` and `data/hooks/donations`, plus `hasHostCapability` / `actsAsHost`.
  - New query-key families (`hostEvent`, `hostCounters`, `hostRoster`, `hostTicketTypes`,
    `hostQuestions`, `hostTeam`, `hostWaitlist`, `myRegistration`, `myTickets`, `org`,
    `myOrganizations`, `hostedEvents`, `myDonations`, `orgDonate`). `myTickets` sits OUTSIDE the host
    prefix on purpose: a seat token is a capability and must never reach a persisted cache.
  - `invalidationKeysForTopic` handles the `host` topic and takes an optional id, so one event's frame
    refreshes one event's caches.
  - `useUpdateCleanup`'s `patch` is now `Omit<UpdateCleanupRequest, "id">`, which retires the
    `as unknown as` cast the mutation needed.

  ### Correctness + privacy invariants worth naming
  - The ticket prints the **whole** seat token (hyphen-grouped, `formatTicketCode`), and
    `normalizeManualCode` mirrors the server's normalizer exactly (strip whitespace + hyphens,
    uppercase). Manual check-in previously printed an 8-char prefix the server could never match.
  - The check-in outbox is scoped per event in `dequeueReady`/`pending`, so one event's stale queue can
    no longer starve the event being run, and the badge counts only what this screen can drain. It is
    kept in the **secure** store, because its entries carry seat tokens.
  - The registration consent artifact stamps `disclosureVersion` from **`privacy`** (what the server
    validates and what the copy names), always emits `smsOptIn` from state, and records `surface` from a
    `consentSurface.{web,native}` seam — a registration taken in the app is no longer recorded as web.
  - `EventDetailBody` gates the guest-contact roster on `view_guest_contact` (the capability its
    endpoint actually requires) and gives a `view_roster`-only actor the contact-free `EventRosterBlock`
    instead. Both gates are capability-only; the `|| actsAsHost` disjunctions are gone.
  - `DonateBlock`'s state comes from the authoritative `getPublicOrgDonationPage` read on both callers.
    `CleanupDonationOrgRef.enabled` is true for READY **or** AT_RISK, so it cannot stand in for the gate.
  - The registration idempotency key is minted once per attempt-set and rotated only on success, so a
    retry after an ambiguous timeout replays instead of booking a second seat.
  - Add-to-calendar is hidden rather than failing on a platform that cannot produce the file
    (`calendarSaveAvailable`), and `useScannerAvailable` re-renders the Scan affordance when a host
    registers its presenter after mount.

  ### Capabilities, icons, i18n
  - `OpenExternalCapability.openInAppBrowser?(url)` (optional; native hosts provide it).
  - Icons: `QrCode`, `ScanLine`, `Ticket`, `TicketCheck`, `Building`, `UserCheck`, `Hourglass`,
    `HandHeart`, `ReceiptText`.
  - New namespaces in all four locales: `host-common`, `host-mode`, `host-ticket`, `host-checkin`,
    `host-broadcasts`, `host-org`, `donations`; plus additions to `enums`, `event-detail`,
    `event-guest-rsvp`, `nav`, `settings` and `mobile-system`.
  - `mobile-system` gains the ticket-scanner and notification-action copy the mobile app was rendering
    through `defaultValue` fallbacks: `notification_action_view_ticket`,
    `notification_action_open_event` and the `scan.*` tree (`title`, `hint`, and `gate.{title,body,`
    `continue,open_settings,no_camera_title,no_camera_body}`), translated in all four locales.

  ### The legacy donate row is now "Support civfix"
  - The About card's donate button and the Settings About row still open `DONATE_URL`
    (`reachoutla.org/help`, the nonprofit behind civfix) — the URL is deliberately unchanged and stays
    pinned by `primitives/__tests__/settingsRow.test.ts`. Only the LABEL moves: `about.donate` →
    `about.support_civfix`, `about.donate_a11y` → `about.support_civfix_a11y` (which still names the
    destination org) and `settings.donate` → `settings.support_civfix`, in all four locales.
  - Reason: 0.58.0 introduces per-organization donation surfaces (`DonateBlock`, `/donate/:orgSlug`)
    that also read "Donate". Two different "Donate" affordances with two different destinations in one
    app is an app-review risk and a user-comprehension problem; "Support civfix" says which of the two
    this one is without pretending the destination changed.

  ### RN-free `@civfix/ui/theme/schemes` subpath
  - `theme/schemes` is now published as its own `exports` entry. It imports nothing but
    `@civfix/shared/tokens`, so a plain-DOM consumer (community-web's host console) can read scheme
    names, palettes and the appearance rules without `@civfix/ui/theme`'s barrel dragging in
    `react-native` — which, in a node test runner, is a hard parse error on RN's Flow-typed source.
  - It gains `colorSchemes` / `shadowSchemes` re-exports (plus the `ColorPalette` / `ShadowTokens`
    types), `DEFAULT_COLOR_SCHEME`, `isColorSchemeName` and the pure `resolveSchemeName(input)`, which
    `resolveColorScheme` now delegates its system-scheme fallback to. Everything stays re-exported from
    `theme/index.ts`, so no existing import changes.
  - An eslint fence (`RN_FREE_FILES`) and a source-text test
    (`theme/__tests__/schemesRnFree.test.ts`) both hold the file to zero react / react-native imports.

  ### `uploadMedia` returns the media id
  - `UploadedMedia` gains `mediaId` — the id `finalizeMedia` answers with, which is a DIFFERENT column
    from `uploadId` and the one `coverMediaId` / `logoMediaId` (and every other media-asset reference)
    need. Additive: existing fields and `uploadMediaId()` are unchanged. Consumers that were re-calling
    `finalizeMedia` purely to read the id back can drop that round trip.

  ### Add-to-calendar is a host capability on native, and one calendar identity everywhere
  - `useOrgDonationExports(orgId)` + `queryKeys.orgDonationExports` — `GET /orgs/:id/donations/exports`,
    the retrieval path for the org-scoped `donations` export that `listEventExports` can never return.
    POLLED while a row is `queued`/`running` (nothing publishes a realtime topic when an export is
    ready; the only `host` signal publisher carries an event id), so `invalidationKeysForTopic` is
    unchanged.
  - `useEventIcs(id)` / `fetchEventIcs(api, id)` + `queryKeys.eventIcs` — `GET /cleanups/:id/ics`, keyed
    as a CHILD of `cleanup(id)` so a reschedule invalidates the calendar file with the event.
  - **`calendarFile` capability (optional).** `CalendarSaveInput` drops `icsUrl`/`openExternal` and
    takes a host `writer`. `MyEventTicketDTO.icsUrl` points at a JSON endpoint (DECISIONS §29), so
    opening it externally shows a page of JSON, not a calendar entry — native must write the document
    and hand it to a share sheet, which `@civfix/ui` cannot do itself. `calendarSaveAvailable` on native
    is now the presence of that writer, so the affordance stays hidden on a host that provides none.
    Web is unchanged (it hands the browser a Blob). `makeFakeCapabilities()` deliberately provides NO
    writer — the mobile host builds on it, and a no-op writer would show a button that does nothing.
  - `MyTicketBody` offers the SERVER document and NOTHING else. `getEventIcs` is the only builder that
    sees the description, the public URL and the CANCELLED status; `MyEventTicketDTO` carries the
    REGISTRATION status, so a local `buildIcs` fallback would sit on the shared `eventIcsUid` identity
    saying CONFIRMED for an event the host had cancelled, with no path that could ever correct it. A
    failed read shows `host-ticket:calendar.error` instead.
  - i18n: `host-payments.exports.*` + `settings.refund_policy_error`, `host-team.role.confirm_*` /
    `error_*`, `host-tickets.questions.ticket_scope_hint`, in all four locales.

  ### Adversarial-review fixes (round 1)
  - **`MyTicketBody`'s pager is measured, not windowed.** The page width, the snap math, the QR edge
    length and the `/ticket/:seatId` seed all come from the pager's own `onLayout` now. It used
    `useWindowDimensions().width`, which on desktop web is the WINDOW while every body renders inside a
    300-640 px sidebar card: a 1440 px page centred a 260 px QR at x≈590 and put it entirely outside the
    visible column, snapped in container-sized steps across window-sized pages, mis-reported the page
    indicator and overshot a seat deep link. New pure helpers on `bodies/host/ticketModel`:
    `ticketPageWidth`, `ticketQrSize`, `ticketPageIndex`, `ticketSeatIndex`, `ticketSeatOffset`, tested
    at a viewport narrower than the window.
  - **`useQuickBroadcast` is retry-safe.** One press used to be `create` + `send` with nothing retained,
    so a LOST send response left Send enabled and the second press created a SECOND draft: two pushes
    and two in-app messages to every registrant, invisible to the per-event caps. The created draft id
    is now retained for the life of the composer, a retry re-sends the SAME draft, and the server's
    `CONFLICT` on a broadcast already `sending`/`sent` is read as the success the lost response carried
    (a conflict whose fan-out never started still surfaces as an error). `HostBroadcastQuickBody`
    renders the retained-draft state (`host-broadcasts:quick.retry_note`, all four locales) and disables
    Send while a send is in flight. The pure `sendQuickBroadcast` + `broadcastFanoutStarted` are
    exported and tested. FOLLOW-UP: the durable fix is an `idempotencyKey` on the contract's
    `createEventBroadcast`, the shape `registerForEvent` already uses; it is deliberately NOT in this
    release.
  - **A retained draft carries the host's EDITS.** Retaining only the draft ID meant a retry re-sent the
    text and audience of the FIRST attempt: the common failure is the send cooldown, the host fixes a
    typo or switches the audience, presses Send, and the original message fans out while the toast says
    sent. The retained draft now keeps the vars it was created with (`RetainedQuickDraft`); a retry
    whose vars differ `PATCH`es the draft before sending it, and a `CONFLICT` on that update whose
    broadcast already started fanning out returns `{ kind: "edits_lost" }` - surfaced as its own copy
    (`host-broadcasts:quick.edits_lost`), never as a success. The composer also gains an explicit
    "Discard draft" action (`deleteEventBroadcast`, `CONFLICT` = already sending) that releases the
    retained id, and the confirm sheet always states the subject and audience that will go out.
  - `RegistrationBlock`'s `cancelled` surface renders the FULL registration form (ticket type, party
    size, questions, consent) with a "you cancelled" note, instead of a lone Register button that could
    only ever fail on the missing consent it never rendered. The backend admits the re-registration: its
    already-registered guard counts only rows still in status `registered`. `registrationSurface` now
    ranks the window states ABOVE a cancelled registration - a cancelled row holds no seat, so a closed
    or not-yet-open event says so rather than offering a form that must be refused.
  - `HostModeBody` / `HostCheckinBody` gate the counters query on `check_in`, not on "the event
    loaded". `GET /cleanups/:id/checkins/counters` requires the capability, so a denied viewer (or a
    `view_roster`-only actor in Host Mode) was polling a 403 every 20 seconds for as long as the body
    stayed mounted.
  - `MyDonationsBody` shows the loading state while auth is still pending, instead of flashing the EMPTY
    notice before sign-in resolves.
  - `MyTicketBody` passes the app locale to `ticketWhen`.
  - `EventDetailBody`'s host standing is the new pure `managesEvent` (`@civfix/ui/data`): the
    `manage_event` capability, with the event-role STRING admitted ONLY when the server sent no
    capabilities at all. The role-string OR was unconditional, which re-granted a demoted organizer the
    host affordances the server had just taken away.
  - `QrTicket` reads `qrInk` / `qrPaper` from `@civfix/shared/tokens` instead of raw `#000000` /
    `#FFFFFF`. The pair is scheme-invariant on purpose (scanner luminance contrast).
  - `fakeOpenExternal` bounds its `opened` / `openedInApp` logs to the last
    `FAKE_OPEN_EXTERNAL_LOG_MAX` (50) urls; they are module singletons and grew without limit.
  - Inline `//` rationale blocks removed from the new host sources per the comment-free rule (JSDoc on
    exports stays, matching the package idiom); `data/eventIcs`'s header no longer claims a client-side
    `buildIcs` fallback that DECISIONS §29 removed.
  - Web's `secureStore` is the in-memory `FakeSecureStore`, so the check-in outbox on web is
    MEMORY-ONLY by design: seat tokens are capabilities and must not reach `localStorage`. Queued
    manual check-ins there do not survive a reload. Native hosts inject a real secure store and persist.
  - Dev-dependency: `vitest` `^2.1.8` → `^3.2.7` (major). Test-only; the suite passes unchanged under
    it and nothing in the published surface moves.
  - Deliberately NOT changed: `fontSize: 11`, `letterSpacing`, `gap: 6`, `minHeight: 44` and
    `borderWidth: 1.5` in the new bodies. No token exists for any of them (`fontSize` starts at 12,
    `space` steps 4→8, there is no border-width scale), and the raw values are the package's own
    pervasive idiom - the uppercase micro-label is byte-identical in `EventHoursBlock`,
    `EventSlotsBlock` and `NotificationPrefsBody`. Inventing tokens for the new files alone would make
    them the inconsistent ones.
  - The check-in outbox replay no longer drains silently. `replayOutcome` returns
    `{ disposition, dropReason }` over four classes instead of one string: `UNAUTHORIZED` now HOLDS
    (the entry stays queued and untouched, no attempt spent, and the batch stops - a session that
    expired mid-event used to throw every queued door check-in away), `FORBIDDEN` drops but is reported
    by count as a revoked capability, `NOT_FOUND`/`VALIDATION` drop with a reported count, and
    `CONFLICT`/`RATE_LIMITED`/`INTERNAL` are unchanged. The new pure `runReplay` carries the server's
    `CheckinResultDTO.outcome` into a `CheckinReplayReport`, so a queued scan that replays as
    `cancelled`, `wrong_event`, `waitlisted`, `no_show` or `unknown_token` is surfaced instead of
    counted as a success. `CheckinOutbox` gains `report` + `dismissReport`; `HostCheckinBody` renders
    the report once, dismissable, under the new `host-checkin:replay.*` keys (en/es/de/ko).
  - The replay's HELD count reports every entry still waiting for this event, not just the tail of the
    dequeued batch (`ReplayDeps.scope`), so a queue longer than one batch no longer under-reports what a
    dead session is holding.
  - `useCheckinOutbox` buffers scans that arrive while the persisted queue is still being READ and folds
    them onto it (`mergeQueued`), instead of persisting `[new]` over the stored blob and then losing it
    to the load; a replay is refused until that read settles.
  - `GuestRsvpSheet` reseeds its answers when the registration questions arrive AFTER the sheet opened
    (the shared `seedAnswers`, which `RegistrationBlock` now uses too). Without the seed a `showIf`
    whose `equals` is `false` compared against `undefined`, so a question meant to show for an unchecked
    box never rendered for a guest.

## 0.57.0

### Minor Changes

- Appearance default, the in-map theme toggle, and the expanded-layout metrics.

  ### Appearance
  - The shipped default preference is now `light`, exported as `DEFAULT_APPEARANCE_PREFERENCE` from
    `@civfix/ui/theme`. `system` applies only once the user picks it, so nobody lands in the beta dark
    scheme without choosing it. Hosts should read the constant instead of hardcoding a fallback.
  - Dark is labelled **Beta** in the picker, with a caption saying some screens may look off.
  - New `AppearanceOptionList` export (`@civfix/ui/bodies`): the one three-option picker, mounted by both
    `AppearanceSettingsBody` and the map toggle. Rows announce `checked`/`busy` (and the matching
    `aria-checked`/`aria-busy` on web), the selection haptic fires only when the tap actually changes the
    selection, and an external preference write while a tap is in flight wins over the pending tap.

  ### In-map theme toggle
  - `MapControls` (expanded chrome) and `MapHeaderActions` (compact header) render an appearance toggle.
    It is web-only through the `themeTogglePlatform` seam - native keeps Settings > Appearance.
  - The popover is edge-aware: it hangs off the trigger's right edge, clamps into the viewport and shrinks
    on narrow screens, dismisses on an outside tap and on Escape, and its trigger exposes `expanded` to
    assistive tech.
  - `GlassButton` and `HeaderIconButton` take an optional `expanded` prop for that state.
  - New `AnchoredPopover` and `useMenuCardSize` exports (with `AnchoredPopoverProps` and `MenuCardSize`)
    from the root barrel: the one Modal + scrim + anchored-card presentation, shared by `PopoverMenu` and
    the map toggle. Both measure their anchor and their card before the entrance animation starts, and
    both dismiss through the Modal's `onRequestClose` (which react-native-web maps to Escape) instead of
    wiring a document listener.
  - `themeMenuFrame` / `themeMenuPlacement` are the toggle's internal placement math - they compute the
    card's window-frame position from the measured trigger and are not part of the public surface.

  ### Report timeline
  - `timelineEntryRender`, `visibilityKindOf` and `TIMELINE_VISIBILITY_KINDS` are exported from the root
    barrel, and `NodeKind` gained `hidden`, `unhidden` and `note`.
  - Any row that does not change the status and is not a visibility or reply row now renders as the
    "Update" note node instead of a contradictory "Not yet forwarded" status row.

  ### Brand-about presenter
  - `setBrandAboutPresenter` / `BrandAboutPresenter` let a host register how the brand-about surface opens;
    shared code calls `openBrandAbout()`.

  ### Layout and basemap
  - Expanded layout: rail metrics 56 / 10 / 10 (`RAIL_ITEM` / `RAIL_ITEM_GAP` / `RAIL_PAD_H`), tab divider
    1.5px in `theme.colors.textMuted` at a 0.5 height ratio, and an `EXPANDED_MIN_WIDTH` gate so the
    expanded frame is only used where it fits.
  - The CARTO raster basemap URL carries the `{ratio}` tile token, so retina tiles are requested where the
    renderer supports them.

  ### Removed
  - `MapControlsProps.onOpenBrand`. Hosts register `setBrandAboutPresenter` instead.

- Report timeline: an owner hide/re-list renders as its own "Hidden from the map" / "Shown on the map again" node instead of a false "Reopened" entry, and a reopen is only shown when the report actually returns from resolved or rejected.

## 0.56.0

### Removed

- The unused composer -> event hand-off seam: `planComposerCreateEvent`, `ComposerCreateEventPlan`,
  `setComposerEventFormPresenter` and `composerEventFormPresenter` are gone. Nothing in civfix-web or
  civfix-mobile referenced them; a consumer on `^0.55` that did must drop the usage before adopting.

### Minor Changes

- Dark mode, shipped end to end. `@civfix/ui/theme` gains `themes` (`{ light, dark }`),
  `themeFor(scheme)`, `ThemeProvider` (resolves `scheme` from an `AppearancePreference` -
  `"system" | "light" | "dark"` - plus react-native's `useColorScheme()`), `useColorSchemeName()`,
  `useThemePreference()`, `makeThemedStyles(factory)` (a per-call-site, per-scheme memoized
  `StyleSheet.create`), `makeThemeColors(scheme)` / `makeGlass(scheme)` / `resolveColorScheme` /
  `isAppearancePreference` / `APPEARANCE_PREFERENCES` / `COLOR_SCHEMES`, and the host-registered
  preference seam `setAppearancePreferenceStore` (+ `getAppearancePreference`,
  `setAppearancePreference`, `useAppearancePreference`, `makeMemoryAppearanceStore`). Every themed
  surface in the package is converted: ~157 modules now build their styles through `makeThemedStyles`
  and read colors from `useTheme()`, so shells, feeds, detail bodies, conversation/thread surfaces,
  composers, sheets, modals, settings, onboarding surfaces, `TextLink`, `FramedImage`, the skeleton set,
  toasts, haptics-backed affordances, `CreateMenu` and the wizard header all render in both schemes; the
  handful of remaining `StyleSheet.create` blocks hold layout-only values. `useTheme()` returns the
  scheme-resolved theme (identical to the static `theme` outside a `ThemeProvider` or under the light
  scheme); the static `theme` / `colors` / `glass` / `shadows` / `imageFrame` exports remain the LIGHT
  theme. `Theme` is now a widened structural type (color leaves are `string`, not literals) and carries a
  `scheme` field. The map follows the scheme too: the CARTO raster basemap is Voyager in light and Dark
  Matter in dark (`rasterMapStyle(attribution, { scheme })`, with `basemapPaper(scheme)` exposing the tile
  ground color for contrast checks), and pins, cluster bubbles and the drop pin take their fills from the
  active scheme. New detail kind `"appearance-settings"` (`/settings/appearance`,
  `AppearanceSettingsBody`, the `appearance-settings` i18n namespace, an `appearance` row in `settings`
  and `title.appearance_settings` in `nav`) reached from a new Appearance row in `SettingsBody` lets a
  user pin the app to System, Light or Dark.

- Onboarding-tour seam for the mobile welcome walkthrough. Adds the `mobile-onboarding` i18n namespace in all four locales (plus a `tour` entry in `settings`), the `gravity` motion recipe (`theme.motion.gravity`, `gravityStagger`, `gravityDrop`) the tour's drop/cascade choreography animates against, the `EASE_GRAVITY` bezier tuple and `EASE_GRAVITY_CSS` curve string that recipe is built on (exported from `theme/motion.ts`, with `EASE_GRAVITY_CSS` re-exported from `@civfix/ui/theme` beside `EASE_STANDARD_CSS`), and a live `useReducedMotion` export on `@civfix/ui/theme` so animated surfaces read the OS setting from one place. `HapticsCapability` gains optional `selection()` and `success()` so a host can supply the lighter tick and the completion pattern without every host having to. `Bubble`, `BubbleProps`, `DaySeparator`, `TypingBubble`, `ReportRowView`, `ReportRowViewProps` and `formatHoursDisplay` are exported from `@civfix/ui/bodies`, and `ReportRowView` takes an optional `onPress` that replaces its nav push for surfaces (the tour's demo stage) that must not navigate. `SettingsBody` renders a "Take the tour" row in the App section, under Language, whenever a host registers a presenter through `setOnboardingTourPresenter` (read back with `getOnboardingTourPresenter` / the subscribing `useOnboardingTourPresenter`, cleared by passing `null`), so the row appears on mobile and stays absent on web. That row's glyph comes from the shared icon map, which gains the `Compass` name (`IconName` + `iconMap`) rather than a one-off import.

- `GeolocationCapability` gains an optional `requestPermission(): Promise<boolean>`, separating ASKING
  for the OS location permission from READING a position. The method exists for a HOST's explicit,
  user-initiated location actions: a host whose `getCurrentPosition` / `watchPosition` only CHECK the
  permission (and reject when it is not granted) now has a seam through which its own screens can ask
  first. Every reader inside @civfix/ui stays PASSIVE and calls neither - `useUserLocation`,
  `ReportFlowBody`'s `resolveApproxCenter`, `AddressSearch`'s proximity resolve and `CreateCleanupBody`'s
  map seed all read the injected fix and degrade to `ipLocate()` when it is unavailable or denied, so no
  shared surface can raise an unprompted OS dialog. Hosts that do not implement the method are unaffected
  (web); the geolocation fake implements it and reports the permission as not granted.

## 0.55.0

### Minor Changes

- A deep-linked detail is a PAGE, not a pull-up. The nav store now records whether the active entry
  arrived through `seed` (a cold load, a popstate or a notification tap) and its kind is shareable content
  (`cleanup`, `pin`, `post`); `AppShell` ORs that into `fullPageDetails`, so on compact web a cold-loaded
  `/cleanups/<id>` renders as a full page on the shell's overlay layer instead of a half-height sheet over
  a home feed the visitor never asked for. Any in-app navigation (`push`, `openDetail`, `selectView`,
  `setStack`, a `back` to the root, `reset`) lowers the flag, so in-app details keep the sheet exactly as
  before. Native is unchanged: `DETAILS_ARE_FULL_PAGE` is already true there, so the OR is the identity.

- `entryFromPath` fixes two deep links. `/reports/<id>` (the form the backend's push notifications emit)
  now resolves to the report DETAIL rather than silently dropping the id and opening the my-reports list;
  bare `/reports` still opens the list, and `/pin/<id>` stays the canonical serialization. The parser also
  normalizes the shapes a shared URL actually arrives in - a trailing slash (civfix-web exports with
  `trailingSlash: true`), a `?query` and a `#hash` - which previously rode along inside the id segment.

- `GuestRsvpSheet` no longer looks idle while it mints a Turnstile token. The token await runs BEFORE the
  mutation, so a button keyed on `request.isPending` alone stayed enabled for up to ~30s and a second press
  spawned a second widget. A `sendingCode` flag (with a ref guard against a re-entrant press in the same
  frame) now covers the whole send, and drives the submit button, the resend link and the form's editable
  state. The send is awaited (`mutateAsync` + `finally`) rather than settled from per-call mutation
  callbacks, which `request.reset()` can detach mid-flight, and a sequence check discards the outcome of a
  send the guest has already moved past.

- The guest-RSVP sheet survives an INTERACTIVE Turnstile challenge. The challenge is painted outside the
  sheet's modal window, so a click aimed at it that lands a pixel wide hit the sheet's full-bleed backdrop
  and dismissed the sheet mid-verification. `ModalCardSheet` gains an optional
  `backdropDismissDisabled` (default false, so every other sheet is unchanged) that drops the backdrop's
  press while keeping the scrim opaque to clicks; Escape and the explicit Cancel action stay live, so the
  sheet is never a trap. `GuestRsvpSheet` sets it for the whole mint+send window, and now aborts an
  in-flight send when the sheet closes OR unmounts, so a token that resolves after dismissal can no longer
  fire an OTP request the guest never sees.

## 0.54.0

### Minor Changes

- CARTO basemap api key support. CARTO now watermarks keyless raster tiles, so `rasterMapStyle` takes an
  optional second argument (`{ cartoApiKey }`) and appends `?key=<key>` to each a/b/c tile URL through the
  new pure `withCartoKey(url, key?)` helper. The key is a PUBLISHABLE client-side value the host injects:
  `DataContextValue` gains an optional `cartoApiKey`, read by the new `useCartoApiKey()` selector (and
  supported by `makeFakeDataContext`), which `Map`, `MiniMap` and `LocationPicker` (web + native) pass into
  the default style. With no key injected the tile URLs are byte-identical to the ones shipped before, so
  the basemap keeps rendering (watermarked) everywhere - including hosts that never wire the key.
  Attribution is unchanged.

## 0.53.0

### Minor Changes

- Adopt `@civfix/shared` 0.38.0 and build the two UI surfaces it exists for: guest event RSVP, and a
  profile events section that finally distinguishes upcoming from past.

  **GUEST RSVP.** A signed-out neighbour can now say they are coming without creating an account. New
  `GuestRsvpSheet` (a `ModalCardSheet` body, so it inherits the dialog scaffold, Escape and Cmd/Ctrl+Enter)
  walks four steps - choice, form, code, confirmation - and resets to step one on every open:

  - CHOICE offers "sign in or create account" (which closes the sheet and hands the host gate the same
    `nextPath` the pill would have) beside "continue as guest". Signing in stays the encouraged path; the
    guest path is the one that was previously a dead end.
  - FORM takes a name plus ONE contact. The SMS channel is offered only when the session advertises
    `guestSmsEnabled` (absent means do not offer it - see the contract's section 19), and the SMS branch
    always carries the consent disclosure: rates may apply, one-time code and event updates only, reply
    STOP to opt out. A US number is auto-formatted while typing and converted to `+1` E.164 before submit,
    so the contract's deliberately narrow validator is satisfied on the client instead of at the boundary.
    When the server refuses SMS (provider unconfigured, or a cap hit) the sheet flips the channel to email
    and says so, rather than surfacing it as a failure the guest cannot act on. That refusal is recognized
    SOLELY by the server naming the `channel` field in `AppError.fields` - deliberately NOT by a bare
    `CONFLICT`, which the same contract already means as "this event is closed to new RSVPs". A backend
    that needs to signal an SMS-specific refusal must name that field (or the contract needs a dedicated
    code); anything else correctly surfaces as its own error instead of silently wiping the guest's number
    and telling them something false.
  - CODE is the shared 6-digit `SegmentedCodeInput`, with a resend that counts down from the server's own
    `resendAfterSec` and an attempts-exhausted state that offers "start over" instead of a retry that
    cannot succeed.
  - Every async action has a pending and a disabled state, and every refusal is mapped from the `AppError`
    code to localized copy through the pure `guestRequestErrorKey` / `guestVerifyErrorKey` (the
    `rsvpErrorKey` idiom) - the server's English message is never shown raw.

  **TURNSTILE IS A HOST CAPABILITY, AND THE FEATURE IS GATED ON IT.** `guestRsvpRequest` is a public,
  CSRF-exempt endpoint whose anti-abuse controls ride in the body, so it needs a Turnstile token - and
  minting one is entirely platform-specific. `DataContextValue` gains
  `getTurnstileToken?: (action: string) => Promise<string>` (read via the new `useGetTurnstileToken`,
  exactly like `submitReport`), and `GUEST_RSVP_TURNSTILE_ACTION` is exported as the action to scope it
  to. EventDetailBody wires the pill's signed-out diversion ONLY when the host injects it, so a host that
  does not keeps today's behaviour untouched instead of opening a sheet whose submit could never pass the
  boundary; the sheet additionally refuses to submit an empty token rather than letting a
  no-sitekey deployment fail as a generic error.

  **RSVP PILL SEAM.** `RsvpPill` gains an optional `onSignedOutPress`. When supplied AND auth has resolved
  to signed-out, a tap runs it instead of the host auth gate. Signed-in behaviour is unchanged, the
  still-resolving case deliberately falls through to `requireAuth` (a pending viewer is not yet known to
  be signed out), and every other RSVP surface - the events list, search hits, LinkedEventCard - omits the
  prop and behaves exactly as before.

  **HOST GUEST ROSTER.** New `EventGuestsBlock`, mounted on EventDetailBody for an organizer or cohost
  only: a count from `CleanupDTO.guestCount` that expands into the paged roster. It fetches NOTHING until
  expanded - it is the one surface that returns a guest's contact - renders loading/empty/error states, a
  cursor "load more", links the contact as `mailto:`/`tel:` on web while native shows plain text, mutes a
  cancelled guest rather than dropping the row, and renders an em dash where the contact has already been
  scrubbed (both the retention sweep and a guest's own cancel NULL it, so a client that assumed a value
  would have rendered "null").

  **NEW DATA HOOKS.** `useGuestRsvpRequest`, `useGuestRsvpVerify`, `useGuestRsvpCancel`, and the paged
  `useCleanupGuests(id, { enabled })`. On verify success `applyGuestRsvpToCaches` fans the server's
  authoritative `going` out to EVERY cached copy of the event - the detail under the canonical uuid key
  AND any reference-code alias (through `cleanupDetailFilters`), the matching row in every flat list under
  the `["cleanups"]` prefix, and the attendee roster's count - bumping `guestCount` wherever the payload
  carries it. Two things separate it from the member RSVP toggle and both are pinned by tests: `joined`
  never moves (a guest raises turnout without the signed-out viewer joining anything, so painting the
  member flag would light up "Going" on a pill no account is behind), and there is no optimistic phase (a
  guest is only real once the code is redeemed, so there is nothing to roll back).

  **PROFILE EVENTS: UPCOMING IS REAL NOW.** `splitProfileEvents` took one list and derived "upcoming" from
  `scheduledAt`, on the premise that `pastEvents` carried future events too. That premise is false as of
  the 0.38 contract, so it now takes `(pastEvents, upcomingEvents, profileId, now)`: the upcoming buckets
  come from `upcomingEvents` and the past buckets from `pastEvents`, each split only by who organized it.
  Passing `upcomingEvents: undefined` selects the OLD time-based split verbatim, so the section does not
  regress against a 0.37 server; an EMPTY array is deliberately not the same signal (it means the server
  answered "nothing upcoming"). PersonDetailBody, which split `pastEvents` into hosting/going by hand,
  now renders an "Upcoming" group above the past one off the same shared split - so a public profile and
  the owner's own can no longer drift. Note the upcoming list is viewer-scoped server-side: on someone
  else's profile it carries their HOSTING only, which is why "attending" is legitimately empty there.

  **PAST EVENTS PAGINATE.** New `useProfileEvents` plus the `useProfilePastEvents` controller both profile
  surfaces share. The profile's inline `pastEvents` is page one and `pastEventsCursor` is where it ended,
  so the infinite query STARTS at that anchor and the anchor is part of the cache key (a profile refetch
  that moves it starts a fresh accumulation instead of appending to a stale one). Nothing is fetched until
  the viewer presses "Show more" - a profile that is only looked at still costs one request - and the
  affordance appears on ProfileView and PersonDetailBody alike. The control's visibility is driven by an
  explicit state machine (`profilePastEventsModel`), not by react-query's `hasNextPage`: that flag is
  false whenever the query holds no pages, so reading it as "there is more history" would hide the control
  through the whole first fetch and, since the query is `retry: false`, hide it permanently after a failed
  one. It now stays mounted as a busy state while fetching and as an explicit retry on failure, and
  retires only on a successful page that reports no cursor after it.

  **i18n.** New `event-guest-rsvp` namespace and new `guests.*` / `events.load_more*` / `events.group_*`
  keys on `event-detail`, `profile-view` and `profile-person`, translated across all four locales
  (en/es/de/ko) and regenerated into `resources.ts`.

- Updated dependencies
  - @civfix/shared@0.38.0

## 0.52.2

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.37.0

## 0.52.1

### Patch Changes

- Wave A additive contract release.

  `@civfix/shared`: bound the WS client-frame `clientId` (1..64); add `MIN_EVENT_HOURS` and a minimum on per-attendee event hours; add `POST /push/unregister` with `UnregisterPushTokenRequest`; add optional `tz` to `QuietHours`; cap `RegisterPushTokenRequest.token` at 2048; add an `expect` param to `AbuseChecks.verifyTurnstile`; cap anon `mediaUploadIds` at 5; add optional `truncated` to `MailMessageDTO`; paginate `GET /me/blocks` (cursor request + `nextCursor` response).

  `@civfix/ui`: adopt `@civfix/shared` 0.36.0 and enforce the shared `MIN_EVENT_HOURS` floor in the hours-entry validators.

- Updated dependencies
  - @civfix/shared@0.36.0

## 0.52.0

### Minor Changes

- Rework the messaging inbox around the row, the clock and the two actions a thread actually needs.

  - FLAT ROWS. Threads stop being cards (surface fill, `radius.lg`, hairline, s1 shadow, a margin under
    each) and become full-bleed rows separated by a hairline inset past the avatar column - the same
    surface vocabulary the feed already speaks. Read/unread now separates by weight on the title and ink on
    the preview, and the preview is truncated ONCE by the layout instead of being hard-sliced at 42
    characters and then clipped again.
  - SEARCH + PULL-TO-REFRESH. The list root gains an inbox search field that filters the loaded threads
    client-side (with its own no-match empty state) and a `RefreshControl`, so the two affordances every
    other list root already offered are no longer missing here.
  - SWIPE ACTIONS, NATIVE ONLY. New exports `useSwipeActions` (with `SwipeActionsOptions` / `SwipeActions`)
    and the pure `swipeActionsModel` (`actionsProgress`, `actionsRestingX`, `actionsTranslate`,
    `actionsWidth`, `shouldCaptureActionsSwipe`, `shouldSnapOpen`, `SWIPE_ACTION_WIDTH_PX`,
    `SWIPE_ACTIONS_SNAP_RATIO`) drive a row's Mute/Unmute and - when the thread is unread - Mark read.
    The gesture is disabled on web, where the same two actions stay reachable through the row's overflow
    menu; both platforms also expose them as accessibility actions, so the affordance is never
    gesture-only.
  - TICKING TIMESTAMPS. Rows render their own relative time off `MessageThreadDTO.lastMessageAt` (see the
    contract's thread-read-and-last-message-at changeset) through the new `useTickingListTimeAgo`, which
    re-renders every open list on a single shared 60s tick. The server-rendered `ago` string remains the
    fallback for a server that does not send the new field, so nothing regresses against an older API.
  - MARK READ OVER HTTP. New `useMarkThreadRead` data hook on the contract's `markThreadRead`
    (`PUT /threads/read`), which the inbox can call with the room id it already has - marking a
    conversation read no longer requires opening it for the WS `ack` frame.
  - `ConvoOverflowMenu` moves onto the shared `PopoverMenu` (one anchored-menu implementation, one motion
    path), and the conversation's typing dots honour reduced motion by resting instead of pulsing.

  Removes two exports from the activity feature: the `useUserActivity` hook and the `ProfileActivity`
  type. Both fed the per-user public activity stream that `@civfix/shared` drops on privacy grounds in its
  remove-user-activity changeset; a host must be on a build with its own activity references removed before
  adopting.

- Consolidate the package's transitions onto shared motion models, and let the report wizard's capture step
  wait for the reporter.

  MENUS. `PopoverMenu`, `MessageContextMenu` and `PostActionMenu` now scale-and-fade from their anchor
  through ONE `menuMotion` path over the pure `menuMotionModel` (`menuOrigin` + `MOTION.menuScaleFrom`),
  instead of three hand-tuned entrances that had already drifted.

  BODY AND PAGE TRANSITIONS. Travel is expressed as a RATIO of the surface width (`pageTravelRatio` 0.28,
  `pageParallaxRatio` 0.15) rather than a fixed px nudge, so the same plan reads the same on a phone and on
  a desktop pane; `bodyPush`/`bodyExit` were re-timed (240/160ms) to match. The plan is computed by the
  shared `bodyTransitionPlan` for web and native alike, and the page stack's layer numbers by the new
  `pageLayerTokens` export (with the `PageLayerTokens` / `PageMotionTokens` types). Reduced motion is
  DELIBERATELY not identical across platforms: web takes a hard cut (the outgoing body is dropped and the
  incoming one is settled in the same frame - no animation object is created at all), native keeps a short
  crossfade with the slide removed. Web can swap DOM subtrees instantly; RN cannot drop a mounted screen
  without a visible flash, so a fade is the honest floor there.

  Wizard steps get their own `StepTransition` seam (web/native), so stepping inside the report flow animates
  as a step rather than borrowing the body-swap plan. The shell's detail header gains
  `detailTrailingActionFor` + `DetailTrailingButton` - the one place a detail page declares its trailing
  action (the profile's settings gear is the first caller) instead of each body drawing its own. And
  `PostComposer`'s entrance now starts on mount instead of inside the async reduced-motion query's callback,
  with a module-level cache so a reduced-motion viewer mounts already settled - the composer can no longer
  sit blank until that promise resolves.

  REPORT CAPTURE. Capturing a photo no longer auto-advances the wizard. The reporter lands on the filled
  "Your captures" state, can shoot again or remove one, and presses Continue when they are done - the
  advance is now reachable from exactly one place (the Continue callback), so the flow cannot move under a
  reporter mid-shot.

  The wizard's PROGRESS RAIL IS REMOVED, not retuned: a fixed 3-segment rail cannot describe a flow that is
  four or five steps long depending on layout and on whether the point was prefilled, and its "Step {phase}
  of 3" a11y string actively misstated how much was left. The header now goes straight into the step body,
  and the progress copy is dropped from all four locales. The capture step also drops `LocatedChip`, the
  reverse-geocoded location banner it drew over the shots, so the step shows what was captured and nothing
  else - the location is confirmed on the step that owns it.

- Nav store: a `navigateTo(entry, mode)` verb with dedup semantics, so applying a target the user is already looking at can never stack a twin. Applying an entry that is already the active one is a total no-op (a peeked sheet is raised, session-only fields like `profileTab` / `jumpToMessageId` merge in place); an entry already deeper in the stack collapses back to it, keeping `view` and `originView` that a plain re-seed threw away; anything else falls through to `seed` unchanged. Entry equality comes from the new `entryIdentity(entry)` export - kind plus the discriminating ids (`id`, `roomKind`, `geoid`, composer mode/target) - which deliberately refuses an identity to the unaddressable map selections (`cluster`, `blend`, `drop-pin`) so they never dedup against each other. `seed` is untouched.
- Compact the profile header: one inline ProfileStatsRow (Following / Followers / Reports / Fixed / Cleanups) replaces the five stat cards on both the own and the public profile, and the hero's sign-out button is gone - the settings gear now sits in the shell's detail header, right-aligned opposite the back chip, via the new `detailTrailingActionFor` mechanism. Removes the `ImpactTiles` export. The "recent civfix activity" section is gone from both profiles (own and
  public) along with its shared `ActivitySection` and activity model, following the contract's removal of the
  per-user activity stream on privacy grounds.
- A real Settings hub, so the profile stops being the place account preferences hide.

  Three new bodies ship from `@civfix/ui/bodies`: `SettingsBody` (the hub - Account / Notifications /
  Privacy, Language, the About block, and the ONE sign-out in the package), `SettingsAccountBody` (the
  identity editors plus the data export and the delete-account flow) and `SettingsPrivacyBody` (DM
  permission, volunteer-hours visibility, the blocked list). Each is reachable on its own URL through
  three new nav kinds - `settings` -> `/settings`, `settings-account` -> `/settings/account`,
  `settings-privacy` -> `/settings/privacy` - so a host can deep-link or restore any of them, and every
  one renders its signed-out, loading and error state rather than a half-populated form.

  Supporting exports:

  - `SettingsRow` / `SettingsSection` primitives (plus `SETTINGS_ROW_MIN_HEIGHT` and the
    `SettingsRowProps` / `SettingsSectionProps` / `SettingsToggleBinding` types) - the one row shape for a
    navigating row, a toggle row and a destructive row, so no surface hand-rolls a settings list again.
  - The Settings > Account editors, each a row that edits inside a `ModalCardSheet` with the house dialog
    buttons: display name, username (with the handle cooldown as a disabled row), bio (capped at the
    contract's own `MAX_BIO_LENGTH`), avatar (`AvatarSettingRow` + the shared upload helper) and social
    links (validated against `SocialLinksSchema` before Save enables).
  - `DONATE_URL`, `TERMS_URL`, `PRIVACY_URL` from the primitives barrel, so the About rows and any host
    chrome open the same three addresses.

  Copy lands in three new i18n namespaces - `settings`, `settings-account`, `settings-privacy` - in all
  four locales (en, es, de, ko).

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @civfix/shared@0.35.0

## 0.51.2

### Patch Changes

- f2e2241: Marking an event complete now invalidates the attendee roster.

  Completing an event is what mounts the volunteer-hours surface, and the host editor under it renders one row per attendee joined from `useCleanupAttendees` — so the roster stops being decoration and becomes the input surface at exactly that moment. `useCompleteCleanup` was the only mutation of its family not invalidating that key (`useCancelCleanup` and the slot claim both do), so a roster cached before the last RSVPs landed left the host with too few people to credit — or an empty list, when it had been fetched while the server still scoped it to people they follow. Leaving the event and reopening it was what silently fixed it.

  The completion wiring is now exported as `completeCleanupMutationOptions`, so its cache contract is driven directly against a real `QueryClient` in tests instead of being asserted on the source text.

## 0.51.1

### Patch Changes

- Hide the report keep-alive slot and the retained map with opacity instead of display:none. Fabric culls display:none subtrees from the native tree, so every tab switch destroyed and rebuilt the report tab's native views (full camera + audio session reconfigure) and the retained MapLibre surface - the source of the camera-tab switch lag on device.

## 0.51.0

### Minor Changes

- 8818d13: Tab-switch main-thread stall fixes: hidden home/messaging keep-alive slots detach via opacity instead of display:none (no re-show relayout in the tap commit), the dock pill animation kicks off in the press handler, BodyTransition gains a settle guard so an interrupted entrance can never strand a body at opacity 0, the report slot's fresh-wizard latch is driven by explicit draft reset/seed signals instead of any empty-media publication, selectView reuses the empty stack reference, noteView no-ops on unchanged views, and the report pick-layer defers its MapLibre teardown out of the tab-leave commit (inert while lingering).

## 0.50.0

### Minor Changes

- 6cebe05: Event join fixes: alias-aware cleanup-detail cache invalidation via cleanupDetailFilters so RSVP works on refcode-opened events, phantom-slot fix, RSVP error toasts (en/es/de/ko), and real-hook cache invalidation tests.

## 0.49.0

### Minor Changes

- dff31e4: Three-fix batch. Camera tab: swiping off the camera no longer hitches - Home and Messages keep retained keep-alive slots in the portrait shell so they don't remount on every tab return, ReportFlowBody narrows its store selectors, and AppShell drops a redundant subscription. Web home feed: the boot-time auth-scope query-key flip no longer flashes an empty feed and double-loads - useHomeFeed bridges the flip with placeholderData from the previous scope's cache. App promo card: the compact collapsed strip is removed - the promo is now either full or dismissed.

## 0.48.0

### Minor Changes

- 00c5cfa: Mobile audit: chat cache-as-source-of-truth with fetch-race journaling, viewer-field-preserving inbound merge (preserveViewerFields + reconcileInbound viewerTruth), discriminated chat send outcomes, transient vs fatal room errors, reconnect gap-heal, poll vote gating + inert state, thread nav seams (onOpenEntry), nested-shell back arbitration (NestedShellHostProvider), SegmentedCodeInputHandle, media thumb renditions + lightbox intrinsic fit, DST-safe event scheduling, locale threading, perf memoization, a11y hit targets, token cleanup.

### Patch Changes

- Updated dependencies [00c5cfa]
  - @civfix/shared@0.34.0

## 0.47.0

### Minor Changes

- Report and event chats get a real chat-info surface.

  - `@civfix/shared`: adds the `getReportChatParticipants` endpoint contract (`GET /reports/:id/chat/participants`) with `ReportChatParticipantDTO` / `ReportChatParticipantsResponse`. A report chat previously had join/leave but no way to list who was in it.
  - `@civfix/ui`: tapping the title of a report or event chat now opens the group-chat treatment instead of a bare link row - a hero (photo/glyph, the report or event's real title, address, member count), Mute/Unmute, Leave chat (report rooms only), the existing View report / View event row, and the roster. Report rosters come from the new endpoint; event rosters keep the attendee list. Adding members is deliberately absent: these rooms have no invite path. The surface is titled "Chat info" rather than "Members" for these room kinds.

  Leaving is offered on report rooms only. An event chat's membership IS the RSVP, so a "Leave chat" there would silently un-RSVP the viewer from the event itself.

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.33.0

## 0.46.0

### Minor Changes

- Person profile block state and error coercion helpers.

  - `@civfix/shared`: `UserProfileDTOSchema` gains an optional `blockedByMe` flag, and `types/errors` exports `AppErrorLike`, `isAppErrorLike` and `toAppError` for turning unknown/serialized failures back into an `AppError`.
  - `@civfix/ui`: person detail surfaces block state, the member picker and new-channel body pick up the shared error coercion, direct-message hooks gain a query key for it, and the en/es/de/ko locales cover the new profile + channel-create strings.

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.32.0

## 0.45.0

### Minor Changes

- 49c5a2f: Tapping a report or event chat's header title now opens an info surface (the roster for events, a "View report"/"View event" row for both - report rooms have no roster) instead of jumping straight to the report or doing nothing; the linked-entity row pushes the report/event detail from there. The Messages tab's floating dock now clears the last thread card by the same bottom padding Feed uses, so its blur samples open background instead of a card's flush edge.

## 0.44.0

### Minor Changes

- e1a4f8c: Landscape shell follow-ups: the vertical nav rail is now a horizontal top strip in-line with the civfix wordmark at its original top-left position; a plain map click (landscape only) opens the "Add here" report/event create menu that long-press/right-click already offered; the Search orb's selected state now matches the four tabs' subtle glass lozenge tint instead of a solid dark fill.

## 0.43.0

### Minor Changes

- 437c5fa: Landscape "Standing Dock" redesign: vertical liquid-glass nav rail (portrait dock vocabulary) beside the floating card; the card hosts the real Twitter-style FeedBody as landscape home (HomeSidebarBody removed); full-bleed map mode on the Map tab fixing the /map deep link; /search gains a wired in-body field with "/" and Escape shortcuts; sidebar default width 440 (drag 300–640, persisted-width v2 migration); pure expandedFramePlan module single-sources card/rail/occlusion geometry (--cf-occlusion-left CSS var for map chrome); report wizard gets a tab-root header in landscape plus web drag-and-drop capture; seedFor list-kind deep links unified across orientations.

## 0.42.0

### Minor Changes

- Five mobile fixes:

  - **Quote-reply spacing guard** — quoted replies no longer collapse their leading/trailing spacing when the quoted body is empty or whitespace-only.
  - **Search report card press + hit area** — report cards in search results are reliably pressable, with a hit area that covers the whole row instead of the text alone.
  - **Report-create intent claim redesign** — the create intent is now claimed once by the screen that consumes it, fixing the "New post" misroute that sent the composer into the report flow.
  - **Composer genuine-exit discard** — attachments are discarded only on a genuine exit from the composer, not on transient unmounts or sub-page navigation.
  - **Conversation host-callback props + affordance guards** — native chat sub-pages receive explicit host callbacks, and header affordances are guarded so they no-op when the host cannot service them.

## 0.41.0

### Minor Changes

- 81625e2: Native navigation gets a real page stack, and four pieces of dock/tab polish that fell out of
  living with 0.40.0's sheet-to-page conversion.

  **Edge-swipe back, and push/pop that animate.** Every shell-owned page on native — the ~24
  converted details plus the four own-header bodies — went through one host that mounted a single
  body and swapped it in a single React commit: no exit animation, a hard cut when the first page
  opened over a tab root, and no back gesture in the shell at all. The overlay layer's contents are
  now `PageStack`, a platform seam. `PageStack.web` is the previous markup verbatim — web presents
  details as a pull-up sheet, so there is no stack to animate, and the safe-area and keyboard insets
  stay on two nested boxes so they still SUM rather than override. `PageStack.native` retains N keyed
  layers (one per `fullEntryStack` element) and adds a finger-tracked left-edge back swipe, a
  parallax under-page reveal with scrim, and full-width push/pop slides. Two shared values drive it,
  and a mounted layer never changes which one owns it: the topmost real layer reads `front` for its
  whole life, the retained leaving layer reads `exit` for its whole life, and a layer's parallax
  comes from whatever drives the layer above it — that is what makes dropping the leaving layer, and
  handing a completed swipe off to the pop, both move nothing. One shared value with role-by-index
  has a one-frame flash at x=width built into it. Two rungs stop an edge flick discarding a
  half-written event: the gesture is armed THROUGH `backAffordance`, so it exists only where
  `detailLeadingAffordance` already answers "back" (a flow at the ROOT of the stack draws an honest
  close X and is refused), and `canSwipeBack` additionally refuses whenever the entry the pop would
  remove is itself a flow kind — which is what covers the two contextual entry points, a map
  long-press and a report's "Host an event", both of which push the host form at depth ≥ 2 where the
  header legitimately says "back". `[create-cleanup, verify]` stays swipeable, because there the flow
  survives the pop. iOS only — Android 10+ owns the left edge and would double-pop. New pure models
  (`pageLayerStyle`, `swipeBackDecision`, `pageTransitionPlan`, `canSwipeBack`) are unit-tested;
  `fullEntryStack` is the new primitive and `topmostFullEntry` is now its last element, so every
  historic caller is byte-identical. Each layer's header is handed the stack slice that ENDS at its
  own entry, so a page revealed under a pushed child answers for its own depth rather than for the top
  of the stack. Retaining layers means N bodies mounted at depth N, so mount-time global writes are
  gated by `shell/pageActive` (default true, leaving single-body hosts unaffected) — that gate is also
  what makes a buried or leaving layer register no focus cleanup at all; `useMapFocus.clearFor(id)` is
  the ownership check beside it, so a release can never wipe focus another page owns. The same
  activity signal now scopes `KeyboardAwareScroll.native`: both of its heuristics read the GLOBAL
  focused input, so without it every buried page layer scrolled and padded itself for a keyboard the
  top page raised and was revealed at the wrong offset on the pop.

  **The Report tab opens instantly.** 0.40.0's keep-alive removed the camera's construction cost from
  a tab switch and was still not enough; four independent causes are each fixed where they live. The
  retained MapLibre surface was still live, compositing under every view including the camera preview
  for the rest of the session — AppShell now detaches it with `display: "none"` whenever an opaque
  base body covers it, derived from `!basePlan.renderBaseBody` so "may it be hidden" and retention's
  safety invariant are one answer (web is untouched; the flag can only be false there). The retained
  map was also being re-rendered on every tab tap, reconciling a marker tree nobody can see, so
  `Map.native` is now memoized. The report slot was lazy, so the first entry per session — the one the
  reporter notices — still paid the whole mount the slot exists to avoid; PortraitShell pre-warms it
  on a 3s timer, mounting a tree and starting nothing, because the session gate reads the live nav
  view (a pre-warmed camera is configured, never running: no indicator, no prompt). A timer and not
  `runAfterInteractions`: RN 0.81 defaults `disableInteractionManager` to true, so `InteractionManager`
  is a stub whose `runAfterInteractions` is a bare `setImmediate` — which put that whole mount on the
  cold-start critical path for every user, including the majority who never open the Report tab. Both
  of `BodyTransition.native`'s entrance channels also declare `isInteraction: false`, which is correct
  and free but, under that same stub, currently buys nothing. Tabbing away and back no
  longer rebuilds the camera: `viewfinderResumeGraceEligible` is the session predicate with the view
  forced true, handed to the host as a new optional `CameraViewfinderProps.resumeGrace` — a bounded
  permission, where the host still owns the clock, the app-background hard stop, the never-arm-cold
  gate and the parked-recording rule.

  **The Search dock floats again.** The native Search overlay inset its own box by the dock footprint,
  so the scroll viewport ended at the dock's top edge and the ~94pt strip the glass bar floats in was
  painted, never-scrolling sand — the glass had nothing to sample and read as a flat plate on a slab.
  Clearance now lands on the scroll CONTENT via a module-scope `makeDockClearanceScrollHost` wrapped
  outside the keyboard-aware host, so the list runs under the bar while the scroll range is unchanged
  (same points below the last row; they just pass beneath the glass instead of stopping short). The
  wrapper reads the live dock footprint from `tabBarStore` and the keyboard lift from
  `searchBarStore`, with the `bottomInset` prop demoted to a pre-measurement fallback delivered by
  context. The host component's identity must be minted once at module scope or every dock
  measurement would swap the ScrollView's element type and remount SearchBody's scroller. Both opaque
  paints are deliberately untouched — since 0.40.0 they are what hides the retained MapLibre surface
  at z0.

  **"New post" takes the brand coral.** The Home header's compose pill was the only primary CTA in the
  app filled with `bloom.700` (#C74537), the palette's darkest, brick-toned coral, while its own
  `shadows.pin` glow is `bloom.500` — so the button rendered as a #F0685C halo around a #C74537 core,
  which is what read as muddy next to the rest of the header. It now fills with
  `theme.colors.accent`, the same token PostComposer's "Post" button uses, so the entrance and its
  destination are one red. No token or i18n changes. The trade, made deliberately: `neutral.card` on
  #F0685C is 3.02:1, so the 13.5pt label clears the 3:1 non-text/UI floor but no longer clears 4.5:1
  AA for normal text (bloom.700 measured 4.77:1, and no size fix exists — AA "large text" starts at
  18.66px bold). ReportFlowBody's `photoDrop` keeps bloom.700 and is untouched: 168pt of solid colour
  behind two lines of 12pt safety-critical copy read outdoors is not the same call.

  **The floating dock clears Android's system nav bar.** `dockBottomGap` was `max(inset - 12, 8)`, a
  deliberate iOS-26 pull-back that reserves LESS than the bottom safe area because iOS's inset is a
  home indicator apps are expected to draw into. Android's is not: SDK 54 / targetSdk 35 enforces
  edge-to-edge, so `insets.bottom` is a system nav bar the OS composites OVER the window, and the same
  arithmetic parked the dock's bottom 12dp under it — painted over by the 48dp 3-button bar, and
  inside the gesture pill's touch strip on gesture nav. The fix is a defaulted platform discriminant
  on `dockBottomGap`, inherited by `dockKeyboardRestOffset`: on Android reserve the inset in full and
  let `DOCK_BOTTOM_MARGIN` be the gap above the nav bar. It has to live inside `dockBottomGap` rather
  than at TabBar.native's `paddingBottom`, because `dockKeyboardRestOffset` is defined on top of the
  gap and `keyboardLift` subtracts it — a call-site fix would float the docked search bar ~28dp above
  the IME instead of 8dp. `tabBarLogic.ts` stays react-native-free (vitest imports it directly);
  TabBar.native owns the one `Platform.OS` branch. Nothing downstream needs an Android gate: the
  dock's footprint is measured by its own `onLayout` into `tabBarStore`, so `portraitFramePlan` and
  every body's `bottomInset` self-adapt. iOS and web are byte-identical — the default argument is the
  old formula verbatim, and a 0..96 inset sweep pins it.

  `@civfix/shared` is unchanged in this release. The `@civfix/ui` MINOR (0.40.0 -> 0.41.0) falls
  outside the consumers' `^0.40.0` caret, so web and mobile stay on 0.40.0 until they are bumped
  deliberately — the swipe-back stack changes native navigation behaviour and should land with an
  intentional consumer bump and a device pass, not by caret drift.

## 0.40.0

### Minor Changes

- Six mobile-feedback fixes: full-page details, camera-first report flow, honest wizard, leaderboard visibility, and hours integrity.

  - **All detail pull-ups are full pages on native.** `SHEET_ONLY_KINDS` is down to `drop-pin`; a platform seam (`detailPresentationPlatform`) keeps web byte-identical. The shell overlay layer gained a shared `DetailHeader`, a back affordance for drag-less pages, and a bottom safe-area reserve. `blend` gets a title fallback so no page is headerless.
  - **The camera IS the capture step on mobile.** The cream "Capture the issue" card is unreachable when a Viewfinder is injected; there is no X on the embedded camera (`CameraViewfinderProps.onCancel` is now optional — absent means "draw no exit chrome"). The progress rail is index/total-driven; located drafts skip the location step (`stepAfterCapture`).
  - **The location picker never centers on the middle of the US** (native and web): no map mounts until a real point exists; `useApproxCenter` shares the app-wide user-location cache with a 4s device-fix cap and never downgrades a seeded point.
  - **Report-tab performance:** the report body is retained in a native keep-alive slot (with a liveness gate so a detached body arms no global BackHandler), the camera mount is deferred past the tab transition, MapLibre is lazily retained across compact tab switches, and tab cells are memoized.
  - **Discovery leaderboard renders whenever a jurisdiction is known** — including an empty "be the first" state with `participantCount` — instead of hiding on empty boards; shared location resolve hardened (timeout + ipLocate fallback).
  - **Page backgrounds:** ProfileBody, SavedPostsBody, and PostDetailBody paint the page color (no more tan band on glass) and the latter two own a real scroll host.
  - `@civfix/shared`: `REPORT_VOLUNTEER_HOURS` is deprecated — the backend no longer credits volunteer hours for filed reports; `"report"` remains in `VOLUNTEER_HOURS_SOURCES` for rendering historical rows.

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.31.1

## 0.39.0

### Minor Changes

- aad63bd: Report wizard: the location step's map picker is now an in-body layer instead of a
  full-screen RN `<Modal>`, so the bottom dock stays visible while picking a location —
  matching the inline camera the capture step already got in 0.37.0. Android hardware
  back closes the picker instead of leaking through to the OS. Host-an-event
  deliberately keeps its own picker as a `<Modal>`: its map sits inside a gorhom sheet
  that collapses to a peek, and an absolute-fill layer there would get clipped. The
  underlying seam now takes a `presentation?: "modal" | "layer"` prop (default
  `"modal"`) rather than assuming one behavior everywhere it's used.

  Search: leaving the search overlay is smoother. The keyboard's reserved space used to
  collapse by about 289pt un-animated partway through the close; it now carries through
  the same blur-driven close instead. Re-triggering the close no longer restarts an
  in-flight one with a competing timing curve — the whole exit rides a single curve —
  and the search body is frozen for the duration, so its two un-animated remounts stop
  landing mid-fade and flashing on the way out.

  Search's "Reports nearby" rows now render through the same `ReportRowView` used
  elsewhere in the app (photo + location), replacing the hand-rolled pin glyph and
  description subtitle those rows used before — a report looks the same whether you
  found it through search or in a feed.

  Two smaller fixes that fell out of the above: the embedded camera session in the
  Report tab now tears down when Search overlays it instead of continuing to run
  underneath, and the location pre-warm that runs on Report-tab mount no longer fires
  its permission prompt before the user has done anything that needs it.

## 0.38.1

### Patch Changes

- 7589d34: Post-ship review fixes for the service-hours surface: the hours editor no longer
  includes the acting host (which 403d the whole batch), slot claims update event
  lists immediately, edit-form capacity validation actually blocks saving, the
  transcript card keeps its code and revoke control across tab switches, the
  privacy toggle and indicators now describe the tri-state truthfully, and locale
  decimal separators, reduce-motion and touch-target fixes land across the new
  surfaces.

## 0.38.0

### Minor Changes

- b09ffa3: Service-hours feature surface: SignUpGenius-style event slots (SlotEditor in the
  event form, EventSlotsBlock claim board, per-slot roster grouping in MembersBody),
  host event completion + hours logging lifecycle on EventDetailBody (CompleteEventRow,
  EventHoursBlock with attendee receipts), the jurisdiction leaderboard on the search
  page's Discovery surface, the Service Hours profile section with per-event ledger and
  official PDF transcript issuance/revocation, the tri-state public-hours privacy
  toggle, the Twitter-style profile timeline (ProfileTabBar + full-bleed
  ProfileTimelineLane on both own and public profiles), and the person profile as a
  full page (BODY_LAYOUT.person = "full") on every platform. New i18n namespaces
  volunteer-hours / event-slots / web-service-record in en/es/de/ko.

  Consumes the @civfix/shared 0.31.0 contract (9 new endpoints). Hosts need no new
  wiring beyond the dep bumps; the leaderboard deep link `/leaderboard/:geoid` and the
  web `/service-record/:code` route are the only new host-side surfaces.

## 0.37.0

> **Addendum — added 2026-07-28, retroactively.** The changeset merged into this
> release covered only the shared service-hours contract below. A second branch's
> commits landed in the same release merge without a changeset of their own, so
> nothing about them was recorded here at the time — even though they have been
> part of `@civfix/ui@0.37.0` since it published. This note backfills the record;
> it does not change anything about the code that shipped.
>
> - Inline "Show replies" in a post thread, X-parity: a flat list with zero
>   indentation, a threadline drawn through the avatar column, no hairline between
>   chained rows, plain append with no scroll compensation, and inline depth capped
>   at 2 levels below the focal post. The reply row's comment glyph re-aims the
>   docked composer at that reply instead of pushing a new screen.
>   (`08cdd40`..`5d2d019`)
> - Drop-pin camera restore: dismissing the map's long-press pull-up flies the
>   camera back to the viewport it had before the press; panning or zooming while
>   the menu is open cancels the restore. "Report here" and host-an-event are
>   commitments, not dismissals, and do not restore.
>   (`045882d`, `8e6292f`, `6620ada`)
> - A renderable `CameraCapability.Viewfinder` slot, with the report wizard
>   rendering the camera inline on the capture step so the bottom dock stays
>   visible while shooting. (`753b1d2`, `ac51236`)

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

### Patch Changes

- Updated dependencies [d5c19f3]
  - @civfix/shared@0.31.0

## 0.36.1

### Patch Changes

- a89c3eb: Fix a hard iOS crash when releasing a drag on the bottom dock (tab bar).

  The tab strip's drag-to-select pan called `tabPillConfig()` from inside its `.onFinalize` callback.
  Gesture callbacks are autoworkletized and run on the reanimated UI runtime, but the `*Config()`
  factories in `motionConfigs.native.ts` are plain JS. The Babel plugin captured `tabPillConfig` into
  the worklet's closure, react-native-worklets serialized it as a RemoteFunction, and the UI runtime
  unpacked it into a stub that throws `[Worklets] Tried to synchronously call a non-worklet function
... on the UI thread`. Because `runOnRuntimeGuarded` compiles its call guard only `#ifndef NDEBUG`,
  a release/TestFlight build has no guard at all, so the error escaped native gesture dispatch as an
  uncaught C++ exception and aborted the process. Every drag-release of the dock killed the app;
  plain taps were unaffected (the pan needs 6pt of travel to activate), as were users with OS
  reduce-motion enabled (the ternary short-circuited the call).

  The timing config is now built once on the JS thread and the resulting object is captured by the
  worklet, which is the supported pattern — `Easing.bezier()` returns a `{ factory }` that is itself a
  worklet, so the config serializes with nothing remote in it. Both `motionConfigs.native.ts` and the
  call site now document the JS-thread-only rule, and a source-grep regression test fails if any
  config factory is reintroduced into the pan chain.

## 0.36.0

### Minor Changes

- 8540318: Rebuilt the feed row's spacing and replaced the action-bar highlight with a Twitter-style treatment. The
  persistent pale rectangle behind a liked / reposted / saved action is gone: an action's state now lives only
  in its glyph colour and fill, and the only background is a transient circular halo, tinted to that action's
  own colour, that appears on hover (web) or press (native). The disc is drawn behind the glyph rather than
  laid out beside it, so the wider 44pt tap targets (up from 40) did not cost the row any width: a popular
  post's action row still fits a 375pt screen with room to spare, and a count now truncates inside its own
  button rather than spilling onto its neighbour if it ever cannot. The overflow "..." gets the same 34pt disc,
  inside a target that is 44pt wide and exactly as tall as the meta row it sits in - it used to be positioned
  out of flow and taller than its parent, which on Android meant a tap near the top or bottom of the visible
  control opened the post thread instead of the menu.

  On the spacing side: attachments (photos, linked reports and events, quoted posts) sit a proper 12pt below
  the body text instead of colliding with it at 3pt; the two height-cancelling negative margins that pushed
  every repost row's author name ~18px above its avatar are gone; the avatar gutter, the "Home" heading, the
  filter chips and the loading skeleton now all line up on the same 16pt inset; the loading skeletons sit at
  the same pitch as the rows that replace them, so the feed no longer shifts as it fills in; and the row's
  separator no longer renders as a heavy 1px rule on the web. Saved, a post permalink, a profile's posts tab
  and a person's posts tab all get the same full-bleed timeline treatment as the feed, so the hairline divides
  rows there instead of floating in the middle of a 12pt gap. In a post thread, the focal post's action row and
  each reply's action row now line up with the text above them (both were cancelling a padding the buttons
  stopped having), and the reply row tightened as a knock-on, since its 24pt action gap was tuned for buttons
  that painted no background at all. On the web the repost glyph no longer counter-rotates back after a repost:
  its spin was fighting a CSS transition that has been narrowed to the halo's fill.

- 8540318: "+ New event" inside the post composer now opens the host-an-event form right where you are, instead of throwing you back out to the Home feed first. The composer stays on screen with your draft intact and the form rises over it as a pull-up; publishing lands you back in the same composer with the new event already attached, and the form's back chevron returns you there too. Previously the composer dismissed itself before opening the form, which re-rooted the pull-up over the timeline — so a half-written post appeared to vanish. Under the hood the portrait shell now resolves its overlay layer from the whole navigation stack rather than the single active entry, so a pull-up sheet can be presented above a still-painted full-screen body; the covered surface goes pointer-inert while the sheet is up. The composer's text field is blurred on the way out so the keyboard no longer fights the rising sheet. On mobile, where the composer is a native screen above the shell, the form is presented as a native pull-up sheet stacked over it, so the composer keeps its swipe-down-to-dismiss gesture. That sheet now keeps whichever field you are typing in above the soft keyboard and reserves room below the Publish button for the home indicator — a native form sheet does not resize for the keyboard, so without it the description, "what to bring" and Publish all sat underneath it. In that sheet the "Get verified" note at the top of the form reads as a plain notice rather than a link, because the verification screen lives behind both the sheet and the composer; get verified from your profile instead. "+ New report" still routes through the report tab, because that wizard is a top-level view that clears the navigation stack.
- 8540318: Fixes what a pull-up sheet's leading header control actually promises. Two things change on screen. "Host an
  event" and "Edit event" now draw a close X instead of a back chevron when they are the root of the sheet: the
  control has to stay (dragging those down deliberately does NOT dismiss them — it reveals the map for the
  meet-location step — and the tab dock is hidden under any sheet detail, so removing it would leave no way out
  of a half-written event), but it no longer claims there is a previous screen to return to. And "Get verified"
  now dismisses when you drag it down, instead of stranding at peek: it had been guarded as an in-progress
  draft flow, which went stale when verification stopped being an in-app application — the screen holds no
  unsaved work. Reached the way the app reaches it (from Profile, an event, or the host form's unverified
  banner) it is a drill-down, so it keeps its back chevron; only a root-level "Get verified" loses one, and no
  route currently opens it there.

  Also widens the in-progress-flow protection: dragging the sheet down while "Get verified" or a linked report
  sits ON TOP of a half-written event used to clear the whole stack and drop you back on the Events tab. The
  collapse guard now checks the whole nav stack rather than just its top entry, matching the map long-press
  guard, so the drag is a no-op and the header chevron pops you back to the form.

  Adds a `nav:a11y.close` screen-reader label in all four locales.

- 8540318: Search: "Recently searched" starts at the top again. This REVERTS the 0.33.0 behaviour where the search recents surface bottom-anchored toward the search bar — with a soft keyboard up, the list read upward from the field (Messages/Spotlight style) and all the leftover vertical space piled up ABOVE the "Recently searched" header, pushing it up to ~335pt down the screen on a phone. That was a deliberate 0.33.0 change, but it made the section header look misplaced, so it is gone: the recents surface is now top-anchored in every state on native and web, exactly as it was before 0.33.0. The consequence is accepted and intended — with only one or two saved searches there is now empty space between the last row and the field being typed into. The resting bottom spacer that clears the docked tab bar is unconditional again, so the tail of the discovery list is still reachable. The docked bar's keyboard reserve is unchanged; only the search body's use of it is removed.
- 8540318: Report an issue now opens straight into the camera. On phones, tapping the Report tab with a blank draft
  opens the camera viewfinder itself instead of showing a dashed grey "upload" box to tap first, and taking the
  shot moves you to the next step on its own — so the dead, greyed-out "Continue" button is gone from the first
  screen entirely (it comes back if you step back to add or remove a photo, so you can always move forward).
  If the camera is dismissed or unavailable you land on the step with a solid "Capture the issue" button and a
  quieter "Choose from library" link underneath, matching where the two controls actually take you. The camera
  only ever opens on arrival, so removing a photo you already took never throws the viewfinder back over you —
  you stay on the step and can pick from your library instead. Mobile web is unchanged: browsers block opening
  a camera without a tap, so it still waits for one. The first screen's header now matches the rest of the app
  — the same large 32px title and profile button that Home and Messages use, on the same left edge as the
  progress bar and the fields below it, instead of the small drilled-in detail title it used to borrow; once
  you are inside the flow (and in landscape) the compact header with the back button is unchanged.
- 8540318: Map long-press drop-pin: the camera now centres the pressed point in the strip of map the pull-up actually leaves visible, in every layout.

  In portrait the pull-up now always settles at MID for a dropped pin, where it used to keep a sheet the user had dragged to FULL. That is geometry, not taste: the sheet's full anchor is clamped to `windowHeight - topReserve`, so the map left above a FULL sheet is exactly the top reserve — 91px on an iPhone 16, of which the first 59 are the Dynamic Island. 32 usable px, on every notched phone, against a 52pt drop pin; on mobile web with the app-download banner up the strip is negative. No camera offset can show a pin there, so `openDropPinMenu` brings the sheet down to MID (328px of map on that same phone) and the camera centres in that. A long press in the sliver above a full sheet therefore collapses it one detent instead of leaving the pin invisible.

  The camera also takes the TOP occlusion into account (a new optional `topInset` on `dropPinCameraTarget`: `insets.top` on native, the promo store's measured banner height on web), and offsets by half the _unoccluded_ band rather than half the sheet. Previously it centred in a strip measured from y=0, which at the FULL detent put the pin at `topReserve / 2` — behind the notch. It still offsets by the detent the sheet SETTLES at rather than a hardcoded mid (`sheetDetent`, read from the nav store after the menu opens).

  In landscape/desktop it now offsets HORIZONTALLY by half the sidebar's live, user-resizable width — previously the pressed point was returned untouched there on the reasoning that a side rail does not occlude vertically, which was true but missed that the panel card overlays the map's left edge, so a press on the left third of the window dropped the pin behind the panel (new optional `sidebarWidth`).

  And `openDropPinMenu` now returns whether it actually opened the menu: it declines while a creation flow owns the stack, and both hosts previously flew the camera (and mobile buzzed a haptic) regardless, yanking the map to z17 with no pin and no menu on a map the user had deliberately exposed to pick a location. Both hosts also take the sheet's top reserve from `theme.space["8"]` instead of a literal 32, matching CompactShell.

  Note for the release: this lands alongside the removal of `"verify"` from `FLOW_KINDS`, so a long press while Get-verified is open now opens the drop-pin menu instead of being declined — the two changes are independent but visible together.

- 8540318: Three fixes found while verifying the batch above in the browser at 375x812.

  A timeline post by an event's organiser no longer crushes the author's name. That row holds the name, the
  @handle, a "·", the timestamp, the 75pt ORGANIZER pill and the 44pt overflow button inside a 257pt content
  column, and every child except the name/handle group is rigid — so the group was the only thing flexbox could
  shrink, and it collapsed to 99pt, rendering "Ann Rivera" as "Ann ..." and "@annrivera" as "@ann...". Widening
  the overflow button to a proper 44pt tap target took a further 12pt off it. The handle is now dropped on
  posts that show the ORGANIZER badge: the avatar and the full name already identify the author, whereas the
  badge is why the post carries an event card at all. Posts without the badge keep their handle. Truncating
  either label instead was rejected — an ellipsis mid-pill or a bare "..." where a handle used to be reads as a
  rendering bug.

  Publishing an event now lets you drag its detail sheet away. The happy path appended the new event's entry on
  top of the host form's, leaving a finished creation flow on the stack — and because the collapse guard
  (correctly) refuses to collapse while any entry is an in-progress flow, the success sheet's drag-to-dismiss,
  the universal exit for a pull-up, did nothing. Back from it also returned to the form you had just submitted.
  Publishing now relinquishes the flow's entry and replaces it with the event, which fixes both.

  The count beside a liked / reposted / saved action pops with its glyph again. It had been left out of the
  animated wrapper when the halo moved behind the glyph, so the icon sprang and the number sat still. It gets
  its own wrapper carrying the scale only, so the repost rotation does not spin the digits.

## 0.35.0

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

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.30.0

## 0.34.0

### Minor Changes

- Hide the header back chevron on surfaces that are a tab root or a directly-opened pull-up, and make
  dismissing a pull-up return to the view it was opened from.

  **The chevron rule.** New pure predicate `shell/backAffordance.ts` decides it in one place: show Back when
  it NAVIGATES, hide it when it would merely CLOSE a surface that is already leavable. Concretely it shows
  for a genuine drill-down (`stack.length > 1`), for wizard steps 2+, for the landscape panel (no dock, no
  dismiss gesture), and for an in-progress flow at the root (which `collapseToParent` refuses to abandon).
  It hides on the profile pull-up, report wizard step 1, map pin/event/cluster details and the drop-pin menu,
  all of which are exited by the grab handle or the dock. Consumed by `SheetHeader.shared.tsx` (all
  sheet-presented bodies), `ExpandedShell.tsx` (replacing a condition that was always true), and
  `ReportFlowBody.tsx` (composing its live step index).

  Header rows gained an explicit `minHeight` so removing the 36pt chip does not collapse the row — on the
  report wizard that would otherwise have shifted the progress rail and step body down ~16px on the step
  1 → step 2 transition. The compact `DetailBar` title also gained `flex: 1` so a long title ellipsizes
  instead of overflowing.

  **Dismiss returns to origin.** `collapseToParent` previously routed through `parentViewForEntry`, a static
  kind→view map answering "which list does this kind belong to" — so dismissing a report pin opened from the
  Map landed the user on the Reports list. That was tolerable while the chevron existed as the way back; with
  it gone the dismiss gesture is the only exit, so it now restores the originating view. The nav store records
  `originView` on the empty→first-entry transition and clears it wherever the stack empties or is replaced.
  A deep-linked or cold-started detail has no origin and still falls back to `parentViewForEntry`.

  `collapseToParent` also no longer clears the search query when it stays on the view it came from — with
  `search` newly reachable as a collapse destination, dismissing a person opened from search would have
  returned you to a blanked search page.

## 0.33.0

### Minor Changes

- Six UX fixes across the shell, map, feed and creation flows.

  **Motion.** New `theme/motion.ts` is the single source for every shell transition, with
  `shell/motionConfigs.native.ts` (reanimated) and `shell/motionCss.ts` (CSS) adapters. The detail sheet
  now passes explicit `animationConfigs` instead of falling back to gorhom's slow default spring, the
  600ms `closeGuard` is demoted from primary dismiss path to a fallback (it used to hard-unmount the
  sheet mid-slide), body swaps animate transforms rather than layout properties, and the dock derives its
  glass geometry once per frame instead of ~10x. Dismissals now start on frame 1.

  **Keyboard.** New `useKeyboardAnchor` / `KeyboardAnchorView` primitive tracks the keyboard continuously
  on iOS off the OS-reported duration and curve. The docked search bar now lands flush above the keyboard
  (it sat ~36pt too high, then snapped the last few percent), search results bottom-anchor toward the bar
  instead of stranding at the top of the screen, and the mobile-web double keyboard inset is fixed.
  `KeyboardAwareScroll` gained explicit `ownsFocusedInput` / `reserveKeyboardPadding` ownership so a
  surface no longer reacts to a keyboard raised by an input it does not own.

  **Sheet gestures.** New `sheetHandoffLogic` + `SheetHandoffScroll.native.tsx`: at scroll offset 0, a
  downward drag on sheet CONTENT hands off to the sheet and collapses it, continuously and with no
  threshold jump. Previously only the grab handle could move the sheet. Dominant-axis detection keeps
  nested horizontal strips from being hijacked.

  **Map long-press.** Long-pressing anywhere on the map drops a transient pin, animates the camera to it
  with the pin offset clear of the sheet, reverse-geocodes the spot, and opens an "Add here" menu offering
  "Report an issue here" / "Host an event here" — both launching their creation flow with the location
  prefilled. Native and web seams; new `drop-pin` detail kind.

  **Reply UI.** `PostThreadBody` rebuilt on the Twitter/X thread model: a chrome-less focal post with an
  absolute timestamp and a single action bar, compact borderless reply rows with a thread rail, a
  virtualized paging list, and a docked composer that expands in place and stays welded to the top of the
  keyboard. The composer previously received zero keyboard avoidance and was entirely hidden behind the
  keyboard. `PostComposer`'s `compact` branch is deleted.

  **Post to feed.** Report and event creation gained a "Share to the feed" toggle with an optional caption
  and a live preview of the resulting post, auto-linked to the new report/event. Implemented as two client
  calls on existing wire surface — no new endpoint and no `@civfix/shared` change. A session-scoped local
  thumbnail overlay keeps the just-captured photo on the card while the media asset is still validating
  server-side.

## 0.32.0

### Minor Changes

- f0389cf: Shell/nav cleanup.

  - **BREAKING (unused public API):** `edgeCircleRadius` is removed from `@civfix/ui/surface` and
    `@civfix/ui/surface/liquidGlass`. It was a leftover of the original dock-morph prototype - the shipped
    morph derives every shape from `dockShapes`/`morphUniforms` - and had no runtime consumer.
  - Map-cluster and member-roster panel titles are now localized (`title.cluster` with real CLDR plurals,
    `title.members`) instead of rendering raw English in es/de/ko. `titleForEntry` still returns a key;
    the new `titleParamsForEntry` supplies the cluster count at the render site.
  - The member roster is routable: `/messages/members/<roomKind>/<id>` round-trips through
    `pathForEntry`/`entryFromPath`, so opening it no longer rewrites the URL to `/` and a reload keeps it.
  - `useStackDirection` advances its previous-length in a commit effect, so a StrictMode double render or a
    discarded concurrent render can no longer collapse every body transition to a cross-fade.
  - The dock's scroll-minimize is driven by ONE designated scrollable per body (horizontal lists excluded),
    so a second scrollable in the same body can no longer corrupt or randomly toggle it.
  - The compact sheet's header and snap-point geometry are shared by both platform seams
    (`SheetHeader.shared`, `sheetSnapPoints`); the removed `fallbackDockRise` had no production consumer.

### Patch Changes

- Updated dependencies [f0389cf]
  - @civfix/shared@0.29.0

## 0.31.1

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.28.0

## 0.31.0

### Minor Changes

- Liquid-glass portrait redesign: Skia glass dock with icons-only tabs, drag-to-select lozenge and search morph; system-parity sheets that reach the screen bottom with working full-range scrolling; redesigned post composer (in-card media +, prominent event/report attach sections); spacing/typography audit fixes across search, messages, profile, and the report wizard.

## 0.30.2

### Patch Changes

- e961800: Keep the detached Search icon above its liquid-glass background on web and native.

## 0.30.1

### Patch Changes

- Correct the Hanken body token in `@civfix/shared`. Refine `@civfix/ui` with the portrait feed-first shell, redesign fidelity, and animation, interaction, and accessibility fixes.
- Updated dependencies
  - @civfix/shared@0.27.1

## 0.30.0

### Minor Changes

- b355984: Add the portrait social feed, post composer and interactions, feed-first navigation, Apple Music-style search, and civic-impact profile layouts.

### Patch Changes

- Updated dependencies [b355984]
- Updated dependencies [b355984]
  - @civfix/shared@0.27.0

## 0.29.0

### Minor Changes

- 8804bf2: Chat P1: Telegram-style message context menu (long-press/right-click), in-bubble reaction chips with double-tap like, inline composer edit mode, haptics/clipboard capability seams.
- Follow suggestions — nearby organizers ranking + SocialBody suggestions list.

  - `@civfix/shared`: new `followSuggestions` endpoint (`GET /users/follow-suggestions`, v1). Ranking tiers: nearby organizers (~25km) → nearby people → organizers elsewhere → rest; excludes self, already-followed, and blocked users.
  - `@civfix/ui`: SocialBody renders a "Suggested for you" list (via the new `useFollowSuggestions` hook) when no search query is typed, alongside the existing contacts and volunteer-leaderboard entries. Also adds compact-mode BodyTransition nav animations (openDetail crossfade, push/pop slide-fade via `useStackDirection`).

- f641dae: Event co-hosts, host member controls, invites, and per-attendee volunteer hours (WS4/WS5 UI).

  - EventDetailBody: role-aware capabilities from `CleanupDTO.myRole` (organizer-id fallback) - Edit for organizer+cohost, Cancel organizer-only, a "You are co-hosting" pill, and an "Invite" action (replacing the host's ShareButton) that opens the new InviteSheet.
  - New `InviteSheet` primitive: share link, Instagram handoff (copy link + open IG, native), Facebook sharer, web copy-link + email, and an injected native contacts-to-SMS flow.
  - New `ContactsInviteAdapter` capability (optional `contactsInvite` on `PlatformCapabilities`, `useContactsInvite()` hook, `FakeContactsInvite`) - the mobile host injects expo-contacts/expo-sms behavior (plus the clipboard write for the Instagram handoff) without any expo module crossing into shared code.
  - MembersBody: Host / Co-host role chips; organizer viewers can promote/demote co-hosts and remove anyone (2-step confirm); co-host viewers can remove plain members.
  - New data hooks `useSetMemberRole` / `useRemoveMember` (invalidate the cleanup detail + attendee roster; removal also patches the cached roster and going counts); `useLogEventHours` moves to the per-attendee `entries` request shape.
  - Per-attendee volunteer-hours editor on done events for organizer+cohost, gated on the ACTING viewer being verified (with a get-verified nudge), with a default value + "apply to all" and per-row validation (0 < h <= 24).
  - NotificationsBody renders the new `cleanup_role` notification type.
  - New `invite` i18n namespace + event-detail/event-members strings in en/es/de/ko.

### Patch Changes

- Updated dependencies [2951e09]
- Updated dependencies [8814836]
- Updated dependencies [7d8192c]
- Updated dependencies [ef7958c]
- Updated dependencies [6fc1a0b]
- Updated dependencies [b15bedb]
- Updated dependencies [b1cc623]
- Updated dependencies [f641dae]
- Updated dependencies
  - @civfix/shared@0.26.0

## 0.28.1

### Patch Changes

- Leaderboard entry in the people section
- Report submit PUTs the media bytes to the presigned URL through `putUpload`, which aborts the request after a timeout so a stalled or unhandled-scheme upload rejects (surfacing the wizard's retry) instead of stranding the flow on "submitting" forever.
- Follow toggle now patches the connection lists (followers / following) so a FollowButton in a ConnectionsBody row flips optimistically and reconciles/rolls back with the mutation instead of staying stale until refetch.
- PersonDetailBody keys its activity query by the resolved `profile?.id` (a UUID) instead of the route ref (often an `@handle`), so the UUID-typed `/people/:id/activity` request only fires once the profile has resolved.
- Web map defers pin `root.unmount()` to a microtask on marker reconcile and map teardown, fixing the "Attempted to synchronously unmount a root while React was already rendering" warning on map transitions.

## 0.28.0

### Minor Changes

- 2de6f24: Report chat as a group chat: promote per-report discussion into a first-class group conversation on the chat backbone.

  - `ChatMessageDTO`: nullable `from` + `kind:"system"` + `system` payload (report timeline events) + `cityMention`/`forwardedToCity`.
  - `MessageThreadDTO`: `report` kind + `muted`; `NotificationType`: `report_chat`.
  - Report chat is view-only until you Join (join/leave + per-conversation mute endpoints); it appears in the `/threads` inbox; `ReportDTO` carries report-chat metadata (joined/memberCount/messageCount/unread).
  - UI: `ConversationBody` report mode (Join banner, centered system rows, @city pill, Mute/Leave), `ReportDetailBody` "View chat" + inline timeline (bell removed), inbox report rows + muted glyph, `report_chat` notification glyph.
  - Removes the per-report discussion schemas/endpoints/UI, the `report_discussion` roomKind, and the report-follow hooks. `ReportDTO.following` is deprecated (always false).

### Patch Changes

- Updated dependencies [2de6f24]
  - @civfix/shared@0.25.0

## 0.27.7

### Patch Changes

- 8db69d1: Contacts surface (issue #76): the People search screen (`SocialBody`) now shows a first-class "Your contacts" entry — when signed in and not mid-search — that opens the viewer's following list (the people they follow). Surfaces the existing follow graph as a discoverable "Contacts" list without a list-everyone query. New i18n keys added across en/es/de/ko.
- f94ec49: Map focus (web + native): generalize the `mapFocusStore` from report-only to any focused entity (report OR cleanup/event). Opening an event detail now drives the persistent home map to zoom to the event's pin and draw ONLY that pin at FOCUS_ZOOM — exactly like a report detail already does — so tapping an event anywhere in the app frames it on the map even when its layer would otherwise hide it. The store keeps `setReport(...)` (unchanged signature) and adds `setEvent(...)`; the `<Map/>` seams branch on `focus.kind` to render a TeardropPin (report) or EventPin (cleanup). `EventDetailBody` sets the focus on mount and clears it on unmount, mirroring `ReportDetailBody`.
- 69414ea: Report chat UI (issue #76): the report detail's "Discussion" tab becomes a real-time telegram-style group chat (public-read, authed-write) backed by the shared chat stack with room kind `"report"`, replacing the REST discussion surface. `useChat` gains a `"report"` branch (history via `reportMessages`, delete/react via the report endpoints). The report-discussion hooks/components remain (deprecated) for the migration window.
- cfba7ee: Profile social links (issue #76): ProfileView renders the user's Facebook/Instagram/TikTok/X/WhatsApp links as tappable labeled chips that open the canonical `socialLinkUrl(...)` via `Linking.openURL` (RN-web safe, never throws), shown below the bio and hidden when there are none. ProfileBody gains a per-platform editor that normalizes input (strips a leading `@` / non-digits for WhatsApp), validates with `SocialLinksSchema` before submit, and re-sends the current handle + display name on the `PUT /me/profile` the contract requires. New i18n keys added across en/es/de/ko.
- 163f3d3: Volunteer hours + per-jurisdiction leaderboard UI (issue #76): a new `LeaderboardBody` (per-jurisdiction ranked list — rank, avatar, name, verified mark, hours) reached via a new `leaderboard` nav route; a volunteer-hours stat on `ProfileView` (tappable to the viewer's primary-jurisdiction leaderboard); a verified-host "Log volunteer hours" action + inline editor on `EventDetailBody` for completed events; and the `useMyHours` / `useJurisdictionLeaderboard` / `useLogEventHours` data hooks. New `leaderboard` i18n namespace plus keys across en/es/de/ko.
- Updated dependencies [69414ea]
- Updated dependencies [cfba7ee]
- Updated dependencies [163f3d3]
  - @civfix/shared@0.24.2

## 0.27.6

### Patch Changes

- Nav store (compact + regular): give the compact bottom-sheet a real back-stack. Previously `push` REPLACED the stack in compact mode, so Back from any drill-down (settings → profile, person → followers, …) collapsed straight to home instead of stepping back one level. `push` now APPENDS in both compact and regular modes, building a true back-stack. A new `openDetail` verb REPLACES the top entry for the lateral case (selecting a different map marker while a detail is already open), so marker-to-marker switches don't accumulate dead history. Consumers (web home-map, mobile MobileNavAdapter/index) updated to call `openDetail` for map-marker selection and `push` for drill-down navigation.

- CleanupForm: drop the in-form report PICKER (search box, type-filter chips, paginated report list, pick-on-map flow) in favor of the single autofilled "linked report" card. A cleanup links to AT MOST ONE report, and ONLY by being created through that report ("Host an event" from a report detail seeds the link + autofills the meet location). The form now renders just that one report as a removable card at the top (`LinkedReportCardById`), removing the dead picker UI and its styles (~550 lines). Behavior-preserving for the supported flow.

## 0.27.5

### Patch Changes

- CompactShell (web / mobile-web): fix the iOS Safari soft keyboard glitching / failing to come up when tapping a search bar. The shell sits in a `position:fixed` non-scrolling document pinned to the bottom; focusing a search field expanded the sheet over a 280ms CSS height transition, which slid the focused `<input>` up the screen WHILE iOS was presenting the keyboard. On a coarse pointer the search-focus expand (and the keyboard-aware scroller's `onKeyboardShow`) now snaps to full INSTANTLY (no transition) so the field is at its final, keyboard-clear position before the keyboard animates in. A fine pointer (desktop, no soft keyboard) keeps the smooth animated expand. Adds a `snapAnimated` flag + an `animated` arg to `setSnap`.

## 0.27.3

### Patch Changes

- FeedBody (portrait / compact home): render the "Suggested events" list ABOVE the "Your feed" activity stream (previously the feed was first). Affects the mobile sheet and the mobile-web portrait/compact home.

## 0.27.2

### Patch Changes

- LocationPicker / PortraitMapPickStep: add an optional `markerCategory` prop so the report-creation location picker drops the SELECTED report category's teardrop pin (category color + white category glyph, matching that report type's map marker) instead of the coral event / meeting-point pin. Event hosting is unchanged (it passes no `markerCategory`, so it keeps the coral pin). Honored by the native seam.

## 0.27.1

### Patch Changes

- Add location i18n keys for the mobile report details step (tappable location row, "use current precise location" button, and full-screen map-picker states) so the report flow can change the address / pin even when device location is enabled.
- ReportDetailBody: render the Notify control as a compact icon-only bell and wrap the status badge so it stays vertically centered, keeping the status + action row on a single line across locales.

## 0.27.0

### Minor Changes

- 6e36e93: Map: events that stem from reports now show unified (#70). A cleanup with linked reports renders as one "blend" marker (the event teardrop + a count of its linked reports) in place of the separate event pin + report pins; tapping it opens the merged-reports list with the event as a header row. Adds `BlendPin`, the `onPressBlend` MapProps handler, the pure `computeMapBlends` helper, and a `blend` nav kind (reuses ClusterReportsBody).

  Map layers now default ON across all platforms — report categories show on first run (#73b).

  The inline time picker no longer clamps to 12–2am on Android: a wrapping grid of time chips replaces the nested vertical ScrollView the gorhom bottom sheet swallowed (#73c).

  Messaging now names the person, not their @handle: the DM thread title (inbox row + conversation header) and message notifications use the sender's display name (falling back to @handle only when the name is blank).

## 0.26.14

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.24.0

## 0.26.13

### Patch Changes

- Tighten the events list (EventsBody) section spacing in the portrait/compact sheet: a section header now hugs its first card instead of sitting a full card-gap away, and the gap between the "Host an event" pill and the first section is reduced. Replaces the uniform ItemSeparatorComponent with per-row top gaps (header→card tight, card→card unchanged, a slightly larger break above a following section).

## 0.26.12

### Patch Changes

- fix(shell): derive the native home-sheet glass card height from gorhom's measured container

  Follow-up to 0.26.10's Android nav-bar inset fix. The glass card still sized its height off
  `useWindowDimensions().height`, which on Android edge-to-edge under-reports the screen by a varying,
  device-specific amount (more than just the two system bars), so the collapsed peek card came out far too
  thin (barely wrapping the search box) with a gap above the nav bar, and the expanded card stopped short.

  Fix: size the card off gorhom's own MEASURED hosting-container height (`rawContainerHeight`, read via
  `useBottomSheetInternal` in the background component) instead of `useWindowDimensions`. For a non-modal
  sheet the sheet bottoms exactly at `rawContainerHeight` in `animatedPosition`'s coordinate space (the
  hosting container is already inset by `bottomInset`; the detent position is `containerHeight - snapHeight`),
  so `cardH = snapHeight - gap` on every device by construction (peek = 80px). iOS is unchanged: it falls back
  to `useWindowDimensions`, which equals the full screen there.

## 0.26.11

### Patch Changes

- Fix #71: the event-detail host Follow button now reflects the viewer's live follow state (it read the backend-hardcoded `organizer.isFollowing=false`, so tapping it never visibly changed). The compact home search now works on mobile — typing replaces the feed with grouped People / Events / Reports results (public report search), mirroring the expanded home sidebar.

## 0.26.10

### Patch Changes

- fix(shell): reserve the Android navigation-bar inset on the native home sheet

  On Android edge-to-edge (Expo SDK 54 / Android 15, enforced), `CompactShell.native` anchored the pull-up
  sheet flush to the physical screen bottom (under the nav bar) and sized its glass card off
  `useWindowDimensions().height`, which on Android excludes the nav bar while gorhom's container does not. The
  two references diverged by the nav-bar height, so the card collapsed toward 0px at peek (looked fully
  transparent), stopped short of the bottom when expanded (a gap), and the sheet content overlapped the nav
  bar when collapsed.

  Fix: pass a CONSTANT `bottomInset={Platform.OS === "android" ? insets.bottom : 0}` to the `<BottomSheet>`
  (and drop the now-redundant full-body `paddingBottom` on Android). The constant inset lifts the sheet so its
  bottom seats at the nav-bar top, which makes the existing card-height math evaluate correctly again. iOS is
  untouched: `bottomInset` stays 0 (gorhom's default) and the full-body padding stays `insets.bottom`.

## 0.26.9

### Patch Changes

- Two mobile event features:

  - **Host-event pin-link flow**: while hosting an event, the in-progress form now persists in a draft store,
    so tapping a report pin's "View details" no longer wipes your half-filled event. The report detail shows a
    "Back to your event (N)" bar + an Add/Remove toggle, and returning restores all progress (web/landscape
    inherit the persistence).
  - **Events list sections**: the events menu now shows an "Attending" section on top (your upcoming RSVP'd /
    hosted events) and an "In your area" section below, ranked by a near+soon blend of distance-to-your-current-
    location and how soon the event is. The home feed's suggested events are now location-weighted to match the
    sidebar.

## 0.26.7

### Patch Changes

- Profile hero: stop a long display name from overlapping the sign-out pill. The `heroName` now
  `flexShrink: 1` + `minWidth: 0` so a long name truncates within the name row instead of pushing the
  inline pencil/verified badge past `heroWho` into the fixed sign-out pill.

## 0.26.6

### Patch Changes

- Native location picker is now a full-screen, moveable map. The compact/portrait
  `PortraitMapPickStep` (native seam) was a small gesture-disabled inline map between two cards; it now
  fills the screen with the moveable home-map core (pan/zoom on, tap to drop/move the pin, search to fly
  there), a floating address search at the top, and a floating confirm/cancel bar at the bottom. Adds
  opt-in `interactive` / `fullBleed` / `attributionBottomInset` props to `LocationPicker` (defaults keep
  the inline picker gesture-disabled so its scroll-embedded uses are unaffected).

## 0.26.4

### Patch Changes

- Messaging + compact-header polish:

  - **Thread avatars now match people everywhere else.** A DM renders the peer's real backend/provider
    photo, otherwise the same deterministic solid brand color + single-letter monogram the shared `Avatar`
    draws on connections / feed / profile (gradients retired). Group / cleanup rooms keep a Users glyph on
    that same seeded solid color. The thread→avatar decision is now a pure, unit-tested `resolveThreadAvatar`
    and `ThreadAvatar` delegates to `Avatar` so photo load / fallback / ring are shared, not duplicated.
    `ConversationBody` threads the peer's photo + color seed through so the chat header matches the inbox row.
  - **Signed-out compact header shows a sign-in icon.** When the viewer is signed out (terminal: not authed,
    not pending) the SearchHeader trailing slot renders a sign-in glyph that opens auth directly, instead of
    the old "You" avatar that opened a profile containing nothing but a sign-in button. Pending sessions keep
    the avatar so a reloading logged-in viewer never sees a sign-in flash. Gated by a pure `headerAuthAffordance`
    predicate (new `onSignIn` prop on `SearchHeaderProps`); `a11y.sign_in` added in en/es/de/ko.
  - `PrimaryButton` primary fill uses the `brand.bloom` token.

## 0.26.3

### Patch Changes

- #60 follow-up: stop the outgoing body reflowing during the desktop-web panel transition. The panel header (back chip + title) was static chrome rendered ABOVE the crossfade host, conditional on the active body — so on home↔detail it mounted/unmounted and shoved the `flex:1` host (and its absolutely-positioned outgoing layer) down by the header height, making the homepage content visibly jump to below the new header before fading. The header now lives INSIDE the `BodyTransition` (per-screen), so the host geometry is invariant across a swap and the header simply crossfades in with its body — matching the messaging-tab swap that was already immune. Web-only behavior; native `BodyTransition` is a pass-through and the expanded layout stays visually identical.

## 0.26.2

### Patch Changes

- #60 follow-up: make the desktop-web body transition a smooth simultaneous crossfade instead of a sequenced fade-out-then-in. The outgoing body now fades `1→0` in place while the incoming body fades `0→1` and slides in over the SAME duration with no delay; because the two opacities are mirror images the total on-screen opacity stays ~1 throughout, removing the mid-transition "step"/empty gap while still avoiding two fully-opaque screens at once. Web-only; native `BodyTransition` stays a pass-through.

## 0.26.1

### Patch Changes

- #60 follow-up: sequence the desktop-web body transition so the previous and next screens are never both visible at once. The outgoing body now fades out first (in place), then the incoming body slides + fades in after it has left (a fade-through-background), instead of parallaxing the outgoing under a visible incoming. Web-only; native `BodyTransition` stays a pass-through.

## 0.26.0

### Minor Changes

- Fix five reported issues:

  - **#55** (web DM): sending an image no longer desyncs prior messages' action hitboxes (the overflow 3-dots + edit pencil). The inverted rn-web list cell no longer changes height across the optimistic→confirmed reconcile — own-image rows now reserve identical height in both states (web-gated; native byte-identical).
  - **#65** (follow): the Follow/Unfollow button now updates immediately instead of only after a refresh. The optimistic cache patch matches the profile by `id` across the whole `["profile"]` query prefix, fixing the handle-vs-UUID cache-key mismatch.
  - **#60** (web): iOS-style sliding push/pop + cross-fade transitions for desktop-web navigation via a new `BodyTransition` seam (CSS-transition based, reduced-motion aware). Native is a pass-through (unchanged).
  - **#61** (report/host): portrait/compact big-map location picker (new `PortraitMapPickStep`) for the report-capture and event-host flows, full-screen capture + location steps, and reverse-geocoded address display (`useReverseLabel`, address with coords fallback).
  - **#66** (mobile sheet): fix the intermittent "content won't scroll at full height" bug — deterministic gorhom scrollable registration via a stable per-body key plus a stable `ScrollView` mount in conditional bodies (`ProfileBody` and same-pattern lists). Preserves content-drag.

## 0.24.0

### Minor Changes

- `TermsConfirmation` consent primitive (explicit Terms + Privacy agreement, alongside the 13+ gate). Native
  host-event report-link preview panel rendered as a projected sibling overlay (so its Add/Remove buttons are
  tappable on iOS), plus inline-map scroll fixes so the host form and event detail scroll in portrait
  (`LocationPicker.native` gesture disable + `MiniMap.native` touch pass-through).

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.21.0

## 0.23.0

### Minor Changes

- Encampment is now its own report category (split out of `hazard`), plus a viewport-biased address search and consent primitive.

  - **shared**: add `encampment` to `ReportCategorySchema`, `REPORT_CATEGORY_LABELS`, the `color.category` token (teal `#2FA39A`), and remap `REPORT_TYPE_TO_CATEGORY.encampment`/`WEB_REPORT_TYPES` from `hazard` → `encampment`. `photonSuggest` gains optional `proximityZoom` + `locationBiasScale` to tune proximity bias.
  - **ui**: `encampment` pin glyph + `CATEGORY_ICONS`/`PIN_GLYPHS`/`icon-map` (lucide `Tent`); new `useMapViewport` bus + viewport-biased `AddressSearch`; new `TermsConfirmation` consent primitive (sibling of `AgeConfirmation`); `useReportSubmit` now invalidates the map-reports queries so a freshly filed report shows on the map immediately; removed the success-screen teardrop pin.

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.20.0

## 0.22.0

### Minor Changes

- 41f684a: Accessibility (WCAG 2.1 AA / ADA) batch plus a full-screen media viewer and host-event tweaks:

  - Contrast: white-on-coral controls (PrimaryButton, CountBadge, FollowButton, RsvpPill, GlassButton accent, reactions) move from bright bloom (#FF7A6B, 2.5:1) to bloom-700 (#B8463A, 5.3:1); CategoryChip labels use ink. Fixes WCAG 1.4.3.
  - New `MediaLightbox` seam: tap any report / chat / discussion photo or video to view it full-screen (MediaLightboxProvider + useLightbox, mounted in AppShell; reuses the MediaPreview seam; web keyboard + aria-modal, native RN Modal). useLightbox degrades to a no-op when no provider is mounted.
  - New `announce()` seam for screen-reader status messages (web aria-live / native AccessibilityInfo), wired into report submit, message send-failure, event publish error, and data export. Fixes WCAG 4.1.3.
  - Form labels: TextField associates its label with the input (useId + accessibilityLabelledBy); BringInput gains an accessibilityLabel. Fixes WCAG 1.3.1/4.1.2.
  - Image labels: MediaPreview gains an `alt` prop (decorative when empty); Avatar gains `accessibilityLabel` / `decorative`. Fixes WCAG 1.1.1.
  - Shell panel titles expose `accessibilityRole="header"` + a focus target for web route-change focus management (WCAG 2.4.3).
  - Host an event: the unverified disclaimer is now coral-red; the linked report-photo strip cards are wider (176 -> 212px).

## 0.21.0

### Minor Changes

- New `ToastProvider` + `useToast()` primitive (D15): a minimal, dependency-free, cross-platform transient-notification system. The provider holds a small queue and renders an RNW-safe absolutely-positioned overlay at the root (NOT a native-only Modal, no `useSafeAreaInsets`), auto-dismissing each toast (default ~2.8s); `useToast().show(message, { variant: "success" | "error" | "info" })`. The consumer mounts `<ToastProvider>` at the app root.

  Content-report submit now fires a success toast ("Report submitted - thanks") on top of closing the sheet, across all four callers (report detail "Report this report", conversation, event detail, person detail). Inline error wiring is unchanged.

  Report detail + event detail show the immutable `referenceCode` as a muted mono caption under the title (rendered only when present).

  Report detail timeline renders a collapsible city-reply node: a Mail-glyph node carrying the inbound `body` (D13), collapsed by default to the short `note` preview with a "Show full message" chevron toggle (reuses the existing TimelineRow `open` state).

  `MentionAutocomplete` / `DiscussionComposer` can suggest the report's routable jurisdiction as a mention candidate (D12): the candidate type gains an optional `kind: "user" | "jurisdiction"` discriminator and renders a government building glyph instead of an avatar (no faked user row). The jurisdiction is injected only when `cityHandle` exists and the city is reachable; the user typeahead is unchanged.

  Event detail gains a verified-host "Request resources from the city" action (D19): visible only to the host, opening a `RequestResourcesSheet` composer (required message, max 2000) wired to the new `useRequestEventResources(cleanupId)` hook (`POST /cleanups/:id/request-resources`). On success it fires a toast and closes; an identity-unverified host sees an explanatory hint, and an event with no resolved jurisdiction shows a subtle "no city mapped" note.

## 0.20.0

### Minor Changes

- Report discussion: tapping a comment's Reply / Edit / Delete / Report (and other actions) now fires on the FIRST tap while the composer keyboard is up, instead of the first tap only dismissing the keyboard. Reply prepends `@handle ` to the start of the in-progress draft and keeps the keyboard open (`keyboardShouldPersistTaps="handled"` on the report-detail scroll). The events list search field gets the same fix.

  Map-cluster report list now reads identically to "Your reports": each row hydrates the full report (`useReport`, lazy per visible row) so it shows the first-photo thumb, the street address, and the `{when} · {latest note}` foot, falling back to the lightweight map-pin data while it loads. The foot's height is reserved pre-hydration so dense clusters don't jump as rows fill in.

## 0.19.0

### Minor Changes

- Report discussion: auto-scroll the detail body to the newest comments when the composer gains focus, when
  the soft keyboard shows (native), and after posting, so the latest comments and your just-sent message are
  in view (portrait, web + mobile). Also hide the govt-forward composer disclaimer entirely when the city
  isn't mapped/reachable (drops the "@city isn't reachable yet" line).

  (This release also bundles in-progress UI working-tree changes in the same tree: location picker, draft
  store, and the keyboard-aware-scroll / bottom-sheet composer refinements continuing the 0.18.x work.)

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.16.0

## 0.18.3

### Patch Changes

- Keep the report-discussion comment composer fully above the soft keyboard on the native bottom sheet (incl. multi-line). The composer's field is now the shell-injected text input (gorhom's `BottomSheetTextInput` inside the sheet, plain RN TextInput on web/expanded) so the sheet TRACKS the focused field, and the sheet's `keyboardBehavior` is `"interactive"` (moves the sheet by the focused input's overlap to keep it above the keyboard) instead of `"extend"` (which only grew the sheet, leaving a bottom-anchored composer covered). Verified on the iOS simulator: composer sits above the keyboard with a clear gap, typing works, multi-line grows + stays above the keyboard, and the map search field (top of the sheet) is unaffected.

## 0.18.2

### Patch Changes

- Fix the report-discussion comment composer being hidden behind the soft keyboard on the native mobile sheet. The report detail forces the bottom sheet to its MID detent, and (unlike the map search bar) the composer had no focus handler to grow it, so focusing it left the composer covered by the keyboard with no way to scroll to it. The composer now grows the sheet to its tallest snap on focus (mirroring the search bar's onFocus->setSnap(2)), keeping it above the keyboard. Verified on the iOS simulator.

## 0.18.1

### Patch Changes

- Fix two mobile regressions from 0.18.0:

  - Keyboard scroll: the opt-in "scroll to end on keyboard" computed its target from a viewport height measured before the bottom sheet extended, so on keyboard-open it scrolled the composer PAST the visible area (composer hidden, no room to scroll). Reverted to the proven focused-field reveal, which scrolls the focused composer just above the keyboard.
  - Edit modal: the native "dismiss keyboard cancels edit" listener fired on the transient keyboard-hide that occurs as the modal steals focus on open, slamming it shut before you could type. It now only cancels after the modal's own keyboard has actually shown (keyboardDidShow gate), preserving the intended dismiss-to-cancel behavior.

## 0.18.0

### Minor Changes

- UI/UX batch:

  - Map: the Layers popover now animates open/closed (fade + slide + scale, web-safe core Animated) instead of vanishing instantly.
  - Discussions: removed emoji reactions from report comments; replies are now Instagram-style — tapping Reply prefills the single composer with "@handle " and posts a flat top-level comment (no threads).
  - Discussions: deleting a comment now requires confirmation (new DiscussionMessageDeleteModal).
  - Discussions: the comment count now refreshes on create/delete (invalidates the parent report).
  - Edit: dismissing the keyboard on native now cancels a message/comment edit (matches web Escape / tap-outside).
  - Mobile keyboard: the composer + latest message auto-scroll above the keyboard on focus instead of only padding the bottom.
  - Host-event: linked-report image previews now fill their box (no letterboxing on web).
  - Events: a "View all" affordance opens the full attendee roster, where each attendee links to their profile.

## 0.17.0

### Minor Changes

- 89d95d5: Prominent + functional share, top-of-page verification disclaimer, and a polished kebab-menu highlight.

  - Add a prominent labeled `ShareButton` to the report and event detail (replaces the easy-to-miss icon-only share button on events; reports had no share affordance). Wires a new platform-neutral `shareLink` helper: the web share sheet with a clipboard fallback ("Link copied"), or the native OS share sheet, linking to the public web app (`/pin/:id`, `/cleanups/:id`).
  - Add a `VerificationNotice` banner pinned to the TOP of the event detail (a verified-neighbor trust banner / unverified caution, shown to viewers) and the host-an-event form (driven by the host's own verification status, with a "Get verified" nudge). Replaces the prior bottom-of-page / mid-form disclaimers.
  - `PopoverMenu`: the row hover/press highlight is now an inset, self-rounded pill (neutral `surfaceTint`) instead of a full-width rectangle that overflowed the card's rounded corners.

## 0.16.0

### Minor Changes

- Behavior-preserving frontend cleanup (zero visual/animation change): removed redundant comments and dead code, enforced strict ASCII (em/en-dash, implies/right arrows, Unicode ellipsis, approx, curly quotes -> ASCII in comments and inconsistent rendered copy), and applied cross-cutting DRY.

  - `@civfix/shared`: comment/ASCII normalization only; no schema, type, client, or runtime behavior change.
  - `@civfix/ui`: internal dedup helpers (`appErrorCode`, nav helpers `openThread`/`pushCleanup`/`idKeyExtractor`, a shared reaction reducer, extracted byte-identical seam StyleSheets for `MediaPreview`/`SearchHeader`) plus additive `theme.colors` scrim tokens (`scrim`/`scrimModal`/`scrimStrong`, equal to the rgba literals they replace). No rendered output or animation changes.

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.15.1

## 0.15.0

### Minor Changes

- Profile-picture consistency.

  - `@civfix/shared`: `AdminUserDTO` / `AdminUserListItemDTO` now carry `avatar` (gradient pair) + `avatarUrl`, so admin can show real photos. (PersonDTO already had `avatarUrl`.)
  - `@civfix/ui`: `useUpdateProfile` now pushes the updated user into the host auth store via a new optional `onUserUpdated(user)` data seam (so the top-left account avatar + sheet headers refresh immediately after a photo change instead of staying stale until reload) and invalidates the people/profile caches. Hosts wire `onUserUpdated` to their session store.

  Pairs with the backend change that makes `users.avatar_url` the canonical (public-CDN) avatar on upload and exposes `avatarUrl` on people/chat/dm/discussion/admin projections, so the same uploaded photo shows everywhere.

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.15.0

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

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.14.0

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

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.13.0

## 0.12.0

### Minor Changes

- Add a neutral 13+ `AgeConfirmation` primitive (privacy P0) for use in onboarding age gates.

## 0.11.0

### Minor Changes

- App Store / Play submission remediation + content safety.

  - Public UGC content reporting: `reportContent` (POST /content-reports) writing to the moderation queue; `ContentReportSubject`/`ContentReportReason` enums; `ReportContentSheet` + discrete Report buttons on comments, chat/DM messages, reports/pins, events, and profiles.
  - In-app account deletion: `deleteAccount` (DELETE /me) soft-deletes (keeps posts), and `requestDataExport` (POST /me/data-export) emails the user a full data compilation. ProfileBody danger zone + Blocked-accounts list + Contact support.
  - Deleted-account handling: `PersonDTO.deleted` / `DiscussionAuthorDTO.deleted` render "Deleted User" publicly (`DELETED_USER_LABEL`); admin keeps real identity.
  - User-deletable messages: `deleteDmMessage` / `deleteCleanupMessage`; `ChatMessageDTO.deletedAt`/`mine`; `useChat().delete` + tombstone.
  - Admin: `ModerationKind += user_report`, new `ModerationSubjectType`, `ModerationListItem/ItemDTO.subjectType`, `AdminUserDTO.deletedAt`, admin message `deletedAt`, `removeUserMessage`.
  - Map attribution on `LocationPicker.native`.

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.12.0

## 0.10.0

### Minor Changes

- Event report-linking overhaul:

  - Pick reports **before** setting the meeting location, with text **search**, a separate **filter-by-type** chip row, and a **load more** button. Report rows now lead with the type and show the description beneath.
  - New public report-search contract: `searchReports({ q?, categories?, cursor?, limit? }) → { items, nextCursor }` (`GET /v1/reports/search`), and `ReportPinDTO` now carries `description`.
  - Map "event-link mode" (`eventReportLinkStore`): while creating/editing an event the map temporarily shows only the filtered report pins, each with a **+ (not added) / ✓ (added)** badge; tapping a pin opens its detail with an **Add to event** action. Normal map behavior is unchanged when not linking.
  - Phones get a **"Pick on map"** affordance that collapses the sheet to reveal the map for tapping.

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.10.0

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

### Patch Changes

- Updated dependencies
  - @civfix/shared@0.9.0

## 0.8.0

### Minor Changes

- 85c89c0: Home "Your next event" backed by a viewer-scoped events filter.

  - Contract: `ListCleanupsRequestSchema.when` gains `"attending"` - a viewer-scoped filter returning the upcoming events the signed-in viewer is a member of (RSVP'd or hosting, since the organizer is auto-joined), soonest-first. Anonymous callers receive an empty list. Additive (the other `when` values are unchanged), so existing consumers keep parsing.
  - UI: new `useAttendingCleanups` hook (auth-gated, keyed `["cleanups","attending"]`, refetched by the RSVP settle invalidation). The home sidebar's "Your next event" now reads `data[0]` instead of client-filtering the global upcoming list, so an attending event outside the nearby radius is never missed; the suggested-events gallery excludes everything the viewer already attends.

  The matching backend implementation (the `when=attending` membership filter in the cleanup list query) ships in the civfix-backend repo and consumes this contract once published.

- 98d7145: Profile-picture upload + Followers/Following lists.

  - Contract: `UpdateProfileRequestSchema` gains an optional `avatarUploadId` (a finalized media upload id) so the own-profile avatar picker can set a profile photo through the existing media pipeline. Adds `ConnectionsListQuerySchema` and two endpoints — `listFollowers` (GET `/people/:id/followers`) and `listFollowing` (GET `/people/:id/following`), both anon-ok and cursor-paginated, reusing `ListPeopleResponseSchema`.
  - UI: the own-profile avatar shows a camera affordance that picks an image, uploads it (presign → PUT → finalize), and sets it via `PUT /me/profile`. Tapping the Followers/Following cells opens a new `ConnectionsBody` list (new `followers`/`following` nav kinds), each row a tappable person with a Follow button.

- bf3b251: Resizable landscape sidebar, persisted across sessions.

  The expanded-shell sidebar now has a drag handle on its right edge: dragging sets the sidebar width (clamped to 300-560px and never wider than the viewport allows). The chosen width persists via a new storage seam - COOKIES on web (`civfix.sidebar-width`), MMKV on native - so it survives a reload / app restart, and zustand's synchronous hydration means the first paint already uses the saved width (no flash). The handle is screen-reader operable (an `adjustable` slider with increment/decrement) and shows the `ew-resize` cursor on web. New `useSidebarStore` + `clampSidebarWidth` exported from `@civfix/ui`.

### Patch Changes

- 34a620b: Make the shell drag handles work on touch devices.

  The CompactShell bottom-sheet grab handle and the ExpandedShell sidebar resize handle now set
  `touch-action: none` (web) so a touch browser stops claiming the vertical/horizontal drag as a page
  gesture (scroll / pull-to-refresh / swipe-nav). Without it the browser fired `pointercancel` →
  `onPanResponderTerminate`, aborting the drag mid-flight, so the sheet and the new resizable sidebar were
  undraggable on touch (mouse never hit that arbitration). `touch-action` is scoped to the handle only —
  each handle is a sibling of the scrollable body/card, so native touch scrolling inside is unaffected.

- Updated dependencies [85c89c0]
- Updated dependencies [98d7145]
  - @civfix/shared@0.8.0

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

- 04a348d: Expanded profiles + document verification UI.

  - New `VerifiedBadge` primitive: a tiny inline brand-sky check badge ("Verified") rendered next to a
    name in the profile hero, person detail, event organizer card, and event cards.
  - `ProfileView` (presentational): renders the verified badge next to the name; an own-profile editable
    bio (multiline editor + char counter, saved via the wrappers); a read-only Activity section (one row
    per `UserActivityItemDTO` kind with an icon, title/subtitle, and relative time); and an injectable
    verification-affordance slot. All new data arrives via props/slots - ProfileView stays data-free.
  - `ProfileBody` (own profile): wires `useMyProfile` + `useMyVerification` + `useUserActivity` + a new
    bio-save mutation, and renders the "Apply to become verified" / "Verification under review" /
    "Verified neighbor" affordance reflecting the viewer's verification status.
  - `PersonDetailBody` (others' profiles): the verified badge in the hero + the person's Activity section.
  - New `VerificationApplyBody` (nav kind `verify`, route `/verify`): a "+ Add document" capture list
    (reusing the camera capture + presign/upload media capability the report wizard uses, capped at
    `MAX_VERIFICATION_DOCUMENTS`, removable thumbnails), an optional reviewer note, and a Submit that
    uploads the documents and calls the new apply mutation.
  - Events: `EventDetailBody` shows the verified badge next to a verified organizer, a disclaimer when the
    organizer is unverified, and a gentle verify nudge to an unverified host viewing their own event;
    `CreateCleanupBody` shows a bloom-tinted "marked as unverified" note to unverified hosts; `EventCard`
    - the events list cards show a subtle verified badge for verified organizers.
  - New shared data hooks: `useMyVerification`, `useApplyForVerification`, `useUserActivity`,
    `useUpdateProfile`, plus verification + activity query-key factories.

  Consumes the additive `@civfix/shared` contract (`PersonDTO.verified`, `UpdateProfileRequest.bio`,
  `MyVerificationDTO` + apply/document endpoints, `UserActivityItemDTO` + the activity endpoint). All
  additions are backward compatible - the verified flag, bio, and activity are optional.

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

### Patch Changes

- Updated dependencies [a316a4e]
- Updated dependencies [bd2e090]
- Updated dependencies [04a348d]
  - @civfix/shared@0.7.0

## 0.6.5

### Patch Changes

- Fix a stuck DM unread badge: opening a conversation and tapping back before the ~1.2s read-receipt debounce fired never sent the `ack`, so the thread's unread count was never cleared and the "(1)" badge persisted forever (even across refreshes). The read watermark is advanced only by this WebSocket `ack` (there is no HTTP mark-read), so a dropped ack stranded the thread as unread. `useChat` now records the owed read-ack in a ref and FLUSHES it when the conversation unmounts or the room changes, so a quick open→close still marks the thread read. The 1.2s debounce still coalesces a burst of inbound messages into a single ack while the conversation stays open. Applies to both DMs and cleanup group chats, web and mobile.

## 0.6.4

### Patch Changes

- Conversation composer redesign: the send button now sits inside the message box (iMessage-style), bottom-anchored as the box grows, with the empty box height aligned to the button; input is silently capped at 150 characters (`MESSAGE_BODY_MAX`). Message list tuned for long conversations — windowing props plus `maintainVisibleContentPosition` (with a react-native-web prepend scroll-anchor) so loading older history no longer jumps the viewport, a "new messages" pill when scrolled up, and scroll-to-bottom on send. Report flow: the "View my report" button now resets to home before opening the report detail, so Back (on-screen, browser, and hardware) returns to the home section on web and native.

## 0.6.3

### Patch Changes

- Redesign the DM conversation header. Remove the "Live"/"Connecting"/"Offline" status pill (connection state still shows in the composer's offline/reconnecting banner) and replace the standalone block button with a three-dot overflow menu offering "Open profile" and "Block". `ConversationBody` gains an optional `onOpenProfile?: (peerId: string) => void` prop so a host can override how the peer's profile opens (the full-screen mobile screen routes to `/people/[id]`); it defaults to pushing a `person` entry onto the unified nav store (the web panel / in-sheet behavior). Backward compatible — the new prop is optional.

## 0.6.2

### Patch Changes

- Fix a web crash when opening a DM/conversation. `ConversationBody` is the one cross-platform body that reads safe-area insets; it called `useSafeAreaInsets()`, which throws ("No safe area value available...") on web where no `<SafeAreaProvider>` is mounted by design. It now reads `SafeAreaInsetsContext` directly with a zero fallback (insets are unused on web — they only drive the mobile `fullScreen` layout), so native is unchanged.

## 0.6.1

### Patch Changes

- Smooth the CompactShell native pull-up/pull-down. The floating glass card now sizes its height off gorhom's `animatedPosition` (no interpolation drift or leftover edge), the content floats in on the same continuous insets, and the body fades out early on collapse. The gorhom index binds declaratively to the store snap so the sheet lands on the right detent after the full-screen report flow re-mounts the map-home.

## 0.5.2

### Patch Changes

- Updated dependencies [09cb3f2]
  - @civfix/shared@0.5.0

## 0.5.1

### Patch Changes

- e351fc4: Native pull-up sheet + messaging/camera fixes:

  - CompactShell.native: fix the "can't scroll anywhere" regression (the content host is a plain View, not BottomSheetView, so the body's gorhom scrollable keeps the scroll handoff) and the drag text-flicker (worklet-only float geometry; no per-frame height animation under the BlurView). Restore the floating glass geometry (side + bottom gaps via the sheet style margin + bottomInset) so the sheet matches the web portrait shell, and clip the content host to the rounded card (overflow:hidden + animated radius) so a collapsing detail's text no longer spills outside the card.
  - Nav: add `collapseToParent` (useNavStore) + `parentViewForEntry` (routes) so dragging a detail down to peek returns to its parent list (event detail → events, report detail → reports, …) instead of staying on the detail.
  - ConversationBody: add optional `fullScreen`/`onBack` props (default off) so a host can render the conversation as a separate full screen with a screen-level KeyboardAvoidingView; export `useKeyboardVisible` from the shell.
  - ReportFlowBody / CameraCapability: add an optional `orientation` to `capture()` and request portrait for civic capture (the camera button UI is unchanged).
  - BrandAboutCard: point the Donate CTA at reachoutla.org/help.

## 0.5.0

### Minor Changes

- - About civfix modal: drop the Donate heart icon and the "Maybe later" button; add a Terms · Privacy link row that opens the legal pages via the openExternal capability.
  - Landscape home sidebar: surface the civfix logo to the LEFT of the search bar (it previously sat hidden behind the sidebar), and tapping it opens the About modal. Adds a shared `useBrandAboutStore` / `openBrandAbout` so shared surfaces can request the About modal open without importing host code.
  - Create/report flow: inline date-time picker (`InlineDateTimePicker`) with related `CreateCleanupBody` / `ReportFlowBody` / `draftStore` / `submit` updates and pin tweaks (`EventPin`, `PinSvg`).

## 0.4.3

### Patch Changes

- Mobile QA pass for the compact bottom sheet + bodies:

  - The floating sheet card now matches the web portrait at every snap — animated side gaps (12→4) and bottom gap (16→4), all-four-corner rounding sized to the _current_ snap height (the bottom corners no longer render square at peek), and a real drop shadow.
  - The map control stack no longer overlaps the expanded sheet: the sheet's gorhom container is raised above the controls (z60) so it covers them as it rises, and the reanimated fade workaround was removed.
  - The sheet header keeps the search bar a constant distance from the top across snaps (the peek-aware `paddingTop` that made it shift 6px was removed; native + web).
  - Report-detail status timeline now shows a visible connector rail between the steps.
  - `ThreadAvatar` strips a leading `@` from its monogram (so a `@handle` thread shows "RA", not "@R").
  - Feed/section line-heights are pinned to the web "normal" values so native headings/titles don't render looser than web.

## 0.4.2

### Patch Changes

- **Report wizard header consistency.** The "Report an issue" flow now has a header that matches every other detail (e.g. "Host an event") — a back chip + a **"Report an issue"** title (shared `detailHeader` geometry) — and the step progress rail moved out of the header into the content, directly beneath it. The back still steps _within_ the wizard (exiting to the map only from the first step), so the body keeps owning its header. Also fixed a latent CompactShell quirk: in portrait it drew a redundant blank `DetailBar` above body-owned headers (the report wizard + the conversation thread) — both `CompactShell` seams now suppress the shell header on a blank title, mirroring `ExpandedShell`.

## 0.4.1

### Patch Changes

- - **Report detail order:** the title, location line, and status row now render ABOVE the location pin + media gallery (was below), so the report leads with its identifying info.
  - **Capture fix:** adding a second image/video no longer drops the first. The report wizard's capture step now appends each capture (`addCapture`) instead of resetting the draft on every add, shows all captures as a removable thumbnail strip, and caps at `MAX_DRAFT_MEDIA` (5).

## 0.4.0

### Minor Changes

- Round-2 web UI/UX fixes (landscape/expanded react-native-web):

  - **Forms:** strip the browser UA focus outline + leaked textarea border from every shared text input (`webInputReset`), removing the stray "black boxes" around forms and search bars on web.
  - **Date picker:** bound + center the `DateTimeSheet` bottom sheet (maxWidth 420) so the calendar no longer stretches the full window with its month header/weekday row flung to the edges; the day grid stays a compact 7-column calendar.
  - **Location picker:** set the marker position before `addTo(map)` (fixes the crash — "Cannot read properties of undefined (reading 'lng')" — when picking an address suggestion into an empty picker); seed the host-event picker's `initialCenter` from geolocation/IP so it opens near the user instead of the US centroid.
  - **Report wizard:** the location step now matches Host-an-event (address search + interactive pin + an optional "describe where" field) and is always editable; the footer "Back" moved to a top back button (shared detail-header geometry), leaving a single full-width footer CTA.
  - **Report detail:** the location map and the media gallery now both render (gallery stacked beneath the location), instead of being mutually exclusive.
  - **Lists:** "Your reports" gains a search field (expanded sidebar) and a photo thumbnail per row (first ready image, else the category pin); the Events search field is gated to the expanded sidebar so it no longer duplicates the compact shell search header.
  - **People back button:** Profile → "Find people" now pushes the people panel in the expanded sidebar so the panel header shows a Back-to-profile (compact keeps the tab + shell search header).

## 0.3.0

### Minor Changes

- 4779cf7: Resolve the open items of the UI/UX megaticket (issue #16): report-detail media gallery (all attached photos/videos, web == mobile); /people and "view all events" search fields (+ event descriptions); map layer filters now persist across reload/app restart (zustand persist over a platform storage seam); mobile map pins seed on load; tapping the map dismisses the layers popover; report-form toggles drop the leaky native-switch styling on web; the report wizard lets web users drop a location pin; the event time picker scrolls correctly on web; the profile "Notifications" row becomes "Settings"; the chat typing indicator names the peer; "Your reports" no longer double-headers in the expanded layout; and avatar photos pin a consistent crop on web.

## 0.2.4

### Patch Changes

- 50c7024: Round-4 refinement from a fourth audit pass (React correctness, copy/microcopy, cross-body consistency). Fixes a web-only map bug where a kept cluster marker reused a stale click closure and opened the wrong enclosed-report list after a region re-fetch; settles user-facing copy on "event" (was a leaked "cleanup" split) and on a single offline-error message ("reach civfix" + "Check your connection and try again."); renames the "My reports" nav row to "Your reports" to match its destination; sentence-cases the multi-word report-type labels; and aligns several visual inconsistencies (PersonDetail secondary pill border, ReportFlow card radius/border, section-eyebrow font size, EventDetail share-button size).

## 0.2.3

### Patch Changes

- 5d62e80: Round-3 refinement from a third audit pass (keyboard/forms, safe-area insets, cross-seam parity): the native bottom sheet now reserves the bottom safe-area inset for full-layout bodies so the chat composer and report-wizard footer no longer fall under the home indicator at the full snap; BlurSurface.web renders the top sheen hairline native draws (web glass now reads with the same lift); the web LocationPicker hint is a centered glass pill matching the native seam; and the dead returnKeyType="next" is removed from the two Title fields (focus never advanced).

## 0.2.2

### Patch Changes

- 50afa24: Round-2 refinement from a second audit pass: FeedBody "Suggested events" gains an error state (was sticking on the empty state on load failure); the NotificationsBody "Mark all read" control shows a disabled affordance while pending; the ReportDetail notify bell, EventDetail roster expander, and LayersPopover category rows gain hitSlop for comfortable tap targets (the notify bell also dims while pending); and BringInput chips cap at the container width and ellipsize a long item so the remove (X) can't be pushed off-screen.

## 0.2.1

### Patch Changes

- 90504ee: Unify the detail-header back affordance + title across the compact sheet (`DetailBar`) and the landscape side panel (`PanelHeader`). They previously drew the same control two ways (32px/r16 muted-icon Bricolage-title panel vs 36px/r18 ink-icon Manrope-title sheet); a shared `detailHeader` module now sources the back geometry + the Manrope-Bold title style for both, so they can't drift. PanelHeader keeps its larger 18px title (desktop scale) and bordered back chip.

## 0.2.0

### Minor Changes

- 20e81f8: UI refinement + image-load resilience pass.

  - Report media and avatars now fall back gracefully when an image fails to load: MediaPreview renders a labeled "Image/Video unavailable" placeholder (new `ImageOff` glyph) on an image OR video `onError`; Avatar falls back to its monogram on a broken `photoUrl` (a stable wrapper View so react-native-web reliably fires `onError`), tracking the failed URL so a recycled row retries.
  - The report wizard ("drop") no longer draws a duplicate panel header + a Back that conflicts with its own ProgressRail/footer Back.
  - The landscape/desktop map top bar gains the Locate/recenter control that was portrait-only. `MiniMap` gains an optional `aspectRatio` so the report-detail hero keeps a consistent height whether the report has media (16:10) or falls back to the location map.
  - Removed the misleading "My events" profile nav row (it opened the generic all-events list; the viewer's own events are already shown inline); past-event rows are now tappable like upcoming ones.
  - Organizer avatars now pass `photoUrl`; the RSVP auth gate returns to the event (not home); the home feed gains loading + error states; report/cluster rows announce the human status label (not the raw enum); the dead voice-search Mic glyph is dropped; the messaging inbox shows a paginating footer spinner.
  - Polish: DateBadge weekday color (sun-700), PersonDetail gutter token, and the web LocationPicker hint reads "move the pin" once a pin is placed.

## 0.1.5

### Patch Changes

- 190e95c: Add the shared "About civfix" card (`BrandAboutCard`) - the mission modal opened from the civfix logo pill on the map (the per-letter wordmark, the 501(c)(3) credit eyebrow, the mission lede, a Donate CTA via the `openExternal` capability, and a close), ported out of the mobile-only about screen so the SAME card renders on web (react-native-web) and native. Wires the logo pill (MapControls) + the about open-state (nav store) and maps the Heart + ArrowRight icons.

## 0.1.4

### Patch Changes

- 14f52c1: Map: cluster reports CLIENT-SIDE (supercluster) instead of relying on the server's per-zoom cluster/pin split. Isolated reports now show their category icon even when zoomed out (only genuinely dense areas collapse into a count bubble), zoom/merge is smooth because the Map reclusters locally with no per-zoom network refetch, and tapping a count bubble opens a list of the reports it encloses (each row opens that report's detail) via the new `cluster` detail kind + `ClusterReportsBody`. MapProps change: `reports` is now ALL raw region points (the Map clusters them); the `clusters` prop is removed; new `onPressCluster(reports)` callback.

## 0.1.3

### Patch Changes

- 3f49bf8: Map: report markers now render the report-type category icon and are tappable to open the report detail at normal browse zoom, instead of an untappable count bubble. The Map seam now reports its live zoom via `onRegionChange(bbox, zoom)` so the host can forward the real zoom to `/map/reports`; the server returns individual category pins at/above the cluster threshold (the apps previously sent a fixed zoom below the threshold, collapsing every report into a count cluster).

## 0.1.2

### Patch Changes

- cf40891: fix(ui): sanitize list hooks against drifted/unvalidated responses

  The API client does not runtime-validate responses (`return data as Res`), so a backend whose list envelope drifted (e.g. an older deploy whose `/threads` lacks an `items` array, or null entries) reached the bodies as `undefined`/`null` items and crashed the home (`Cannot read properties of undefined (reading 'unread')` / `(reading 'id')`, depending on render order). `useThreads`, `useMyReports`, `useNearbyCleanups`, and `useFeedNotifications` now coerce every response to a real array of non-null items at the data boundary, so a drifted list degrades to an empty section instead of white-screening the whole app.

## 0.1.1

### Patch Changes

- 998c09a: fix(ui): guard cleanup list rows against a missing `organizer`

  `CleanupRow` (HomeSidebarBody) and `SuggestedRow` (FeedBody) read `cleanup.organizer.id`/`.name`. Because the `@civfix/shared` API client does not runtime-validate responses (it returns `data as Res`), a cleanup served without its contractually-required `organizer` arrives as `undefined` and crashed the home with `Cannot read properties of undefined (reading 'id')` — and ONLY when signed in, since `!!user && user.id === cleanup.organizer.id` short-circuits for anonymous viewers. Both list rows now fall back to a neutral host instead of white-screening.

- 92bc929: fix(ui): restore the signed-out "Sign in" button in the map controls

  The unified `MapControls` `ProfileEntry` rendered the profile avatar in every auth state, so a signed-out viewer saw an avatar that read as already-signed-in and only led to the profile view's gate — the original web TopBar's dedicated "Sign in" button (`.signin-btn`) was lost in the unification. Signed out now renders a "Sign in" pill that opens auth (web modal / native auth route); signed in keeps the avatar that opens the profile view.

## 0.1.0

### Minor Changes

- a05e06a: Initial release of @civfix/ui: the shared React Native UI for the civfix community clients, authored
  once in RN primitives and rendered on web via react-native-web. Ships .tsx source (theme, typography,
  surface, capabilities, data, nav, shell, primitives, bodies, map) and emits type declarations only.
  Consumed by civfix-web (Next.js + RNW) and civfix-mobile (Expo + Metro); the backend never depends on it.

### Patch Changes

- Updated dependencies [a05e06a]
  - @civfix/shared@0.4.0
