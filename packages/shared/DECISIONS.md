# Decisions

This file records the taxonomy and structural choices made while building `@civfix/shared`. They are
intended to be stable; changing them is a breaking change for consumers.

## 1. Canonical report category vs. cleanups

`ReportCategory` is the canonical, color-bearing category for a report pin and is exactly:

```
trash | recycling | graffiti | hazard | water | other
```

These map 1:1 to the pin/badge colors in `tokens.color.category`. `event` / cleanup is deliberately
NOT a report category. Cleanups are a separate entity with their own pin color
(`tokens.color.cleanup`, the sun-dark accent `#E5AE1C`).

## 2. Report status taxonomy

`ReportStatus` is:

```
submitted | held | published | acknowledged | in_progress | resolved | rejected
```

`held` is the abuse/triage hold state (also surfaced as the `ABUSE_HELD` error). Human labels live in
`REPORT_STATUS_LABELS`; `held` renders as "Under review".

## 3. WEB_REPORT_TYPES: reconciling the web design with the canonical taxonomy

The PinIt web design exposes finer-grained issue types than the mobile report flow. Rather than
expand the canonical category enum (which drives colors and is shared with mobile), each web issue
type is a separate, data-driven record in `WEB_REPORT_TYPES` that maps to one canonical category and
a default city agency. The finalized mapping is:

| id             | label                 | canonical category | gov name                           | gov email                 |
| -------------- | --------------------- | ------------------ | ---------------------------------- | ------------------------- |
| dump           | Illegal dumping       | trash              | LA Bureau of Sanitation            | sanitation@lacity.gov     |
| encampment     | Encampment            | hazard             | LA Bureau of Sanitation            | sanitation@lacity.gov     |
| graffiti       | Graffiti              | graffiti           | Office of Community Beautification | ocb@lacity.gov            |
| infrastructure | Broken infrastructure | hazard             | LA Bureau of Street Services       | streetservices@lacity.gov |
| pavement       | Pavement distress     | hazard             | LA Bureau of Street Services       | streetservices@lacity.gov |
| vegetation     | Overgrown vegetation  | other              | LA Bureau of Street Services       | streetservices@lacity.gov |
| water          | Water/leak            | water              | LADWP                              | customerservice@ladwp.com |
| recycling      | Recycling             | recycling          | LA Bureau of Sanitation            | sanitation@lacity.gov     |

The `gov` addresses are placeholder routing for Phase 1 and represent the Los Angeles default
fallback only. Real per-jurisdiction routing comes from the `jurisdictions` table resolved from a
pin's PostGIS-derived GEOID; when a jurisdiction has no saved contact, a discovery task is queued.
`WEB_REPORT_TYPES` is the single source of truth and is exposed as an array plus a derived lookup
(`WEB_REPORT_TYPE_BY_ID`) and a helper (`webReportTypeToCategory`) so it is easy to extend.

## 4. Breaking the entity import cycle: schemas/entities.ts

`PersonDTO` is used by `cleanups` (organizer) and `chat` (message author); `CleanupDTO` is used by
`social` (`UserProfileDTO.pastEvents`). A naive layout produces a cycle
`social -> cleanups -> social` plus `chat -> social` and `reports -> media`.

Decision: define every cross-domain entity DTO (`PersonDTO`, `MediaDTO`, the report DTOs,
`CleanupDTO`, `ChatMessageDTO`, and their small sub-enums) in `src/schemas/entities.ts`. The domain
files import from `entities` and re-export the relevant entity so a consumer can still import, for
example, `CleanupDTOSchema` from the cleanups module. This removes all import cycles between domain
files while keeping the public naming intact.

## 5. ISODate as a coercing transform

`ISODateSchema` is `z.coerce.date().transform((d) => d.toISOString())`. It accepts Date objects and
ISO strings on input and always yields an ISO-8601 string. This keeps server ergonomics (pass a Date)
while guaranteeing a string on the wire. The exported `ISODate` type is `string`.

## 6. Media size limits via superRefine

A single `CreateMediaUploadRequest` covers both image and video. The outer `byteSize` bound is the
larger video limit (50 MB), and a `superRefine` enforces the tighter 15 MB limit when
`kind === "image"`. Constants `MAX_IMAGE_BYTES` and `MAX_VIDEO_BYTES` are exported.

## 7. Error code to HTTP status mapping

`ERROR_HTTP_STATUS` maps every `ErrorCode`. Two non-obvious choices:

- `IDEMPOTENT_REPLAY` maps to 200. A replay means the original effect already happened, so the API
  returns the original result rather than an error status.
- `ABUSE_HELD` maps to 202 (Accepted). The submission was accepted but is held for review rather than
  published immediately.

`AppError` carries `httpStatus` so the backend can render it directly, and it is dependency-free so
it can also be thrown and caught on the client. `AppError.toJSON()` matches `AppErrorSchema`.

## 8. Path params with a null request body

Several endpoints (for example `GET /reports/:id`, `POST /reports/:id/follow`) declare
`request: null` yet carry a path param. The generated client method for these accepts a typed params
object derived from the path literal (`PathParams<P>`), so callers pass `{ id }` directly.

One endpoint, `GET /anon/reports/:id/status`, uses the path param name `:id` while its request DTO
carries the field `reportId`. The client tolerates this by matching a single `*Id`-suffixed field
when an exact `:id` key is absent. This keeps the spec's path and DTO shapes unchanged.

## 9. Build module settings

`tsconfig` uses `moduleResolution: Bundler` with `module: ESNext`, which keeps both tsup and vitest
happy without requiring explicit `.js` specifiers to be re-mapped. Source files still use explicit
`.js` import specifiers so the emitted ESM is spec-correct for Node and Metro. `@types/node` is a
dev-only dependency (needed for `Buffer`/`Uint8Array` in interface signatures and the tsup config);
it does not add a runtime dependency.

## 10. Deterministic ids in fakes

Fakes avoid `crypto.randomUUID()` (not guaranteed on every React Native engine) and instead use a
small seeded `makeIdFactory` that emits valid-looking v4 UUID strings. This keeps fakes
dependency-free and their output stable across runs and platforms.

## 11. Additive contract refinement (account email, missing enums, map cleanups, raster fallback)

This round of changes is intentionally ADDITIVE and BACKWARD COMPATIBLE: every newly added response
field is optional, nullable, or defaulted so a consumer built against the prior contract still parses
current payloads, and so a server that does not yet populate a field is still valid.

New standalone enums (each exports `XxxSchema` + the inferred type, mirroring the existing enum style)
live in `schemas/common.ts`:

- `PushPlatformSchema = ios | android | web`. `RegisterPushTokenRequest.platform` now REFERENCES this
  enum instead of an inline `z.enum`, so the push-platform vocabulary has a single source of truth.
- `OAuthProviderSchema = apple | google | email`. "email" is the OTP flow; "apple"/"google" are OAuth
  identity links. Used by `SessionCheckResponse.enabledProviders`.
- `CleanupMemberRoleSchema = organizer | member` (per-cleanup membership role).
- `AbuseSubjectTypeSchema = report | media | user | anon_token`.
- `AbuseReasonSchema = nsfw | phash_dup | honeypot | gps | manual | other`.
- `AbuseSourceSchema = worker | api | user_report`.
- `DiscoveryStatusSchema = open | in_progress | done`.

These mirror existing backend DB columns (oauth_identities.provider, cleanup_members.role,
abuse_flags.subject_type/reason/source, jurisdiction_discovery_tasks.status, push_tokens.platform);
the backend keeps its own value-tuple mirrors in `db/schema/types.ts` (the DB layer must stay free of
the Zod runtime) and a drift test asserts the two stay byte-for-byte identical.

Refined DTOs / responses:

- `UserDTO.email`: `z.string().email().nullable().optional()`. Account email for display. Nullable for
  accounts without one (Apple private relay omitted) and optional for backward compatibility.
  `SessionResponse` / `SessionCheckResponse` continue to compose over `UserDTO` unchanged.
- `SessionCheckResponse.enabledProviders`: `z.array(OAuthProviderSchema).optional()`, so the web can
  render only the sign-in buttons the server has configured.
- `CleanupDTO.address`: `z.string().nullable().default(null)`. A human-readable location for the web
  events list; the existing lat/lng + dist remain for the map and distance sorting. Defaulting to null
  keeps payloads that omit it valid.
- `MessageThreadDTO.lastFromMe`: `z.boolean().optional().default(false)`, driving the "You:" prefix in
  the web messages list.
- `ReportClusterResponse.counts`: `z.record(ReportCategorySchema, z.number()).optional()` -- a typed
  PARTIAL record (a category may be absent) of per-category pin counts for the reports filter popover.
- `TileInfoResponse.rasterUrl` / `TileInfoResponse.styleUrl`: both `z.string().nullable().optional()`.
  A server may hand a raster XYZ tile template or a full style-JSON URL as a fallback to pmtiles;
  `pmtilesUrl` stays required and primary.

New map-cleanups endpoint (lightweight pins for the map view; the full `CleanupDTO` still lives in
`entities.ts`): `CleanupPinDTO {id, lat, lng, scheduledAt, going}`, `ListCleanupsInBBoxRequest {bbox,
when?}`, and `MapCleanupsResponse {pins}` in `schemas/map.ts`, registered as
`GET /map/cleanups | ListCleanupsInBBoxRequest(query) | MapCleanupsResponse | optional | csrf:false`.
This brings the endpoint registry to 43 operations.

## 12. Additive contract refinement (session CSRF recovery, profile avatar, cleanup address)

Another ADDITIVE, BACKWARD COMPATIBLE round: every newly added field is optional, so a consumer built
against the prior contract still parses current payloads and a server that omits a field stays valid.

- `SessionCheckResponse.csrfToken`: `z.string().optional()`. The web SPA must recover the CSRF token
  after a page reload or an OAuth redirect, when only `GET /auth/session` runs. `SessionResponse`
  already carries `csrfToken` for the direct sign-in paths (Apple/Google/email OTP), but the
  session-check response did not, so the SPA had no way to re-obtain it without a fresh sign-in.
  Optional for backward compatibility.
- `UserProfileDTO.avatar`: `z.tuple([z.string(), z.string()]).nullable().optional()`, the same
  `[from, to]` initials-gradient hex pair as `PersonDTO.avatar`, so profile views render the same
  gradient avatar as the people list cards. Nullable/optional for backward compatibility.
- `CreateCleanupRequest.address`: `z.string().max(200).optional()`, the host "name the spot" line.
  It is stored and echoed back as `CleanupDTO.address` (already `z.string().nullable().default(null)`,
  added in section 11). `CreateCleanupRequest` stays `.strict()`, so the field is declared inside the
  object before `.strict()` and any other unknown key is still rejected. Optional so the existing
  create flow that does not send it still parses.

## 13. Cross-repo consolidation: framework-neutral derivations move into shared

This round pulls the genuinely-duplicated, framework-neutral logic out of the three consumer repos and
into shared (zod-only; no react/react-native/fastify/node imports), fixes a client query bug, tightens
internal DRY, and adds a substantial vitest suite. New modules are exported BOTH from the root barrel
(`@civfix/shared`) and as subpath exports (`./avatar`, `./datetime`, `./chat`, `./ws`); `package.json`
`exports` + the tsup entries were extended to match.

- `src/avatar.ts`: the deterministic `avatarGradient(seed) -> [from, to]`, `stableHash`, the
  `AVATAR_PALETTE`, and a `resolveAvatarGradient(avatar, seed)` fallback helper. The algorithm is the
  canonical brand-palette one moved VERBATIM from the backend social service (FNV-1a hash + co-prime
  stride), so output is byte-for-byte identical and existing rendered gradients do not shift. The
  palette is DERIVED from `tokens.color.brand` (bloom/moss/sun/sky/lilac; `sunDark` excluded) instead of
  re-copied hex literals, closing the one unguarded token duplication in the codebase. This is now the
  single source the server and both clients share, so they agree by construction.
- `src/datetime.ts`: `relativeAgo(date, now?, opts?)` reconciles the three former impls (backend
  threads, web, mobile) into one. Thresholds: future / `<60s` -> "now"; `<60m` -> "Nm"; `<24h` -> "Nh";
  `<7d` -> "Nd"; `>=7d` -> "Nw" by default OR an absolute date when an `absoluteFallback` formatter is
  supplied. "now" wins over the backend's "just now" (overridable via `opts.justNow`). The core has no
  Intl dependency so it runs on any RN engine; callers inject the absolute formatter. `now` is injectable
  for deterministic tests.
- `src/chat/merge.ts`: a pure SUPERSET of the web `chat-merge.ts` and the mobile inlined merge. Exports
  `mergeChatItems`, `reconcileInbound`, `effectiveClientId`, `isMine`, `reconciledByContent`, and
  `OUTBOX_MATCH_WINDOW_MS` (60s). Dedupes confirmed messages by id (last writer wins), drops an optimistic
  outbox bubble on a clientId match, AND clears a bubble whose server echo dropped clientId via
  content-reconcile (same author + trimmed body + createdAt within the window, each confirmed message
  consumed once). Sorts ascending by createdAt with an id tiebreak.
- `src/ws/backoff.ts`: `nextBackoffMs(attempt, opts?)` - exponential backoff with FULL jitter (default
  base 1000, cap 15000), with an injectable `jitter` for deterministic tests. Only this pure helper
  moves; each client keeps its own socket lifecycle / URL / auth / app-state handling.
- `REPORT_CATEGORY_LABELS` added to `schemas/common.ts` beside `REPORT_STATUS_LABELS` (a
  `Record<ReportCategory, string>` of the human labels both clients previously hardcoded). Clients keep
  their platform-specific icons/colors; only the label text is shared.
- `MessageThreadDTO.refId`: `z.string().nullable().optional()`, the room/cleanup id a thread maps to, so
  clients need not assume `thread.id === cleanupId`. Additive / backward-compatible.

Internal DRY (no wire-shape change; all exported names kept stable):
- `LatLngFields` (raw `{ lat, lng }` field defs with the canonical bounds) is defined once in
  `common.ts` and spread into the DTOs/requests that carry a FLAT position (ReportDTO, ReportPinDTO,
  CleanupDTO, ReportClusterDTO, CleanupPinDTO, CreateReportRequest, CreateCleanupRequest) instead of
  re-inlining the `z.number().min(-90)...` pairs. `LatLngSchema` is built from the same fields.
- `UserProfileDTOSchema` is now `PersonDTOSchema.extend({ pastEvents, stats })` rather than a rewritten
  object literal, so the shared 8-field core cannot drift.
- `AvatarPairSchema` is the single avatar tuple fragment reused by PersonDTO + (via the extend)
  UserProfileDTO.
- `JoinCleanupResponseSchema` / `LeaveCleanupResponseSchema` are two aliases of one
  `CleanupMembershipResponseSchema` (they were byte-identical).
- `ListPeopleRequestSchema` is `PaginationQuerySchema.extend({ q })` instead of re-inlining cursor/limit.

Client GET path-param fix (`src/client/client.ts`): the GET branch previously serialized the ENTIRE
typed input as the query while ALSO extracting path params, so e.g. `GET /cleanups/:id/messages` sent
`?cleanupId=...` duplicating the path segment (the `:id` value is read from `cleanupId` via the `*Id`
tolerance). `extractParams` now also returns the set of INPUT keys it consumed for the path, and the GET
query is built from the input MINUS those keys (`buildQuery(input, consumedKeys)`). Non-GET bodies are
unchanged. The array-repeat and object-JSON-encode query conventions are preserved. `fillPath`,
`buildQuery`, `extractParams`, and `parseError` are now exported so the pure logic is unit-tested
directly.

Tests: a first-party vitest suite (the package previously shipped none of its own beyond a thin set)
covering the client helpers + the GET exclusion, the avatar/datetime/chat/ws modules, the new schema
fields, and extra fakes paging/hash/id math - 165 tests total, all green.

Realtime chat Phase 2 (typing + live presence). Additive, backward-compatible WS contract growth:
- `WsServerMessageSchema` gains two server->client variants alongside the existing `presence` delta:
  `{type:"typing", cleanupId, userId}` (a member is typing; broadcast to the OTHER members, sender
  excluded; ephemeral, never persisted) and `{type:"presence_snapshot", cleanupId, userIds}` (the full
  de-duplicated set of currently-online member ids, sent to a socket right after it joins so it can show
  an accurate "N online" without accumulating deltas). The pre-existing `presence` delta is now actually
  broadcast room-wide (previously delivered only to the joiner). Discriminated-union ADDITIONS only, so a
  client built against the prior contract drops the new frames (its WsServerMessageSchema.safeParse fails
  closed) rather than crashing. The CLIENT frame union is unchanged - typing/ack already existed; mark-read
  reuses the existing `{type:"ack", upToId}` client frame.
- `ChatService` gains an OPTIONAL `broadcastEvent(cleanupId, frame, opts?)` that fans an ephemeral,
  un-persisted `WsServerMessage` (presence/typing) to a room's live sockets across workers, optionally
  excluding the originating connection. Optional so test doubles / minimal implementers need not provide
  it; the WS+Redis adapter and the in-process Fake both implement it. The persisted message stream stays
  on `broadcast` (carries a ChatMessageDTO); presence/typing never touch persistence or history.
- Read state: the unread watermark is now persisted to `cleanup_members.last_read_at` (a backend
  migration; no shared shape change) and clients drive it by sending the existing `ack` frame when a
  conversation is viewed, so unread counts decrement on read and survive a server restart.

Direct messages (1:1) + username search + DM privacy. Additive, backward-compatible contract growth so
the cleanup *group* chat surface is untouched and pre-DM clients keep parsing:

- **Room model on the WS frames.** Every frame still addresses a room by `cleanupId` (a bare UUID) plus
  a NEW optional `roomKind: "cleanup" | "dm"` (`RoomKindSchema`). Absent ⇒ `"cleanup"`, so clients/
  servers built against the pre-DM contract address group chat exactly as before. A DM thread's id
  occupies `cleanupId` (still a UUID, so `IdSchema` holds); the gateway maps `(roomKind, cleanupId)`
  onto its internal room key (cleanup ids stay bare; dm ids are namespaced `dm:<id>` server-side, so the
  Redis channel/presence keys don't collide). `roomKind` was added to the client `join/leave/send/typing`
  frames and the server `presence/presence_snapshot/typing` frames; `ChatMessageDTO` gained an optional
  `roomKind` so `message`/`ack` frames are self-describing.
- **Room-scoped `ack`.** The client `ack` frame gained optional `cleanupId` + `roomKind` so a socket
  joined to BOTH a cleanup and a DM thread marks the right room read. Absent ⇒ the gateway falls back to
  the socket's first joined room (legacy single-room behavior); old clients are unaffected.
- **`MessageThreadDTO.peer`** (`PersonDTO.nullable().optional()`): for a `kind:"dm"` thread, the other
  participant, so the inbox renders their `@handle` + avatar without a second fetch. Null/omitted for
  cleanup/group threads. `kind:"dm"` + `refId` already existed (the contract was pre-shaped for DMs).
- **Username search, NOT a directory dump.** `SearchUsersRequest` REQUIRES a non-empty `q` (a leading
  `@` is stripped server-side) — there is deliberately no list-everyone form. `searchUsers` (GET
  `/users/search`) is auth-required and returns `UserSearchResultDTO` — a minimal `{id, handle,
  displayName, avatar, avatarUrl?}` with NO email/bio/follower counts and a non-null handle. `listPeople`
  (GET `/people`) was tightened to `auth: "required"` and its `q` is required server-side, killing
  anonymous enumeration of the user base.
- **DM endpoints.** `openDm` (POST `/dm`, csrf) is idempotent — a thread is unique per unordered user
  pair, so it returns the same `MessageThreadDTO` on replay; it rejects with `FORBIDDEN` (403) when the
  target disabled DMs (and no thread exists yet) OR either party blocked the other — deliberately
  indistinguishable so neither state leaks. `dmMessages` (GET `/dm/:id/messages`, `:id` ← `threadId`)
  mirrors `cleanupMessages` and reuses `ChatHistoryResponse`. DM *send* reuses the WS `send` frame with
  `roomKind:"dm"`; no new WS frame types.
- **Privacy/settings.** `UserDTO` gained optional `allowDirectMessages` (read on the settings screen;
  absent ⇒ true). `updateSettings` (PUT `/me/settings`, csrf) is a strict partial. Disabling DMs hides
  the user from search AND rejects new `openDm` toward them, but existing threads keep working.
- **Blocking.** `blockUser`/`unblockUser` (POST/DELETE `/users/:id/block`, csrf) + `listBlocks` (GET
  `/me/blocks`). Blocking hides the DM thread for both sides and rejects sends, so a user can stop an
  existing conversation. Block vs DM-disabled both surface as `FORBIDDEN` (no leak). No new `ErrorCode` —
  `FORBIDDEN`/`NOT_FOUND` cover every DM failure.
- **Seam.** `PersistChatInput` gained an optional `roomKind` that rides onto the persisted DTO so the
  in-process fake (USE_FAKE_CHAT dev path) renders DMs too. The `ChatService` interface methods are
  otherwise unchanged — DM fan-out reuses the opaque-keyed `joinRoom/leaveRoom/broadcast/broadcastEvent`
  with a `dm:<id>` room key; DM persistence/history are routed to a DB-backed dm repository in the
  backend (not a new shared seam).

## 14. The reviewer OTP bypass is part of the contract, not a backend-only secret

The app-store / procurement reviewer sign-in bypass (a fixed account plus a long, deployment-supplied
secret code accepted in place of an emailed OTP) is a cross-plane flow: the backend decides whether the
bypass is active, but the CLIENTS have to be able to SEND the code, and the shared request schema is
what gates that. Two decisions follow.

- `EmailOtpVerifyRequest.code` is a UNION: `/^\d{6}$/` (the emailed OTP) OR a string of
  `REVIEWER_OTP_CODE_MIN_LENGTH`..`REVIEWER_OTP_CODE_MAX_LENGTH` characters (20..128, the reviewer
  code). The former sole 6-digit regex made the bypass unreachable — the backend validates the body
  with this schema BEFORE the service that owns the bypass decision, so a valid reviewer code was
  rejected at the boundary and `verifyOtp` never saw it. Widening an accepted input set is additive and
  backward compatible: every payload valid under the old schema is still valid, no response shape
  changes, and the schema stays `.strict()` so unknown keys are still rejected. The schema deliberately
  does NOT try to enforce "long code only for the reviewer email" — authorization is the server's job
  (the code is compared only for `REVIEWER_OTP_EMAIL`, only when the deployment enabled the bypass, and
  the comparison is the only thing that can mint a session), and encoding it here would leak an
  auth rule into a client-side validator that clients can skip anyway.
- `REVIEWER_OTP_EMAIL = "reviewer@civfix.org"` and the two length bounds are exported from
  `schemas/auth.ts` (the auth domain owns them, alongside the schema that uses the bounds — the same
  placement as `MAX_IMAGE_BYTES` in `schemas/media.ts`). Clients need the address to branch their code
  entry UI onto a plain long-code field instead of a 6-digit segmented input; the backend currently
  keeps its own copy (`services/api/src/auth/otp.ts`) and should collapse onto this one so the address
  cannot drift between the plane that accepts the code and the plane that renders the field.
  `REVIEWER_OTP_CODE_MIN_LENGTH` is the same 20-character secret-material floor the backend enforces in
  `env.ts`; the max exists only to bound the request body.

## 15. Removing a public read surface: the per-user activity stream

`GET /people/:id/activity` and its schemas are GONE, on privacy grounds, at the product owner's
explicit direction. The endpoint MERGED a named person's public actions into one chronological,
cursor-paginated, auth-OPTIONAL stream keyed by user id or `@handle`. The server produced four kinds:
`created_report`, `hosted_event`, `attended_event`, `followed_user`. (The enum also carried
`commented_event`, but its repository leg had already been removed so a cleanup/group-chat message
could never surface as activity — a dead value at the time of removal.)

Every individual row was already public somewhere else, but the MERGE was not: it turned scattered,
individually-innocuous records into a per-person behavioral timeline that anyone — signed out — could
page through and archive. That is a profiling surface rather than a civic-record surface, and the
aggregate is the thing this decision refuses.

The removed exports are `UserActivityKindSchema`/`UserActivityKind`,
`UserActivityItemDTOSchema`/`UserActivityItemDTO`, `UserActivityListQuerySchema`/`UserActivityListQuery`,
`UserActivityListResponseSchema`/`UserActivityListResponse`, and the `listUserActivity` endpoint (with
its generated client method). This is a BREAKING contract change; on 0.x it ships as a minor bump, and
every consumer adopts the new range with its own references already removed.

Scope, stated precisely so nobody reads more into this than was delivered: what is gone is the
CROSS-DOMAIN MERGE, not each contributing surface. `getProfile` is still `auth:"optional"` and still
returns a bounded `pastEvents` list; `listFollowers`/`listFollowing` are still `auth:"optional"` and
cursor-paginated; `listUserPosts` is still `auth:"optional"` and is itself a chronological personal
stream. Those predate this change and are unaffected by it. Narrowing or gating any of them is a
separate decision that has not been made here.

No data was deleted and no migration was written: the stream was a read-model UNION over tables
(reports, cleanups, follows) that other features own and keep using. Removing the read surface is the
whole change — there is nothing to un-persist because the aggregate was never stored.

The precedent this sets: a derived AGGREGATE of public rows is its own privacy decision, judged on the
aggregate's own merits, and is not automatically justified by each row being public. Anything that
re-proposes a per-person timeline (or a "recent activity" panel assembled client-side out of several
public lists) needs a fresh compliance decision, not a pointer to this endpoint's old existence.

## 16. Wave A additive refinement (0.36.0)

Another ADDITIVE, BACKWARD COMPATIBLE round: every new response field is optional/nullable, every new
request is a widening or a bound on an input no shipped client violates, and every new interface param
is optional so existing implementers keep compiling. Nothing here is a shape change on the response side.

- **Quiet-hours `tz` (`QuietHoursSchema.tz`)**: `z.string().min(1).max(64).nullable().optional()`. An IANA
  zone name (e.g. `America/Los_Angeles`); the server evaluates the quiet-hours window in this zone. When
  null or absent, quiet-hours suppression is DISABLED (fail-open) rather than evaluated in UTC — an
  absent zone must never silently mute at the wrong wall-clock time. It MUST stay optional:
  `UpdateNotificationPrefsRequestSchema` is `NotificationPrefsDTOSchema.partial().strict()`, and
  `.partial()` is shallow — the nested `quietHours` object is validated in full on ingress, so a required
  `tz` would 422 every existing prefs PATCH.

- **`AbuseChecks.verifyTurnstile` expectation param**: the signature gains a third optional
  `expect?: { action?: string }` so a caller can bind a Turnstile challenge to the action it was minted
  for. Soft-enforce rollout: an absent `action` passes during the transition (behavior unchanged), so
  2-arg implementers keep compiling by TS arity rules and no shipped caller breaks. The Fake records the
  last `expect` it received so tests can assert propagation; its verdict is unchanged.

- **`POST /push/unregister` (`pushUnregister` + `UnregisterPushTokenRequest`)**: client-driven push-token
  revocation — `{ platform, token }`, `.strict()`, `token` bounded `1..2048`, reusing
  `RegisterPushTokenResponseSchema` (do not invent a response shape). It is DECOUPLED from logout: the
  server-side logout backstop that revoked tokens is dropped, so `logout` stays `request: null`. The
  request body is required; there is no body-less tolerance (that concern only applied to the dropped
  backstop).

- **Blocks pagination (`listBlocks` + `ListBlocksResponse.nextCursor`)**: `GET /me/blocks` now takes the
  same `PaginationQuerySchema` cursor/limit query as the other cursor-paginated GETs (`listNotifications`,
  `listPeople`), and the response gains `nextCursor: z.string().nullable().optional()`. Both are additive:
  an old client's bare GET still validates (query fields optional) and ignores `nextCursor`, seeing page
  one — identical behavior for block lists under the page size.

- **`MailMessageDTO.truncated`**: `z.boolean().optional()`. `MailMessageDTOSchema` is `.strict()`, so
  without a declared field the backend cannot signal that it truncated a long mail body. Optional so
  older payloads stay valid.

- **Input tightenings (no shipped client violates them)**: the WS client `send` frame `clientId` is bounded
  `1..64` (producers emit ≤36-char ids — `packages/ui/src/data/hooks/chat.ts` `newClientId()`); RESPONSE /
  server-ack `clientId` fields are deliberately NOT touched (tightening a payload a new client must parse
  from an old server would break it). `RegisterPushTokenRequest.token` (and the new unregister twin) is
  bounded `1..2048` (Expo device tokens ~40 chars). `EventHoursEntry.hours` gains a `MIN_EVENT_HOURS`
  (0.01) floor exported beside `MAX_EVENT_HOURS`; no `.multipleOf(0.01)` (float-equality hazard) — 2-dp
  rounding stays a backend concern. Anon `AnonReportRequest.mediaUploadIds` is capped at `.max(5)`,
  aligning with the authed `CreateReportRequest` twin.

## 17. A state-changing endpoint may not be a GET: `claimNudge` becomes POST (0.37.0)

`claimNudge` was registered as `GET /claim/nudge` with `request: null`, and the caller passed its
`anonToken` as a query param. Since the claim-code hashing fix the handler is a MUTATION — it mints
and rotates the pending claim code — so the GET registration was two defects at once, and the method
is the fix for both.

- **CSRF via top-level navigation.** The anonymous session rides on the `civfix_anon` cookie, which is
  `SameSite=Lax`. Lax withholds the cookie from cross-site subrequests but SENDS it on a cross-site
  top-level GET navigation, so any page could point a browser at `/v1/claim/nudge` and rotate a
  victim's pending claim code. `SameSite=Lax` does NOT send the cookie on a cross-site POST, so moving
  the endpoint to POST closes the vector by construction.
- **Secret in the URL.** The mobile client has no anon cookie and passed `?anonToken=...` instead,
  putting a bearer-equivalent secret into request URLs — the one part of a request that edge proxies,
  access logs, and `Referer` headers all retain. A body keeps it out of all three.

The registry row is now `POST /claim/nudge | ClaimNudgeRequest(body) | ClaimNudgeResponse | optional |
csrf:false`, and `ClaimNudgeRequestSchema` is `z.object({ anonToken: z.string().optional() }).strict()`
— the exact shape (and optionality) the backend's route-local query schema already validated, so only
the transport moves. `anonToken` stays optional because the cookie is still the primary carrier; the
field exists for the cookie-less mobile caller.

`csrf` stays `false` deliberately. CSRF tokens are a cookie-session defense minted for a signed-in
session; the nudge is `auth: "optional"` and its whole point is to serve a logged-OUT anonymous
reporter who has no session and therefore no token to send. Requiring one would break the only flow
the endpoint exists for while adding nothing POST has not already denied the cross-site attacker.

This is BREAKING (a method change; the generated client method goes from `api.claimNudge()` to
`api.claimNudge({ anonToken? })` posting a body). On 0.x it ships as a minor bump, and the backend
adopts the new range together with its route change — the handler must read `request.body`, not
`request.query`. The precedent: an endpoint that mints, rotates, or invalidates a credential is a
mutation regardless of how read-shaped its response looks, and it is registered with a non-GET method
from the start.


## 18. Guest event attendance: guests are event-scoped contacts, never users (0.38.0)

An event host loses real-world turnout to the sign-up wall: a neighbor who will show up on Saturday
will not create an account to say so. Guest RSVP closes that gap WITHOUT minting a shadow user
directory, and the shape of the contract is what keeps that promise.

- **A guest is a row scoped to one event, not an identity.** `CleanupGuestDTO` carries a name, the
  channel they verified on, the contact string, and the join/cancel timestamps — and nothing else. There
  is no guest account, no cross-event identity, no handle, and no way to look a guest up by contact.
  The same person RSVPing to two events is two unrelated rows, deliberately: correlating them would
  build the person-level directory this design refuses. This mirrors the gov plane's deliberate absence
  of a `ResidentDTO`.
- **Contact is visible on exactly one read surface.** `getCleanupGuests` (`GET /cleanups/:id/guests`,
  `auth: "required"`) is the only endpoint that returns a guest's email or phone, and the server scopes
  it to the event's organizer and cohosts — the people who need to reach their own attendees. Contact
  never rides on `CleanupDTO`, never appears on the public attendee roster, and never reaches a plain
  member. `CleanupGuestDTO.email` / `.phone` are `nullable` (not optional) because they are NULLed in
  place on two separate triggers: the retention scrub ~30 days after the event's `scheduledAt` passes —
  or, for a cancelled event, ~30 days after the RSVP itself was made — AND
  immediately when the guest themselves cancels. A cancel is an explicit "stop contacting me", so it
  must not leave the host holding a working phone number for another month; the row survives as the
  record that someone RSVPd and withdrew, the means of contacting them does not. Every guest with a
  non-null `cancelledAt` therefore has null `email` and `phone`. A client must render a guest whose
  contact is already gone.
- **The roster is bounded.** `getCleanupGuests` takes `GetCleanupGuestsRequest`
  (`PaginationQuerySchema` + the event `id`) and its response carries
  `nextCursor: z.string().nullable().optional()` beside the full `count` — the same shape the blocks
  list took in section 16. An unbounded array is not acceptable for any list, and least of all for one
  carrying contact details for an event that may have drawn hundreds of guests. `count` spans ALL
  pages, so it equals `guests.length` only on a single-page roster.
- **There is ONE guest count, and it means "still coming".** `GetCleanupGuestsResponse.count` and
  `CleanupDTO.guestCount` both count ACTIVE guests (`cancelled_at IS NULL`) — deliberately the same
  number from two surfaces, so a client may use whichever it has without the header changing when a
  page loads. The ROWS are a superset: `getCleanupGuests` still returns cancelled guests (contact
  NULLed, `cancelledAt` set) because withdrawing is part of the record a host reads. So `count` is
  legitimately smaller than `guests.length` on a roster containing withdrawals, and a client must
  render the cancelled rows as withdrawn rather than as attendees. Counting all rows in one place and
  active guests in the other put a "3 guests" header directly above five rows.
- **`going` counts verified, non-cancelled guests.** `CleanupDTO.going` is the turnout number a host
  acts on, so a verified guest belongs in it; an unverified request and a cancelled guest do not.
  `CleanupDTO.guestCount` is added as `z.number().int().nonnegative().optional()` so a host UI can split
  "N going, of which M are guests" without a second call. Optional, so a server that does not populate it
  and a consumer built before it both stay valid.

  This is a SEMANTIC WIDENING of a field shipped clients already read, and it is the one part of this
  release that is not purely additive, so the rule is pinned here once and applies to every `going` in
  the contract — `CleanupDTO.going`, `CleanupAttendeesResponse.going`, `JoinCleanupResponse.going` /
  `LeaveCleanupResponse.going`, and `RemoveMemberResponse.going`: ALL of them count members plus
  verified, non-cancelled guests, and they must always agree with each other. The backend may not
  implement four different answers, and `CleanupAttendeesResponse.going` in particular stays exactly
  equal to `CleanupDTO.going` (its doc comment's promise) even though `attendees` lists only users. The
  consequence a client must handle: `going - attendees.length` is an overflow count that now includes
  guests, who have no roster row and never will — the same "+N others" overflow the scope-`following`
  roster already produces, so a client that renders the difference as a plain number stays correct,
  while one that assumes every counted attendee is fetchable does not.
- **Verification is what makes a guest real.** RSVP is two steps: `guestRsvpRequest` sends a code to the
  claimed contact, `guestRsvpVerify` redeems it and joins. Both are `auth: "public"` and `csrf: false` —
  CSRF tokens are a cookie-session defense and a guest has no session (the same reasoning as
  `claimNudge`, section 17). The anti-abuse controls are therefore carried in the body: a Turnstile token
  (bounded 1..2048) and a `website` honeypot typed `z.string().optional()` — accepted at the boundary
  and treated as an abuse signal server-side, exactly as `AnonReportRequest.honeypot` has always been.
  It is deliberately NOT `.max(0)`: a strict rejection returns an `AppError` whose `fields` names the
  offending key, teaching a bot in one request precisely which field to stop filling, and a honeypot
  that announces itself is not a honeypot. Accept-and-flag means a bot's request looks like it worked.
  Rate limiting per event and per contact is the server's job. `guestRsvpVerify.code` reuses the OTP
  union — a 6-digit code OR a `REVIEWER_OTP_CODE_MIN_LENGTH`..`MAX` string — so the app-store reviewer
  bypass (section 14) reaches the guest flow instead of dying at the boundary, exactly as it did for
  sign-in. That union is now `OtpCodeSchema`, exported once from `schemas/auth.ts` and shared by
  `EmailOtpVerifyRequest` and `GuestRsvpVerifyRequest`, so the two accepted code spaces cannot drift.
  The bypass is now reachable on a PUBLIC endpoint with a caller-supplied contact, so the backend MUST
  keep it gated on the deployment flag AND the reviewer contact specifically — otherwise any deployment
  with the flag on lets a caller attach an arbitrary phone number as a verified guest.
- **A rejected code says WHY in `fields`, not in the code.** Every `guestRsvpVerify` refusal of the code
  itself stays `UNAUTHORIZED` (a wrong code, an expired or absent one, and a spent attempt budget are
  indistinguishable to an attacker by status code). The client still has to tell "try again" from "start
  over", so the reason rides in `AppError.fields` under `GUEST_OTP_ERROR_FIELD` (`"otp"`) with a
  `GuestOtpErrorReason` value — `invalid_code`, `attempts_exhausted`, or `locked_out`. The first two are
  verdicts on the submitted code; `locked_out` is a THROTTLE (the per-IP verify fail window), which is why
  the UI renders it as "wait and retry" and offers no start-over — a fresh code from the same IP would
  still be unverifiable until the window passes. All constants are exported from
  the contract so backend and UI key on the same strings instead of inferring intent from an ErrorCode:
  the earlier UI read `RATE_LIMITED` for exhaustion, which the backend never emits, so the start-over
  state was dead and every real code failure rendered the generic error.
- **Cancelling is capability-based, not identity-based.** `guestRsvpVerify` returns a `manageToken`; a
  guest cancels with `guestRsvpCancel` (`POST /guest-rsvp/cancel`) by presenting it. The token is the
  ONLY thing that authorizes the cancel, so the endpoint takes no event id and no contact — it cannot be
  used to probe whether an address RSVPd to an event, and an unsubscribe link stays a single opaque
  URL. `GUEST_MANAGE_TOKEN_MIN_LENGTH` (20) is a secret-material floor, matching the reviewer-code
  floor, and `GuestRsvpVerifyResponse.manageToken` carries the SAME bounds as the cancel request, so a
  server cannot mint a token its own cancel endpoint would reject.
- **Channel and contact are exclusive, enforced in the schema.** `GuestContactChannel` is `email | sms`,
  and both guest requests `superRefine` that the channel's own contact field is present AND the other is
  absent. Accepting both would leave the server choosing which channel a code went to, and would persist
  a second contact the guest never consented to being messaged on.

## 19. SMS is a seam, US-only, and its availability is advertised (0.38.0)

Outbound SMS is the eleventh seam: `SmsSender { send(to, body): Promise<SentSms> }` in
`interfaces/sms-sender.ts`, with `FakeSmsSender` beside the other fakes. It is deliberately the
narrowest interface in the set — one method, a destination, a body, and a returned provider id for
delivery correlation. No templates, no bulk send, no delivery-status callbacks: SMS is a per-provider
minefield of formats and every capability added here would have to be implemented by every future
adapter. The vendor SDK lives only in a backend adapter wired through `di.ts`, so the whole backend
still boots with zero credentials on the fake.

- **`to` is E.164 and, for now, US-only.** `GuestPhoneSchema` is `/^\+1[2-9]\d{9}$/`: a `+1` country
  code and an area code that cannot start with 0 or 1 (which are not assignable). This is a
  deliberately narrow validator, not an approximation of a general phone parser — every widening is a
  contract change made on purpose. Rejecting at the boundary matters because SMS costs money per
  message and international destinations cost multiples of a US one, so a malformed or premium-rate
  destination is a spend bug, not just a validation miss.
- **Cost control is server-side and is not negotiable by the client.** Per-event, per-contact and
  global send caps live in the backend; the contract carries no knob a client can raise. The request
  step returns `resendAfterSec` so a client renders an honest cooldown instead of hammering the
  endpoint.
- **Availability is advertised, not assumed.** A deployment may have no SMS provider configured, or may
  have hit its cap. `guestSmsEnabled: z.boolean().optional()` is added to BOTH `SessionResponse` and
  `SessionCheckResponse` so a client can hide the SMS channel instead of offering a button that always
  fails. `SessionCheckResponse` carries it because `GET /auth/session` is the surface a logged-OUT web
  visitor actually reaches — and a logged-out visitor is precisely who the guest flow exists for; the
  sign-in-only placement would advertise the capability to the one audience that does not need it.
  Optional on both, so a server that omits it and a consumer built before it stay valid; absent means
  "do not offer SMS".
- **An SMS refusal is recognised by the server naming `fields.channel`, never by the bare `CONFLICT`.**
  Both SMS refusals (`sms_unavailable`, `sms_opted_out`) are `CONFLICT` carrying `fields.channel`, and
  that field path is the ONLY unambiguous signal a client has: plain `CONFLICT` on the guest endpoints
  already means "this event is closed to new RSVPs". A client that read the bare code as an SMS refusal
  made a guest who picked SMS for a closed event lose their typed number, told them text messages were
  unavailable (false), hid the real reason, and failed them again on email. Widening that heuristic is
  not the fix — a refusal that needs signalling without a field path is a contract gap to close here.
- **The daily cap is one budget for every outbound guest text.** `SMS_DAILY_CAP` is reserved before the
  verification code, the RSVP confirmation, AND each fan-out recipient's text, on one counter. Metering
  only the OTP let anyone holding a few self-owned events turn the per-event fan-out throttle into
  unbounded spend. Every SMS path fails closed when the counter store is unreachable; the email lane is
  never affected by an exhausted SMS budget.

## 20. Profile events: past is strictly past, and upcoming is not a whereabouts feed (0.38.0)

`UserProfileDTO.pastEvents` was the profile's only event list and it was being read as "this person's
events", which is two different products with two different privacy answers.

- **`pastEvents` is strictly past** — events that have already happened. It is a civic record of what
  someone did, the same category of public fact as a published report.
- **`upcomingEvents`** (`z.array(CleanupDTOSchema).optional()`) is new and is scoped by viewer: for a
  PUBLIC viewer it carries only the events this person is HOSTING; for the profile owner viewing their
  own profile it carries hosting AND attending. Hosting is already public — an event page names its
  organizer and invites the neighborhood — so publishing it adds nothing. Attending is different: it is
  a statement of where a named person will physically be at a known future time, which is exactly the
  aggregate section 15 refused to build. The asymmetry is the whole decision; a future request to show
  attendance publicly needs a fresh compliance decision, not this field.
- **The past list paginates.** A long-tenured volunteer's history outgrows any bounded inline array, so
  `getProfileEvents` (`GET /people/:id/events`, `auth: "optional"`) pages it with the shared
  `PaginationQuerySchema` + `pageResponse(CleanupDTOSchema)` helpers rather than a bespoke shape, and
  `UserProfileDTO.pastEventsCursor` (`z.string().nullable().optional()`) hands the client the cursor to
  continue from the inline first page. `getProfileEvents` serves the PAST list only — it carries no
  window discriminator, because the upcoming list is viewer-scoped (see above) and bounded server-side
  rather than paged; adding a window param later is additive if that changes. Per the house rule the request carries NO default page size — the
  service owns it. `ProfileEventsRequest.id` is `z.string()`, not `IdSchema`, because the profile routes
  key on a uuid OR an `@handle` (matching `ConnectionsListQuery`); an `IdSchema` here would 422 every
  handle-addressed request.

Everything in sections 18-20 is additive in SHAPE: every new response field is optional or nullable, no
existing field changed shape, and the five new endpoints are new registry rows. The one behavioral
change is `going` including verified guests, pinned in section 18 — it needs no client edit to keep
parsing, but it does change what an already-deployed client's turnout number means.

OPEN COMPLIANCE ITEM, recorded here because the contract commits to it: guest RSVP is the first PII the
platform holds for people who are NOT users, and phone numbers are a PII class the platform has never
held at all. Two things must be settled before this ships, and neither is decided by this contract
change: (1) the SMS consent artifact — US SMS consent has to be evidenced, and `GuestRsvpRequest`
currently records no explicit opt-in and no disclosure version, so if consent must be auditable the
request grows those fields (additive; the schema is unshipped); (2) the ~30-day guest scrub is a NEW
retention TTL that does not yet exist in `civfix-backend/docs/retention-cleanup.md` and must land there
with the backend implementation.

## 21. Deleting a conversation hides it for one viewer only (0.39.0)

The inbox row's "Delete" is a per-viewer visibility change, not a delete. `toggleConversationHidden`
(PUT `/conversations/hidden`, auth required, csrf, `{ roomKind, roomId, hidden }`) records the caller's
own hide; the room, its messages and every other participant's inbox are untouched. This follows the
same rule as the rest of the chat surface — chat/DM deletes are tombstones, published civic content is
never cascaded away — and it is the only reading that stays honest when the other side is still typing
into a thread you "deleted".

- **Hidden is a WATERMARK, not a flag.** The server stores the instant of the hide and the threads list
  drops a room only while its latest activity is at or before that instant. A message that arrives after
  the hide resurfaces the thread, with NO write on the send path (nothing has to remember to clear a
  flag, and a fan-out to many hidden participants costs no extra writes).
- **The filter lives in SQL, inside each source's page query**, not in a pass over an assembled page.
  Every thread family (cleanup, dm, report, group) `LEFT JOIN`s `conversation_hides` on the viewer +
  room and keeps a row only when `hidden_at IS NULL OR <latest activity> > hidden_at`, so the `LIMIT`
  counts visible rows only. A page is exact: `listThreads` returns a full page whenever a full page of
  visible rooms exists, and `nextCursor` is never paired with a short or empty page — a client's
  `onEndReached` cannot stall on a window that happened to be all hidden. The comparison is a strict
  `>` against native `timestamptz`, so the microsecond-precision `hidden_at` is compared against the
  untruncated activity instant rather than a millisecond-rounded copy of it.
- **No DTO field.** `MessageThreadDTO` gains nothing: a hidden thread is simply absent from
  `listThreads`, so no client can accidentally render a "hidden" state, and un-hiding is available
  (`hidden: false`) without a second endpoint.

## 22. The dark color scheme is an additive mirror, and the map follows it (0.39.0)

`tokens.color` / `tokens.shadow` stay the LIGHT scheme and keep their exact values. `darkColor` /
`darkShadow` are additive siblings with an IDENTICAL key tree (asserted by
`__tests__/tokens-dark-scheme.test.ts`), reachable through `colorSchemes` / `shadowSchemes`. Nothing is
removed or re-valued, so every existing consumer that reads `tokens.color.*` is untouched.

- **The scheme is always an explicit argument, defaulting to light.** `categoryColor(category, scheme?)`
  and `cleanupColorFor(scheme)` resolve against `colorSchemes[scheme]`, with `scheme = "light"` as the
  default so an un-migrated caller keeps its current output. `@civfix/ui` resolves the scheme once in
  `ThemeProvider` and hands it down as `theme.scheme`.
- **The basemap follows the scheme.** The hardcoded CARTO raster is Voyager in light and Dark Matter in
  dark (`@civfix/ui` `rasterMapStyle(attribution, { scheme })`); there is still no `GET /map/tileinfo`
  call and the basemap still renders with the backend off. Because the ground moves with the scheme,
  on-map glyphs (pins, cluster bubbles, drop pin, badges) use the ACTIVE scheme's palette, and every
  category/cleanup fill must clear 3:1 against `basemapPaper(scheme)`.
- **On-accent contrast is a floor, not a taste call.** A scheme's on-accent foreground must clear 4.5:1
  against the accent fill it sits on. Dark's `onAccent` is therefore the dark paper (`#17130E` on
  `#F4796C` = 6.87:1), not white (2.69:1). New accent/foreground pairs are added to the dark-scheme
  contrast test, not eyeballed.

## 23. The host platform grows the event, it does not replace it (0.40.0)

An Eventbrite-class host toolset lands as SIBLING resources under `/cleanups/:id/...` plus
`/orgs/*`, `/pages/:slug`, `/me/hosted-events` and `/me/host-exports/*`. `cleanups` is not renamed
and `CleanupDTO` is not replaced: it GROWS by optional/nullable/defaulted fields (`endsAt`,
`timezone`, `visibility`, `coverUrl`, `galleryUrls`, `donationUrl`, `donationOrg`, `pageSlug`,
`registrationOpensAt`/`ClosesAt`, `organization`, `ticketTypes`, `registrationState`,
`myRegistration`, `myCapabilities`, the host counters). A pre-0.40.0 payload still parses and every
existing consumer is untouched.

- **Slug reads live on their own path, ids everywhere else.** A public `GET /orgs/:slug` beside
  `GET /orgs/:id/members` would be AMBIGUOUS AT RUNTIME, not rejected by the router: the registry
  already ships `/cleanups/:id` next to `/cleanups/:cleanupId/messages/:messageId`, `/dm/:id` next to
  `/dm/:threadId/...` and `/media/:id` next to `/media/:uploadId/finalize`, so differing param names
  at the same position are fine. The problem is the VALUE space - a slug and a uuid are both plain
  path segments, so one handler would have to guess which it was given, and a slug shaped like a uuid
  would resolve to the wrong organization. The two public organization reads are therefore
  `GET /orgs/by-slug/:slug` and `GET /orgs/by-slug/:slug/donate`; every other organization route is
  `/orgs/:id/...`. The signup page is its own public namespace, `GET /pages/:slug`.
- **`staff` is enum growth, deliberately.** `CleanupMemberRole` appends `staff` LAST (day-of helper:
  roster read + check-in, no guest contact, no answers, no analytics, no broadcast, no chat
  moderation). `parseResponse` never throws, so an older client degrades to "unknown role" rather
  than failing. The backend `CLEANUP_MEMBER_ROLE_VALUES` mirror must stay byte-identical.
- **Capabilities, not roles, are the contract.** `HostCapability` (18 values) is what routes check
  and what `CleanupDTO.myCapabilities` / `HostedEventDTO.myCapabilities` carry. A client renders an
  action from a capability it holds and must treat an UNKNOWN capability string as "no extra
  permission" - that is what lets the matrix change without a client release.
- **Pages are a validated jsonb document, not a child table.** `EventPageBlock` is a discriminated
  union of ten block kinds capped at 24 blocks; a page is edited and saved whole. Block text is the
  constrained markdown SUBSET parsed by `@civfix/shared/markdown` - no HTML crosses the wire, so
  there is nothing to sanitize on either client. That promise holds only because the BOUNDARY
  enforces it: every URL a block carries (`hero.imageUrl`, `hosts[].avatarUrl`, `sponsors[].logoUrl`
  via `PageImageUrlSchema`; `donate.url` and `sponsors[].url` via `SafeHttpsLinkSchema`) goes through
  the one safe-URL predicate in `src/markdown/safe-url.ts` - https only, no userinfo, no IP literal,
  no punycode host - and `contact.replyTo` is an email address, not a string. The client-side href
  gates stay as defense in depth, not as the only gate.
- **Registration answers and the consent artifact are first-class.** `EventQuestionDef` is a
  discriminated union (the definition) and answers are validated server-side against it.
  `EventConsentInput` carries the document VERSIONS and the opt-ins but deliberately has no
  `acceptedAt` key: the server stamps its own clock, and a consent record without the exact version
  it was shown is worthless.
- **No registration shape carries a member's email or phone.** Hosts see a person, a ticket type and
  answers - never an address. Guest contact stays on the single host-scoped `getCleanupGuests`
  surface behind `view_guest_contact`. This is why `EventRegistrationDTO` has no contact fields at
  all rather than optional ones a future handler could populate.
- **`updateCleanup` gains `id`.** `UpdateCleanupRequestSchema` now has `id: IdSchema`, the backend
  merges the path id into the body before `parse` (as `cancelCleanup` already did), and
  `endpoints.test.ts`'s allowlist of ":param with no request key" offenders is now EMPTY and must
  stay empty.
- **Legal document versions are contract, not copy.** `LegalDocumentType` + `LegalDocumentVersionDTO`
  + `GET /legal/versions` make the version set machine-readable, shared by the site, the API and the
  `legal_documents` table that consent records reference.

## 24. Broadcasts: civfix is the relay, and delivery is at-least-once (0.40.0)

A host composes a message; civfix sends it. The host never learns an address, and no shape in
`schemas/host/broadcasts.ts` can carry one - `BroadcastDeliveryDTO` has a `recipientLabel`, not a
recipient.

- **No bulk verb on the `Mailer` seam.** Every email carries a DISTINCT per-recipient
  `List-Unsubscribe` capability token, which a bulk send could not express. Fan-out stays a
  service-layer loop over the existing per-recipient seam (the same reasoning as §19), so the seam
  interface is unchanged.
- **Segments are closed, never compound.** `BroadcastSegment` is a discriminated union of seven
  branches, each mapping to exactly one hand-written query. Compound audiences would require dynamic
  SQL, which is precisely what the repository idiom forbids.
- **Critical messages are asymmetric.** `event_cancelled` and `event_updated` bypass unsubscribes,
  per-event mutes and the `hostBroadcasts` preference - they are service messages about something
  the recipient signed up for. They do NOT bypass bans or the bounce/complaint suppression list.
  Everything else is bulk and fully opt-out-able.
- **`hostBroadcasts` is its own preference bucket**, defaulted `true` so an older server's prefs
  payload still parses and the shallow `.partial()` update request keeps working. A recipient must be
  able to mute hosts without muting event chat or service messages. It is a CHANNEL-WIDE opt-out -
  in-app, email and push alike - but only for the two host-composed kinds, `host_broadcast` and
  `thank_you`. `confirmation`, `waitlist_promoted` and `reminder` are service messages about
  something the recipient signed up for and are never gated by it; the audience query and the push
  gate encode that same split, so a host newsletter opt-out can never silence an event reminder.
- **Delivery is at-least-once with bounded at-most-twice.** Per-recipient uniqueness lives on
  `(broadcast_id, channel, recipient_kind, recipient_id)`; an interrupted chunk re-runs and conflicts
  rather than duplicating. Contract-side this shows up as counts (`sentCount`, `failedCount`,
  `suppressedCount`) with no notion of "delivered exactly once".
- **One-click unsubscribe is public, csrf-free and non-probing.** A mail client POSTs a capability
  token with no session, so CSRF cannot apply; the response is always `{ ok: true }`, byte-identical
  for a valid, expired, forged or already-unsubscribed token, so the endpoint reveals nothing about
  whether an address is on a list.
- **The GET twin is a browser landing, not a client call.** `openUnsubscribeBroadcasts`
  (`GET /v1/broadcasts/unsubscribe`) exists so the `?t=` link printed in an email opens somewhere
  sensible: it answers `302` to the web `/unsubscribe?t=...` page (and to the token-less page when
  `t` is missing or malformed), never JSON. It therefore carries its OWN request schema
  (`OpenUnsubscribeBroadcastsRequestSchema`, key `t` - the key the mail link and the server actually
  read, not the POST body's `token`) and an EMPTY response schema, because there is no body to
  parse. Nothing may drive it through the typed client: a redirect to HTML is not a contract
  response. The POST twin remains the machine-readable one-click endpoint.
- **There is no open tracking and no click tracking.** No field exists for one, on any shape, in any
  phase - which is what keeps the no-analytics-SDK, no-cookie-banner commitment true for messaging.

## 25. Host analytics are count-only, k-suppressed and viewer-scoped (0.40.0)

Every number a host sees is server-computed from first-party counters and registration rows. There
is no analytics SDK, no cookie, no identifier, and no per-person series anywhere.

- **Suppression is part of the shape, not a rendering rule.** Every count is `number | null` beside a
  `suppressed` flag, a whole `Panel` can be suppressed at once, and `k` (5) is echoed in every
  envelope so the UI can explain a blank cell instead of drawing a zero. A rate whose denominator is
  below `k` is `null`, never `0` - a fake zero is a worse lie than a gap.
- **Repeat attendance is a RATE and only a rate.** A per-person repeat list would rebuild the
  activity stream §15 deliberately removed, so `HostedEventsAnalyticsResponse` exposes
  `repeatAttendance` as a `SuppressedRate` with no row list behind it.
- **A page view is a POST.** `POST /pages/:slug/view` counts an identifier-free view; making it a
  `GET` side effect would violate §17 and would fire on every crawler and prefetch. The server
  classifies `utm_source` / the `Referer` into the closed `PageViewSource` bucket set and DISCARDS
  the referrer - it is never stored and never logged.
- **Donation clicks are a metric, not a route.** There is no `recordEventDonationClick` endpoint;
  the click counter rides the same daily metrics table and surfaces as
  `EventAnalyticsSourcesResponse.donationClicks`.
- **Suppression is COMPLEMENTARY across the views of one series, and BOUNDED.** Hiding a sub-k day
  in the daily series protects nobody on its own: a reader who also sees the running total, the
  panel total or the KPI recovers the hidden day by subtraction (`[6, 2, 7]` with k=5 publishes 6
  and 7 and a total of 15, so the hidden day is 15 - 6 - 7). Every published prefix (a cumulative
  point, a panel total, an overview KPI) is therefore a CUT in one chain, and the hidden days
  between two consecutive cuts form a group of `n` cells whose sum `S` the reader can difference
  out. The day rule already advertises that each hidden cell lies in `[0, k-1]`; publishing `S`
  narrows that to `[max(0, S - (n-1)(k-1)), min(k-1, S)]`. A cut is therefore allowed only when
  those two bounds collapse back onto the day rule - `S === 0` (nothing to protect: every cell in
  the group is zero, which is the one disclosure this rule accepts) or `(k-1) <= S <= (n-1)(k-1)`.
  `S >= k` is NOT the test: it lets `[4, 4, 10]` publish a total of 18 that pins both hidden days
  to exactly 4, and it needlessly rejects `S = k-1` spread over `n >= 2` cells, which leaves every
  cell its full interval.
- **One closure decides the daily points, the cumulative points and every terminal number.**
  `seriesClosure(points, range, { k, suppressPoints })` walks the range once and returns
  `daily`, `cumulative` and `totalPublishable`. A cumulative step is published only when its delta
  against the previous SHOWN step is `0` or `>= k`, AND the hidden group since that step is
  revealable, AND the hidden group from the step to the END of the range is revealable - the
  look-ahead is what lets the terminal number be published: it trades an interior step for the
  total whenever both cannot be safe (`[4, 0, 10, 4]` publishes only `18`). `dailySeries.total`,
  `cumulativeSeries.total` and the backend's `registered` / `cancelled` KPIs are all gated on the
  SAME `totalPublishable`, because they are all the same cut at the end of the same chain; a KPI
  gated only by `suppressCount` would hand back what the series just withheld. The same interval
  rule gates the totals of `hourlySeries` and `arrivalsCurve`.
- **A breakdown yields to the number it partitions; the KPI never yields to the breakdown.**
  `byTicketType`, `byAudience`, `bySlot`, `bySource`, `byEvent` and the broadcast channel columns
  all sum to a number civfix publishes elsewhere (`registered`, `checkedIn`, the page-view total,
  `totals.registrations`, the daily send series), so the panel is the side that must give way -
  blanking the KPI instead would blank the product. `breakdownClosure(rows, { k,
  totalPublishable })` therefore applies SECONDARY suppression: hide every row under `k`, then,
  while the hidden group `(n, S)` is not `groupRevealable(n, S, k)`, hide the smallest SHOWN row
  as well, until the group lands in the band or nothing is left to show. `[General 20, VIP 3]`
  beside `registered = 23` publishes the KPI and no panel; `[20, 2, 2]` publishes `20` because
  the hidden group is already `S = k - 1`. Row `share`s follow their row, and a panel gated from
  ABOVE (`totalPublishable: false` - the registrations breakdowns when the day chain withheld
  `registered`) is suppressed whole, because publishing its rows would re-derive the number the
  chain just withheld.
- **A suppressed panel publishes NO rows.** `panelSuppressed` used to still carry the key list with
  `null` values, which advertises both the number of categories and (through the per-row
  `suppressed` flag) that every one of them is under `k`; with the total public that pins them -
  `[4, 4]` beside a published `8` fixes both cells at 4. A suppressed panel is therefore an empty
  `rows` array: the reader is left with the total alone.
- **A chain that published nothing constrains nothing.** The gate on a terminal number is
  `closure.panelSuppressed || closure.totalPublishable`: when the series is suppressed in full
  (its own total is under `k`) not one point is on the wire, so no external total can difference
  anything out of it. Without that carve-out a lifetime KPI would go dark whenever its windowed
  series happened to be empty - which is the normal state of `portfolio.totals.registrations`,
  whose series is the rolled-up daily `registrations` metric while the total is a lifetime count.
- **Every published integer belongs to exactly one closure.** The backend
  (`services/host/analytics-service.ts`) is auditable against this table:

  | Published number | Closure it belongs to |
  | --- | --- |
  | `overview.kpis.registered`, `funnel.registered`, `checkInRate`/`noShowRate`/`capacityUtilization` denominators | registrations day chain (`seriesClosure` over `registrationsByDay`) |
  | `overview.kpis.cancelled` | cancellations day chain |
  | `overview.kpis.checkedIn`, `funnel.checked_in` | check-in terminal: the total of `checkins.byTicketType`, `checkins.bySlot` and `arrivals` |
  | `overview.kpis.pageViews`, `funnel.page_views`, `sources.pageViews` points | page-view chain: the total of `sources.bySource` |
  | `overview.kpis.waitlisted`, `registrations.waitlistConversion` numerator/denominator | waitlist partition (see the residual below) |
  | `overview.kpis.noShow`, `overview.kpis.donationClicks`, `sources.donationClicks`, `broadcasts.recipients`, `broadcasts.unsubscribes`, `portfolio.totals.checkIns`, `portfolio.totals.uniqueAttendees` | own counter, `suppressCount` only - no published partition sums to it |
  | `overview.kpis.capacity`, `portfolio.totals.events`, `broadcasts.broadcastsSent` | host-configured or host-owned, not a count of people; never suppressed |
  | `registrations.series` / `cumulative` points | registrations day chain |
  | `registrations.cancellations` points | cancellations day chain |
  | `registrations.byTicketType`, `registrations.byAudience` | breakdown closure, gated from above by the registrations day chain |
  | `checkins.byTicketType`, `checkins.bySlot`, `checkins.arrivals` | breakdown/arrival closure over the public `checkedIn` |
  | `broadcasts.byChannel.sent`/`failed`/`suppressed` | one breakdown closure per column; the `sent` column's total is also recoverable from `broadcasts.series` |
  | `broadcasts.series` points | aggregate send counts (no per-recipient cell), treated as the public total of the `sent` column |
  | `sources.bySource` | breakdown closure over the page-view total |
  | `portfolio.totals.registrations`, `portfolio.byEvent`, `portfolio.averageCheckInRate`, `portfolio.bestDayTime` | portfolio registrations day chain (`readMany(..., ["registrations"])`) |
  | `portfolio.series` points | the same chain |

  Two RESIDUALS are known and deliberately not closed here, because both would blank a headline
  rate rather than a panel and neither is a suppressed panel's complement: `joined - promoted -
  waitlisted` (the expired/cancelled waitlist remainder, split across two endpoints) and
  `uniqueAttendees - repeatAttendees` (single-event attendees). The same shape exists inside every
  rate pair - `registered - checkedIn` is a cell too. Closing them means treating a rate as a
  two-cell partition, which is revealable only at `S = k - 1`; that is a product decision, not a
  refactor.
- **Cached per viewer, never per process.** Analytics responses are cached in Redis under a key that
  includes the viewer's scope, because two team members with different capabilities may legitimately
  see different numbers. The fixed `AnalyticsRange` enums exist to bound that key space.

## 26. Donations: direct charges, integer minor units, one error code (0.40.0)

civfix never holds funds. A donation is a DIRECT charge on the recipient organization's own
connected account; the organization is the merchant of record, pays the processor's fees, and civfix
takes a disclosed `application_fee` on top.

- **Money is an integer minor unit plus an explicit currency, everywhere.** `MoneyDTO`
  (`{ amountMinor, currency: "USD" }`) and `FeeBreakdownDTO` are integers with `z.number().int()`;
  a float amount fails validation. There is no decimal string and no `number` of dollars in the
  contract - rounding a donation is a compliance defect, not a display bug.
- **The platform fee is omitted at zero, not sent as zero.** `platformFeeBps` of `0` means the
  adapter omits `application_fee_amount` entirely, so turning the fee off is an env change with no
  code change if counsel rules it unlawful.
- **Donation status is monotonic; a dispute is a separate field.** `DonationStatus`
  (`pending → succeeded → refunded/partially_refunded`, or `failed`) only ever advances, so
  out-of-order webhooks are safe to apply. `DonationDisputeState` is its own column because a
  disputed charge is still a succeeded charge, and collapsing the two would lose the receipt's basis.
- **Exactly one new `ErrorCode`: `PAYMENT_UNAVAILABLE` (503).** It covers payments disabled, an
  organization blocked or charges-disabled, an ineligible organization, and processor 5xx - every
  case where the answer is "not now", indeterminate from the caller's side. There is no
  `PAYMENT_DECLINED` (declines happen in the browser at confirm time; no server path produces one),
  no `ORG_NOT_ELIGIBLE` and no `AMOUNT_OUT_OF_RANGE`: amount problems are `VALIDATION.fields`, a
  missing organization is `NOT_FOUND`, and stale consent is `CONFLICT`.
- **The donate page renders from ONE public read.** `DonationPageDTO` carries the organization, the
  `donateState` gate, the connected account id, the fee preview, every server-authored disclosure
  string, the disclosure version, the charitable registration number, the wallet list and the legal
  document versions. A client never composes legally required text and never loads the payment
  script for a state other than `READY`/`AT_RISK`.
- **Donor identity is opt-in and default-off in the type system.** `DonorSharingPolicy.defaultOn` is
  the literal `false`, and `OrgDonationRowDTO.donorName`/`donorEmail` are `null` for every donor who
  did not opt in - not a placeholder the organization could de-anonymize.
- **Nothing in the contract can carry card data or a secret.** No shape has a PAN, CVC, expiry,
  payment method or Stripe key; the connected account id is public by necessity and the publishable
  key is a build-time client variable, never an API response.

## 27. The admin plane gets its own reads, not a wider edge matcher (0.40.0)

The operator console reaches the API only through `/v1/admin/*`: the Access-gated edge site proxies
that prefix to the API and serves the SPA for everything else. The first cut of the host-platform
contract left three operator reads with no reachable route — the verification-evidence document
(`getMedia`), the signup-page content (`getPublicEventPage`), and the served legal versions
(`getLegalVersions`).

The obvious fix was to widen the edge matcher to `/v1/media/*`, `/v1/pages/*` and `/v1/legal/*`. It
was rejected on two counts, and the second is the decisive one:

1. **It would not have worked.** `getPublicEventPage` 404s an unpublished or flagged page by design.
   That is precisely the page an operator most needs to read before deciding whether to unpublish it.
2. **It would have made an unaudited media read reachable from the operator host.** Showing an
   operator the identity documents someone uploaded to prove a legal entity is defensible only if
   "who looked at whose evidence" is answerable. The citizen route does not audit, and it serves a
   public-CDN URL for a public-lane asset — permanent and unsigned.

So the admin plane gets `adminGetMedia`, `adminGetEventPage` and `adminGetLegalVersions`. The media
read is audited per subject (`media.viewed`, in `AUDIT_READ_ACTIONS` so it does not flood the
recent-activity feed) and always mints a short-lived signed URL regardless of the asset's lane. The
page read serves the content at ANY status. All three are `/admin`-shaped, so the existing edge
stealth-404 and Access matchers already cover them and no infra change ships with this.

The same reasoning produced `adminListHosts` (suspension had been write-only, so the console could
not say whether a host was currently suspended) and `adminDonationTotalsByOrg` (a regulator-facing
filing total must not be an aggregate of however many list pages a human clicked; that endpoint
deliberately has no cursor and reports `truncated` instead).

## 28. `z.coerce.boolean()` is never right for a query parameter (0.40.0)

`z.coerce.boolean()` is `Boolean(value)`. A GET query carries strings, so `?flagged=false` parses as
`true` and the filter silently returns the opposite set. Two query schemas shipped with it in the
first cut of 0.40.0 and both are fixed to `QueryBooleanSchema` (`schemas/common.ts`), which accepts
`true`/`false`/`1`/`0` and the real boolean, and 422s anything else rather than guessing.

Use `QueryBooleanSchema` for every boolean that can arrive in a query string. `z.coerce.number()` is
fine — numeric coercion of a string is unambiguous and a bad value fails the int/positive refinements.

## 29. The calendar entry is a JSON endpoint, not a second content type (0.40.0)

`MyEventTicketDTO.icsUrl` had no endpoint to point at. `getEventIcs` (`GET /cleanups/:id/ics`)
returns `{ ics, filename }` — the RFC 5545 document inside the ordinary JSON envelope — rather than a
`text/calendar` body.

Every versioned path in this contract is a typed JSON endpoint, and the generated client's
`ResponseOf<N>` is the parsed response. A route that answered `text/calendar` would make that type a
lie for exactly one endpoint, and every client would need a special case to avoid parsing it. A
client that wants a file writes `ics` to one; the field is still named `icsUrl` because what a caller
wants from it is "where do I get the calendar entry", and that is what it gives them.

The read rides the same visibility gate as `getCleanup`: a private event 404s for a caller with no
standing, before it can leak a title or an address into a calendar file.

**Consequences the clients live with (0.40.0 follow-up).** Two follow from the shape above, and one
helper settles both:

1. `icsUrl` is a JSON URL, so a native client cannot simply hand it to the system. Opening it shows a
   page of JSON, not a calendar entry. Add-to-calendar on a native host therefore needs the host to
   write the document to a file and offer it to a share sheet — which is a host capability, not
   something `@civfix/ui` can import. The affordance stays hidden where no host provides one.
2. The visibility gate means a registrant with no host standing (a private event) and an anonymous
   visitor on an access-code signup page both 404 here, so a client that has the event in hand still
   needs the local `buildIcs` path.

Because the same event can be built by more than one surface, `@civfix/shared/ics` exports
**`eventIcsUid(cleanupId)`** — `cleanup-<id>@civfix.org`, the UID the server already used. A calendar
dedupes on UID, so every builder calling it means one entry rather than one copy per surface. New
`.ics` builders call it; none invents its own UID scheme.

**A shared UID is a promise about content, not just about identity.** A builder may only use it if it
can say everything the server document says — in particular `STATUS:CANCELLED`. The public signup page
qualifies (`PublicEventPageDTO.event` carries `status`, `description` and the page URL). The ticket
screen does NOT: `MyEventTicketDTO.status` is the REGISTRATION's status and there is no event-lifecycle
field on it, so a local build there would re-confirm a cancelled event under the server's own identity.
It therefore builds nothing and reports a failed read instead. (Neither builder emits a `SEQUENCE`
above 0 today, so an update still rests on the calendar client re-importing a same-UID entry; a
revision counter on the event would be the additive fix if that proves insufficient.)

## 30. An event access code is a promo code, not a secret (0.40.0)

`ListEventTicketTypesRequestSchema.accessCode` rides a GET query
(`GET /cleanups/:id/ticket-types?accessCode=...`). That is deliberate, and it is a decision about the
CLASS of the value rather than an oversight about where secrets belong.

An access code is a promo code by product design: a host hands it out in a flyer, an email or a
signup URL, and `initialAccessCode` already puts it in the page URL a resident opens. It unlocks the
VISIBILITY of a hidden ticket type on one event; it grants no standing, carries no identity, and is
worth nothing away from the event it belongs to. A code that is printed on a poster cannot be treated
as a bearer credential, and pretending otherwise buys nothing.

What the backend still owes it, because the code gates something a host chose to hide:

- Hashed at rest and matched only as a hash (`sha256Hex` on both sides, the comparison done by the
  query) - a database read must not hand an operator a working code, and no clear-text prefix compare
  exists to leak one by timing.
- The read carries an explicit rate-limit config, so the query string is not a free guessing oracle.
- **The route's request logs must not carry query strings.** pino's redaction covers header and body
  paths, not `req.url`, and the edge (Caddy, Cloudflare) logs the URI by default. Codes in a log are
  the one real exposure this shape creates, and suppressing them there is the backend/infra
  obligation that makes this decision safe.

The alternative - a POST body or a header - was rejected: it would make an ordinary catalogue read a
mutation-shaped call (DECISIONS §17 in reverse) and would still not stop the code appearing in the
signup URL, which is where residents actually get it. `GetGuestEventTicketRequest.token` is the
CONTRAST: a capability token that authenticates a specific guest IS a secret, so it rides a POST body.

## 31. The donation status ratchet has exactly one backward exception (0.40.0)

`advanceStatus` is monotone over `DONATION_STATUS_RANK` and stays that way: fulfilment, dispute and
webhook replay can only move a donation forward, which is what makes out-of-order Stripe deliveries
safe.

Refund totals are the one place that rule produced a wrong number. A card refund can be created
`pending` and later move to `failed` (a card closed between the charge and the refund). With a
ratchet, the donation that was marked `refunded` on the pending refund could never be corrected, so
the org's payout ledger, the receipt, the §321 report and the platform-fee ledger all stayed wrong
about money that never left civfix's control.

`refundedDonationStatus({ current, amountMinor, refundedTotalMinor })` therefore DERIVES the status
from the recomputed total instead of advancing to it:

- a donation that has not settled (`pending`, `failed`) is returned unchanged — this exception never
  un-settles a donation, and never resurrects one that failed;
- inside the settled band the status is a pure function of the total: `0` → `succeeded`,
  `< amountMinor` → `partially_refunded`, `>= amountMinor` → `refunded`.

`isRefundStatusCorrection(current, next)` names the backward case so the caller can log it at error
level — a correction is always worth an operator's attention, because the application fee civfix
already returned for that refund cannot be un-refunded at Stripe.

## 32. The admin plane manages organizations through its own writes, and an org invite is a record (0.41.0)

The 0.40.0 console could read an organization (`adminGetOrg`) and decide its verification, and
nothing else: no list of all orgs, no way to create one for a partner who will never self-serve, no
edit, no member management, no suspension. The obvious shortcut was to let an operator call the host
org endpoints (`updateOrganization`, `inviteOrganizationMember`, ...) with an "act as" flag. It was
rejected for the reason §27 gives for reads, applied to writes: those routes are owner/admin-gated by
membership, not by operator role, they write no audit entry naming the operator, and they are not
`/admin`-shaped, so the edge matcher would have to widen for them. Every operator org write therefore
lives under `/admin/orgs` (`adminListOrgs`, `adminCreateOrg`, `adminUpdateOrg`,
`adminSetOrgSuspended`, `adminListOrgMembers`, `adminAddOrgMember`, `adminSetOrgMemberRole`,
`adminRemoveOrgMember`, `adminListOrgEvents`) and each mutation carries a mandatory `reason` (1-1000
chars, trimmed) that the backend writes to the audit log. `GET /admin/orgs` is a static sibling of
`/admin/orgs/verifications` and of `/admin/orgs/:id`; the existing pin test covers the latter.

**Ownership is assigned by `userId`, never by handle.** `adminCreateOrg.ownerUserId` and
`adminAddOrgMember.userId` are uuids. A handle is a mutable display identifier that a user can change
between the operator typing it and the request landing, and an audit entry that says "made @ada the
owner" is worthless once @ada is someone else. The console resolves a handle to an id in the picker
(`adminListUsers`) and sends the id. `role: "owner"` on `adminAddOrgMember` or
`adminSetOrgMemberRole` is an ownership TRANSFER: an org has exactly one owner, so the previous owner
is demoted to `admin` in the same transaction rather than the request being rejected - the operator
asked for a new owner, and "who was the old one" is what the audit entry is for. The org's own
`setOrganizationMemberRole` still cannot grant `owner` (its role enum is `admin|member`); that is
deliberate, ownership transfer by the org itself is a later, consented flow.

**`adminCreateOrg.verifiedKind` creates the org already verified.** A city department onboarded by
an operator should not have to upload evidence to civfix about itself. When present, the org is
created with `verifiedStatus: "verified"` and `verifiedAt: now`, and the audit entry carries the
operator and the reason; `adminDecideOrgVerification` remains the path for a self-submitted
application.

**Suspension is an operator flag, not a status.** `adminSetOrgSuspended` sets or clears
`suspendedAt`/`suspendedReason` on the org and returns the full `AdminOrgDTO`; it does not touch
`verifiedStatus`, so lifting the suspension restores exactly what was there. A suspended org keeps
its data and its members. Its public by-slug read is a 404 for anonymous callers and non-members
(the page is gone from the outside), while members still get the `OrganizationDTO` with
`suspended: true` (the additive field) so they can read the notice and reach the operator; the same
flag rides `listMyOrganizations`. While the flag is set the backend REFUSES: profile edits, invites,
role changes and verification applications (the org's self-service settings and team), invite
acceptance, linking the org to a new or edited event, the donation page and checkout, the org's
payments self-service (connecting a payout account, minting an onboarding link, changing donation
settings, accepting the donation agreement), and composing/sending/scheduling broadcasts for events
linked to the org. It still ALLOWS: every member read, a member leaving on their own, revoking a
pending invite (undoing is never blocked), and the whole admin plane. A separate `deletedAt` remains
the soft-delete; suspension is reversible by design, deletion is not, and conflating them (a
`status: active|suspended|deleted` enum was the alternative) would have made "unsuspend" a state
transition the console has to reason about instead of a flag it clears.

**An org invite is a real pending record with a capability token.** 0.40.0's
`inviteOrganizationMember` with `identifierKind: "email"` returned `invited: true` and stored
nothing, so a non-user email was a silent no-op. It now creates an `organization_invites` row
(mirroring `cleanup_team_invites`), returns it as `invite: OrganizationInviteDTO`, and the email
carries a single-use token. `listOrganizationInvites` / `revokeOrganizationInvite` sit beside the
members list; `acceptOrganizationInvite` takes `{ token }` alone, because the token identifies the
org and asking the client to ALSO send an org id would only create a mismatch to validate. It is
`POST /org-invites/accept`, not `/orgs/invites/accept`: every `/orgs/*` route is `/orgs/:id` or
`/orgs/by-slug/` and a test pins that, so the accept lives on its own static prefix. The token is a
secret in the §30 sense: the email link carries it in the URL FRAGMENT (`/manage/org-invites/accept#token=...`),
which browsers never send to a server, so it stays out of access logs, referrers and link-preview
fetchers, and the web app reads it client-side and sends it in the `acceptOrganizationInvite` POST
body. The invite is capped at `MAX_ORG_INVITES_PER_ORG` (50) pending per org, expires (`expiresAt`
is required on the DTO), and accepting requires a session whose VERIFIED email matches the invited
address - an invite to an email is a claim on the account that signs in with that email, never on
the address itself.

**Every email invite is a pending record, whether or not the address has an account.** The
tempting shortcut - seat an address that already belongs to a user directly and only create the
pending row for a stranger - makes the invite endpoint an account-existence oracle: the two cases
answer with different shapes, and only one of them can 409 on a repeat. So the backend treats
`identifierKind: "email"` uniformly: it always creates (or, on a repeat, returns) the pending
`organization_invites` row, always sends the invite email, and always answers
`{ member: null, invited: true, invite }` with `invite.user` null until the invite is accepted.
When the address does resolve to a verified account the row remembers it (`user_id`) and that
account additionally gets a best-effort in-app notification, but it still has to accept; an
address that already belongs to a member gets the same pending row, and accepting closes it as a
no-op that keeps the member's seated role (accepting never upgrades a seat). The only refusal is
the per-org pending cap, which is address-independent. A handle is a public identifier, so a handle
invite seats the account directly and may return the member row. `invited` and `member` on the
invite response keep their 0.40.0 meaning; `invite` is additive and nullable so an older server's
payload still parses.
