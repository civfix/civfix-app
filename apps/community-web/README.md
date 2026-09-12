# community-web

The PUBLIC civfix user web app: a Next.js 15 (App Router) + React 19 + TypeScript + Tailwind +
shadcn/ui application, built as a STATIC-EXPORTED SPA (`output: "export"`). All dynamic data is
fetched at runtime from the civfix API via the typed `@civfix/shared` client. There is no web server
at runtime; the export emits a static shell + JS to `out/`.

STEP 1 delivered the design system + providers + API client + the home map-browse screen (persistent
sidebar, top bar, auth modal). STEP 2 added the public surfaces: the anonymous report submit flow
(`/report`), the pin detail view (`/pin/[...id]`), the account-claim flow (`/claim`), and the public
cleanups browse (`/cleanups`, `/cleanups/[...id]`). STEP 3 adds the PinIt Web social surfaces:

- People discovery (`/people`) and a person profile (`/people/[...id]`) with a Follow toggle.
- The signed-in viewer's own profile (`/profile`).
- The Events page (`/events`) with Going / Past / Suggested tabs.
- Host an event (`/host`).
- Notifications: the top-bar activity bell popover and a full page (`/notifications`) with an
  activity list and a preferences panel.

The messages detail (`/messages/[...id]`) is the realtime conversation view: paged history from
`GET /cleanups/:id/messages`, live messages over the WebSocket, and optimistic sends with retry.

## Run

From the monorepo root (`civfix-app/`):

```
pnpm install
pnpm build        # turbo: builds @civfix/shared (tsup dist) + @civfix/ui (dist-types) first,
                  # then this app's static export
pnpm typecheck
pnpm lint
```

`@civfix/shared` and `@civfix/ui` are `workspace:*` dependencies in this repo, so an edit to either
lands here directly - no registry install, no version range to bump. `@civfix/shared` is consumed
from its built `dist` and `@civfix/ui` from its `.tsx` source (with `dist-types` for `tsc`); turbo's
`^build` ordering means every root `build` / `typecheck` / `lint` / `test` / `dev` builds them first.

Per-app (from `apps/community-web/`):

```
pnpm dev          # next dev (http://localhost:3000)
pnpm build        # next build -> static export in ./out
pnpm start        # NOTE: next start does NOT serve an exported app; use a static file server on ./out
```

Serve the export with any static host, e.g. `python -m http.server 4173 --directory out`.

## Environment

Copy `.env.example` to `.env.local` and adjust. All public vars are inlined at build time.

| Variable                        | Default                 | Purpose                                            |
| ------------------------------- | ----------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`           | `http://localhost:8080` | civfix API base URL.                               |
| `NEXT_PUBLIC_TURNSTILE_SITEKEY` | (unset)                 | Cloudflare Turnstile sitekey. Unset = dev no-op.   |
| `NEXT_PUBLIC_SITE_URL`          | `https://civfix.org`    | Canonical origin of this build; `metadataBase` for every og/twitter image. Reduced to a bare origin by `normalizeSiteUrl()`, so a trailing slash or a path is harmless. |

The app builds and runs with the backend OFF: every data hook handles loading, empty, and error
states, and the map falls back to a plain warm basemap with a small non-blocking notice.

### Running the local app against the staging API

Point the app at staging by setting `NEXT_PUBLIC_API_URL=https://api.civfix.dev` (in `.env.local` or
inline). Start it directly from `civfix-app/`, not through `dev/run.sh web` - the umbrella's env guard
refuses any real-environment URL on purpose.

Guest browsing works on plain `http://localhost:3000`, but **sign-in will not stick**: the API sets
the session and CSRF cookies as `Secure; SameSite=Lax`, and a page on `localhost` is cross-site to
`api.civfix.dev`, so the browser stores the cookie on verify and then never attaches it to the next
request. Fixing CORS does not change that. The app has to be same-site with the API, i.e. served
from a `civfix.dev` hostname over HTTPS:

```
# once: point a civfix.dev subdomain at this machine
echo "127.0.0.1 local.civfix.dev" | sudo tee -a /etc/hosts

# from civfix-app/ - Next mints a local cert the first time
NEXT_PUBLIC_API_URL=https://api.civfix.dev \
  pnpm --filter community-web exec next dev --experimental-https -H local.civfix.dev
```

Open `https://local.civfix.dev:3000` and accept the certificate once. The staging API must allow
that origin: `https://local.civfix.dev:3000` goes in `WEB_ORIGINS` in
`civfix-infra/secrets/staging/api.sops.env` (a `localhost` origin there only unblocks guest reads).
Leave `sameSite` alone in the backend - relaxing it to `none` is a security-posture change, not a
dev convenience.

## How tokens map into Tailwind

`@civfix/shared/tokens` is the single source of truth for color, type, spacing, radius, shadow, and
motion. `tailwind.config.ts` imports the `tokens` object and maps every scale into the theme, so app
code uses semantic utilities and never hardcodes a hex that exists in tokens:

- Colors: `bg-paper` `bg-paper2` `bg-cardflat` `text-ink` `text-ink-3` `border-ink-5`,
  the brand scales `bg-bloom-500` `text-moss-600` `bg-sun-500` `bg-sky-500` `bg-lilac-500`,
  the report category colors `text-cat-graffiti` / `bg-cat-trash`, and `bg-cleanup`.
- shadcn semantic colors (`background`, `primary`, `secondary`, `accent`, `muted`, `destructive`,
  `card`, `popover`, `border`, `ring`) are wired to CSS variables in `globals.css`. Those variables
  are the HSL form of token hexes (the source hex is named in a comment beside each one).
- Fonts: `font-display` (Bricolage Grotesque), `font-body` (Manrope), `font-mono` (JetBrains Mono),
  loaded via `next/font/google` and exposed as `--font-*` CSS variables.
- Type ramp: `text-token-12 .. text-token-64`. Spacing: `p-token-4`, `gap-token-6`, etc.
- Radius: `rounded-sm` (10) `rounded-md` (14) `rounded-lg` (20) `rounded-xl` (28); the teardrop pin
  shape is the `.rounded-pin` utility (`50% 50% 50% 6px`, mirrors `tokens.radius.pin`).
- Shadow: `shadow-s1 .. shadow-s4`, `shadow-pin`, `shadow-ring`. Motion: `duration-d1..d4`,
  `ease-out`/`ease-spring`/`ease-in-out`.

Map pin colors come from the shared `categoryColor()` / `cleanupColor` helpers directly (inline
styles on the marker DOM), so they always match the tokens.

## API client wiring (cookie + CSRF + X-Client)

`src/lib/api.ts` builds the typed client with `createApiClient` from `@civfix/shared/client`:

- `baseURL` from `NEXT_PUBLIC_API_URL`.
- `fetchImpl` bound to `window.fetch` in the browser (falls back to `globalThis.fetch` on the server
  so module evaluation during export never throws).
- The shared client always sends `credentials: "include"`, so the httpOnly session cookie rides
  along on every request (web cookie-session auth).
- `defaultHeaders: { "x-client": "web" }` so the backend can distinguish web from mobile.
- `getCsrfToken` reads the CSRF token from the auth store at call time; the shared client injects it
  as `x-csrf-token` only on CSRF endpoints (mutations).
- `onUnauthorized` clears the auth store on a 401 so the UI flips to signed-out.
- `toAppError()` normalizes thrown values (including network failures when the backend is down) into
  the shared `AppError` shape for consistent error UI.

## State and data

- `src/store/auth-store.ts` (zustand): `user`, `csrfToken`, `roles`, `status`. Hydrated once from
  `GET /auth/session` by `src/components/auth/auth-hydrator.tsx`.
- `src/store/report-filter-store.ts`: which report categories are visible on the map (drives the
  top-bar filter and the map pins).
- `src/store/anon-report-draft.ts`: persisted (sessionStorage) report draft, created now, used by
  the `/report` flow in the next step.
- `src/store/ui-store.ts`: auth modal + mobile bottom-sheet open state.
- `src/lib/query.ts`: React Query client (conservative retries; never retries 4xx).
- Data hooks in `src/hooks/` wrap the shared client. Auth-required queries (`my reports`, `threads`,
  `notifications`) are gated on authentication so they do not fire guaranteed-401 requests when
  signed out.

## Home screen

- Top bar (`src/components/home/top-bar.tsx`): "Show reports" category filter popover (six categories
  with color dots, checkboxes, Select all / Clear all, active-count badge), an activity bell with an
  unread badge, and a Sign in button / account avatar menu.
- Home sidebar (`src/components/home/home-sidebar.tsx`): header bar, search box, the two create CTAs
  ("Report an issue" -> `/report`, "Host an event" -> `/host`), and three sections:
  - Events near you (`GET /cleanups`): date badge, title, time + location hint, overlapping member
    avatars, going count, "You're hosting" / "You're in" tags. Public, with empty + signed-out states.
  - Your reports (`GET /reports`, auth): category dot, title, neighborhood + timestamp, status badge.
  - Messages (`GET /threads`, auth): avatar/group icon, name, timestamp, last-message preview, unread
    badge.
  All sections show skeletons while loading and tidy empty/error states.
- Auth modal (`src/components/auth/auth-modal.tsx`): Google/Apple redirect to the API OAuth start
  endpoints; email -> `POST /auth/otp/request` -> 6-digit code -> `POST /auth/otp/verify`, then the
  auth store refreshes from `/auth/session` and the modal closes.
- Map (`src/features/map/`): MapLibre GL over the OpenStreetMap (CARTO Voyager) raster basemap. The
  basemap is fixed and needs nothing from the backend or R2. Report pins are category-color teardrops
  (`categoryColor()`, the teardrop radius), cleanup pins are sun-yellow teardrops with an RSVP count
  badge, fed by `GET /map/reports` and `GET /cleanups`. Clicking a pin routes to `/pin/[id]` or
  `/cleanups/[id]`.

### Basemap

The map ALWAYS renders the OpenStreetMap (CARTO Voyager) raster basemap (attribution "(c)
OpenStreetMap contributors, (c) CARTO") over a warm paper background, so first paint shows a real
street map and never depends on the backend or R2. Report/cleanup pins render on top of it.

## Social surfaces (STEP 3)

- People discovery (`src/features/people/people-discover.tsx`, route `/people`): a search box over
  `GET /people` plus people cards (initials-gradient avatar from `PersonDTO.avatar`, name, handle,
  one-line bio, follower count, and a Follow toggle). The home sidebar search submits here
  (`/people?q=...`, read via `useSearchParams` inside a `Suspense` boundary). Cards open the profile.
- Follow toggle (`src/features/people/follow-button.tsx` + `useToggleFollow` in
  `src/hooks/use-people.ts`): an outline "Follow" / filled "Following" button with an OPTIMISTIC
  update. `onMutate` snapshots the current `{ isFollowing, followers }` (from any cached list row or
  the profile), cancels in-flight queries, and writes the toggled state into BOTH the people lists
  and the person's profile cache; `POST/DELETE /people/:id/follow`; `onError` rolls back to the
  snapshot; `onSuccess` writes the server's authoritative count. Auth-gated (prompts sign-in).
- Person profile (`src/features/people/person-profile.tsx`, route `/people/[...id]`): large avatar,
  name (h4 Bricolage), handle, bio, the Followers/Following/Reports/Cleanups stat strip, a Follow
  toggle + a Message button (auth-gated; routes to `/messages/:id`), and past events. The contract has
  no mutual-followers list, so the design's "Followed by ..." hint is omitted rather than faked.
- My profile (`src/features/people/my-profile.tsx`, route `/profile`): `GET /me/profile` with avatar,
  name, handle, bio, stats, and past events, plus a Notifications entry and a Share button (Web Share
  API, falling back to copy-link). Read-oriented for Phase 1; editing is a follow-up. Signed-out
  prompts sign-in.
- Events page (`src/features/cleanups/events-tabs.tsx`, route `/events`): Going / Past / Suggested
  tabs. The list endpoint only filters by `when`, so `useEventsTabs` (`src/hooks/use-cleanups.ts`)
  fetches the upcoming + past lists once each and derives the buckets CLIENT-SIDE: Going = upcoming &&
  `joined`; Suggested = upcoming && !`joined` && not hosted-by-me; Past = past && (`joined` ||
  hosted-by-me). Hosted vs Attended is decided by comparing `organizer.id` to the current user id.
  Going/Past are viewer-specific (signed-out prompts sign-in); Suggested is public.
- Host an event (`src/features/host/host-form.tsx`, route `/host`): a vertical form whose sections
  mirror the design steps (Title, Description, Name the spot + a draggable map pin reusing the report
  `LocationPicker`, Date + Time native pickers, and the "What to bring" moss chip input in
  `src/features/host/bring-input.tsx` with the six suggestion pills). Publish is disabled until Title,
  the spot line, Date, and Time are set; the pin is seeded to the city center so lat/lng are always
  valid. On publish: `POST /cleanups` (type `site`, ISO `scheduledAt` built from date+time, the spot
  folded into the description since the contract has no location string), then route to the new
  `/cleanups/:id`. Auth-gated. The home sidebar "Host an event" button links here.
- Notifications (`src/features/notifications/*`): the activity bell (`activity-bell.tsx`) opens a
  popover of recent notifications (icon-by-type, title, body, relative time, unread dot, link nav)
  with "Mark all read" and a link to the full page; the unread count drives the bell badge. The full
  page (`/notifications`) shows the activity list plus a preferences panel (`GET/PUT
  /notifications/prefs`: switches for push, report updates, cleanup chat, new followers, and a
  quiet-hours window). Mark-read and prefs use optimistic cache writes (the notifications UI now lives
  in `@civfix/ui`'s shared bodies via `@civfix/ui/data`). All auth-gated.
- Messages (`src/features/messages/*`): the inbox (`/messages`, `inbox.tsx`) lists threads from
  `GET /threads` (`useInboxThreads`) as rows (avatar/group icon, title, timestamp, last-message
  preview with a "You:" prefix from `lastFromMe`, unread badge) with an All/Direct/Group filter;
  tapping a row opens `/messages/:id`. The conversation (`conversation.tsx`, catch-all
  `/messages/[...id]`, id read via `usePathname`) is a full-height chat: a fixed header (back, title +
  member count from `GET /cleanups/:id`, info), a scrollable bubble list (mine right/coral, others
  left with sender name + time, day-grouped sender labels), a "reconnecting/offline" indicator, and a
  pinned composer (Enter sends, Shift+Enter newlines). The "Message" / "Message event crew" buttons on
  the person profile and cleanup detail route here. All auth-gated.
- Realtime chat plumbing: `src/lib/ws.ts` is a transport-only typed WebSocket client (connect,
  join/leave/send, subscribe, exponential backoff + jitter reconnect, an offline send queue flushed on
  open). EVERY inbound frame is validated with `WsServerMessageSchema` and every outbound frame with
  `WsClientMessageSchema` (invalid frames are logged and dropped). `src/hooks/use-chat.ts`
  (`useChat(cleanupId)`) layers the data model on top: history via React Query `useInfiniteQuery` over
  `GET /cleanups/:id/messages` (older pages via the `before` cursor on scroll-up), live messages from
  the socket, and an outbox for OPTIMISTIC sends (a pending bubble is appended with a `clientId`, then
  reconciled - replaced - when the matching `{type:"ack",clientId}` / `{type:"message"}` arrives;
  dedupe is by `clientId` then message `id`; a send that is not acked within ~12s flips to a retryable
  "failed"). The socket is opened from an effect (browser-only) and torn down (leave + close) on
  unmount, so the static export never connects during prerender. Offline / no-backend degrades
  cleanly: the history query shows an error/empty state and the composer shows an offline banner while
  the socket retries with backoff.

## IMPORTANT: static export + dynamic detail routes (for the next agent)

With `output: "export"` there is no server, so a dynamic route segment must enumerate its params at
build time via `generateStaticParams`. We cannot know real report/cleanup/thread ids ahead of time,
and `export const dynamicParams = true` is NOT honored by the static export for unknown runtime ids.

The strategy used here:

- The detail routes are CATCH-ALL routes: `app/pin/[...id]`, `app/cleanups/[...id]`,
  `app/messages/[...id]`, and `app/people/[...id]`. Each `generateStaticParams` returns a single
  placeholder (`{ id: ["_"] }`) so the export emits one shell HTML per route, and the page reads the
  ACTUAL id client-side via `useDetailId` (which uses `usePathname`, NOT `useParams`).
- IMPORTANT: read the id from `usePathname()`, NOT `useParams()`. In a static export the catch-all is
  prerendered with the placeholder param, so `useParams()` returns the BUILD-TIME `_`, not the live
  URL segment. `src/hooks/use-detail-id.ts` parses the real id out of `usePathname()` (and treats the
  `_` placeholder as "no id"), which is correct both for client-side `router.push` navigations and for
  a fallback-served deep link like `/pin/<uuid>/`.
- To serve arbitrary `/pin/<real-id>` URLs on a static host, configure a SPA FALLBACK so unknown
  paths are rewritten to the emitted shell (e.g. on Cloudflare Pages / Netlify / S3+CloudFront, route
  unmatched paths under `/pin/*`, `/cleanups/*`, `/messages/*`, `/people/*` to the catch-all
  `index.html`). With
  Next's own router (client-side `router.push`), navigation already works without any extra config.
  NOTE: a HARD refresh / deep link of a non-enumerated id under `next dev` returns 500 (a dev-server
  artifact of `output: export` + `dynamicParams = false`); the static export + SPA fallback serves it
  correctly. The pin/cleanup detail views (`src/features/pin`, `src/features/cleanups`), the person
  profile (`src/features/people`), and the conversation (`src/features/messages`) are all real
  client-rendered views read from `usePathname()`.

`trailingSlash: true` is enabled, so each route exports as a directory with an `index.html`.

The Cloudflare Pages deployment ships two control files in `public/` (copied verbatim into `out/`):
`_redirects` implements the SPA fallback above with **directory-form** rewrite destinations (Pages
silently drops any rule whose destination ends in `/index.html` as an infinite loop) and pins the real
`/cleanups`, `/people`, `/messages` browse pages first so the catch-all rewrite can't shadow them (on
Pages a `_redirects` rule wins over a matching static asset, and the `*` splat matches the bare
`/<route>/` too). `_headers` sets immutable caching for `/_next/static/*`, revalidated caching for the
HTML shells, and the security-header suite (CSP, frame-ancestors, nosniff, Referrer-Policy,
Permissions-Policy, COOP, HSTS) the static host would otherwise lack. The protective rules target
`/__spa/<route>/` copies of the browse pages, which `scripts/cf-pages-postbuild.mjs` (run after
`next build` via the `build` script) produces from the export. That same postbuild step appends a
`/*` -> `X-Robots-Tag: noindex, nofollow` rule to the EMITTED `out/_headers` (never to
`public/_headers`) whenever the build's normalized site origin is not `https://civfix.org` - staging
serves the same civic content on a second public hostname, so without it every `civfix.dev` URL is an
indexable duplicate of production. The decision is the pure `scripts/robots-policy.mjs`
(`normalizeSiteOrigin` / `isProductionOrigin` / `withNoindexRule`, unit-tested in
`robots-policy.test.mjs`, which also pins `normalizeSiteOrigin` to agree with the app's
`normalizeSiteUrl`); the append keeps every existing rule verbatim, is idempotent, and the postbuild
prints which branch it took either way. The preview Function makes the SAME call on the crawler path
(`shouldNoindex` in `functions/_preview-core.ts`), so a staging share card carries the meta tag even
though Cloudflare does not apply `_headers` to Function responses. Both control files are annotated
with the full rationale, all verified against `wrangler pages dev`. None of this affects `next dev` or
a local static-server preview — Cloudflare consumes these only at deploy time.

## Deploy

`.github/workflows/deploy-web.yml` builds this app's static export and publishes it to the Cloudflare
Pages project `civfix-web` with `wrangler pages deploy` (Direct Upload, not Pages' own git build), on
every push to `main` (production -> https://civfix.org) or `dev` (preview branch ->
https://civfix.dev). Only paths that feed the web build trigger it, so a mobile-only change never
redeploys the site.

The Pages config lives in this app, not at the repo root: `apps/community-web/wrangler.jsonc` supplies
the project name and `pages_build_output_dir: "out"`, and `wrangler` picks up the sibling
`apps/community-web/functions/` dir relative to its cwd — which is why the workflow's deploy step runs
with `working-directory: apps/community-web`. The same layout makes `wrangler pages dev` serve `out/`
through the real Pages routing engine.

## @civfix/shared notes

The `@civfix/shared` dependency was bumped to the refined contract at the start of Step 2, which
CLOSED three Step-1 gaps: `MessageThreadDTO.lastFromMe` (the "You:" prefix), `CleanupDTO.address`
(a real location line on the events list and detail), and `ReportClusterResponse.counts` (per-category
filter counts). Step 2 consumes `CleanupDTO.address` in the cleanups browse + detail, and the report
flow uses `WEB_REPORT_TYPES`, the `/media` presign/finalize contract, `AnonReportRequest/Response`,
`ClaimNudgeResponse`, and `ClaimReportRequest/Response`.

Remaining (cosmetic / enrichment) gaps, shared NOT further modified:

1. There is no report follow-up / comment endpoint, so the pin detail's owner "Send a follow-up"
   composer is wired but degrades gracefully (it acknowledges locally rather than POSTing). A
   `POST /reports/:id/comments` (or similar) would make it live; it is the single place to wire it.
2. The anon report contract (`AnonReportRequest`) has no dedicated `title` field. The flow collects a
   required title for UX and folds it into the `description` (headline first), since the city only
   receives a description. A first-class `title` would let the detail view show it verbatim.
3. The cleanups LIST endpoint returns the organizer but not the attendee roster, so the home events
   avatar stack still shows the organizer plus generic stand-ins. An optional capped
   `recentMembers: PersonDTO[]` on the list item would let the stack show real faces.

Step 3 surfaced two more (cosmetic) gaps, shared NOT further modified:

4. `UserProfileDTO` (from `GET /people/:id` and `/me/profile`) has no `avatar` gradient pair, while
   the `PersonDTO` list row does. The person profile therefore falls back to a neutral initials avatar
   instead of carrying the gradient through from the discovery card. Adding `avatar?: [string,string]`
   to `UserProfileDTO` would keep the avatar gradient consistent between the card and the profile.
5. `CreateCleanupRequest` has no human-readable location/spot string (only `lat`/`lng`); the server
   derives `CleanupDTO.address`. The host form collects a required "Name the spot" line for UX and
   folds it into the description (named first), mirroring the report flow's title handling. A
   first-class `spot`/`locationLabel` field would let the host's exact wording show verbatim.

None of these block Step 3; all are cosmetic or enrichment.

Step 4 (messages + realtime chat) surfaced three more (cosmetic / enrichment) gaps, shared NOT
modified:

6. The realtime contract is cleanup-centric: history is `GET /cleanups/:id/messages` and the WS frames
   carry a `cleanupId`. The thread list, however, includes `dm` and `group` kinds keyed by their own
   id. The conversation view therefore treats `/messages/:id` as a cleanup chat (the Phase-1 reality);
   a `dm` thread opened from a person profile loads its header from `GET /cleanups/:id` and shows a
   graceful "unavailable" state if that id is not a cleanup. A unified `GET /threads/:id/messages` (or a
   DM message endpoint + a `dm`/`group` WS room) would let the same view serve direct messages.
7. `MessageThreadDTO` carries `title` but no avatar gradient / member faces, so the inbox row and the
   conversation header use an initials avatar (or the cleanup organizer). An optional
   `avatar?: [string,string]` and/or capped `members: PersonDTO[]` would let rows and the group header
   show real faces.
8. The `presence` WS frame carries only `userId` + `state` (no display name); presence is currently
   informational and the header indicator is driven by the socket connection state rather than a live
   roster. A name/handle on the presence frame (or a roster fetch) would enable a "typing.../online"
   member display.

None of these block Step 4; all are cosmetic or enrichment. The Step-4 surfaces consume the full
realtime contract as-is: `GET /threads`, `GET /cleanups/:id/messages`, and the `@civfix/shared`
`WsClientMessageSchema` / `WsServerMessageSchema` frames over the API `/ws` endpoint.

## Rich link previews (Open Graph / Twitter cards)

1. **Static defaults, every page.** `src/app/layout.tsx` `metadata` sets `og:site_name`, `og:type`,
   `og:locale`, a title/description, `twitter:card=summary_large_image`, the icon + apple-touch-icon
   links and the 1200x630 brand image `public/og.png` (with `og:image:secure_url`, `og:image:type`,
   width/height and alt, because iMessage and WhatsApp want the dimensions and an explicit type).
   Copy, sizes and paths come from `src/lib/site-meta.ts`. This head is what the root `/`, every
   `/settings/*` page and the exported `404.html` unfurl from - the `[cf-pages]` postbuild fails the
   build if `out/index.html` or `out/404.html` loses any of those tags. No
   site-wide `og:url` / `rel=canonical` is emitted on purpose: a static export would stamp the same
   root URL on every route, so the per-entity Function injects the real one instead.
   `metadataBase` (and therefore every absolute image URL) is
   `NEXT_PUBLIC_SITE_URL`, inlined per Pages environment by `.github/workflows/deploy-web.yml`
   (`main` -> `https://civfix.org`, `dev` -> `https://civfix.dev`), falling back to
   `DEFAULT_SITE_URL`. Regenerate the artwork with
   `pnpm --filter community-web og-image` (headless Chrome renders the favicon pin + the Baloo 2
   wordmark from `public/fonts/` into `public/og.png`, and the pin alone into the 180x180
   `public/apple-touch-icon.png`; set `CHROME_BIN` if it cannot find a browser). `og.png` is held
   under 300 KB by both the generator and the postbuild check - WhatsApp silently drops a bigger
   preview image - and `public/_headers` pins `Content-Type: image/png` on both files so iMessage
   gets one un-redirected image response.
2. **Per-entity previews at the edge.** The export is static, so this app's Pages Functions
   (`apps/community-web/functions/{pin,cleanups,people,e,orgs}/[[path]].ts` - all paths below are
   relative to this app dir, which is also the cwd `wrangler pages deploy` runs in) fetch the shell
   from `env.ASSETS`, call the PUBLIC guest API (`/v1/reports/:id`, `/v1/cleanups/:id`,
   `/v1/people/:id`, ...) and rewrite `head > title` +
   the meta tags. The split is deliberate: `functions/_preview-core.ts` holds the whole security
   boundary as plain functions (route parsing, id validation, upstream request construction,
   fallback policy, cache key/TTL, header re-application) and is unit-tested in node
   (`functions/_preview.test.ts`, discovered by the app's `vitest.config.ts`);
   `functions/_preview.ts` is only the `HTMLRewriter` glue, injected as `deps.rewrite`.
   Only `onRequestGet` is exported, so HEAD/POST/OPTIONS have no handler and Cloudflare passes them
   straight to the asset server (`parsePreviewRoute` re-asserts GET-only anyway).
   `public/_routes.json` limits Function invocation to `/pin/*`, `/cleanups/*`, `/people/*`, `/e/*`
   and `/orgs/*` (with
   `/cleanups/` and `/people/` excluded so the browse pages are never intercepted -
   `scripts/cf-pages-postbuild.mjs` fails the build if a colliding browse route is included but not
   excluded). Cloudflare does NOT apply `_headers` to Function responses, so
   `src/lib/edge-headers.ts` re-applies the `/*` security block; `edge-headers.test.ts` fails if it
   ever drifts from `public/_headers`.
3. **Upstream call + caching.** The upstream request is built fresh (`buildUpstreamRequest`): GET,
   `accept: application/json`, a 1.5s `AbortSignal.timeout`, and NO cookie or `Authorization` header
   is ever forwarded, so the Function only ever sees the guest view. The API base is
   `https://api.civfix.org` unless the request host is an exact staging host, or `CIVFIX_API_URL` is
   an `https:` URL on an explicit hostname allowlist (`api.civfix.org` / `api.civfix.dev`) - no
   substring matching. Any 404, non-2xx (5xx, 429), timeout, non-JSON body, auth-gated entity or
   unmappable payload falls back to the BRANDED DEFAULT head (`defaultPreview()` rendered by the
   same `metaTagsHtml` as a real entity: `og:title=civfix`, the site description and the brand
   image, still SELF-canonical on the requested URL - the fallback also fires on a timeout or a 5xx,
   so it must never canonicalize a live entity onto the home page), so a dead, private or deleted
   link still unfurls as a civfix card instead of a bare URL. The upstream OUTCOME is carried
   through (`upstreamOutcome`): a DEFINITE miss (404/410) renders that branded default with
   `<meta name="robots" content="noindex">` so a dead entity url is not indexed, while a TRANSIENT
   failure (5xx, 429, 403, timeout, non-JSON body) stays indexable and self-canonical - a blip must
   never de-index a live entity. `shouldNoindex` also marks EVERY card noindex when the serving
   origin is not the production one, live entities included, so the self-canonical staging card
   agrees with the export-wide `X-Robots-Tag` the postbuild appends. The status stays 200: the shell is a 200 asset and the SPA
   renders its own not-found state client-side, while Facebook/iMessage, WhatsApp and LinkedIn only
   reliably read tags off a 200 - a 404 would trade a working card for nothing. No UA sniffing is
   involved; crawler and human get identical bytes. A nested SPA path (`/pin/<id>/edit`) and a
   malformed id are served the untouched shell, which already carries the same static defaults.
   The **response** is never given a longer cache
   life: every response, rewritten or not, carries the same
   `Cache-Control: public, max-age=0, must-revalidate` as every other shell, so a preview can never
   pin a stale page in a browser cache. Caching happens one layer down, on the API payload, via the
   Workers Cache API (`caches.default`), keyed by the resolved API HOST + kind + validated id: 300s
   on a hit, 60s on a miss/error (so a hot 404 does not hammer the API), populated through
   `context.waitUntil`. The API host is in the key because the namespace may be shared across
   environments - without it a staging negative entry could be replayed for a live prod url. The
   negative entry stores the outcome (`missing` / `transient`) so a cache replay makes the same
   noindex decision as the original fetch.
4. **Ids.** Only a single path segment matching `/^[a-z0-9][a-z0-9_-]{0,63}$/` (the shape of the
   API's uuid primary keys) is ever previewed. Anything else - a dot, uppercase, 65+ chars,
   `..%2F`, a nested route such as `/pin/<id>/edit` - short-circuits to the plain SPA shell and
   never reaches the API.
5. **Mapping** (pure + unit-tested in `src/lib/link-preview.ts`): report -> title and description
   are `REPORT_TYPE_LABELS`/`REPORT_CATEGORY_LABELS`, `REPORT_STATUS_LABELS` and the coarse
   `cityName` only (`Graffiti · Los Angeles, CA` / `Graffiti — In progress · Los Angeles, CA`);
   image = the first `ready` image whose URL is an UNSIGNED https URL, else the brand image.
   Event -> the event `title` (its public name, capped at 80 chars) + the schedule formatted in
   `America/Los_Angeles` + the fixed line `A volunteer event on civfix`. Person -> `Name (@handle)`
   + `On civfix` + a public avatar. `og:url`, `rel=canonical`, `og:image` and the icon links are
   built from the request's ENVIRONMENT origin - `resolveSiteOrigin(request.url)` in
   `src/lib/site-meta.ts`, which maps an exact known hostname onto that environment's ONE canonical
   origin (`civfix.org` / `www.civfix.org` / `civfix-web.pages.dev` -> `https://civfix.org`;
   `civfix.dev` / `www.civfix.dev` / `dev.civfix-web.pages.dev` -> `https://civfix.dev`), requires
   https on the default port, and otherwise falls back to `DEFAULT_SITE_URL`. There is no suffix or
   substring rule, and one environment still has exactly one canonical host, so the alias hostnames
   cannot be indexed as duplicates. It never reads `Host`, `X-Forwarded-Host` or any other client-supplied
   header, so the origin cannot be poisoned into a preview; it exists so a staging card points at
   `https://civfix.dev/og.png` (which exists) instead of a prod URL that 404s. The entity id still
   comes from the DTO, falling back to the validated route id.
6. **Privacy rules (load-bearing).** A preview NEVER carries user-authored free text: the report
   `title` and `description`, the event `description` and the profile `bio` are all dropped, and
   the corresponding fields are absent from `ReportPreviewInput` / `EventPreviewInput` /
   `PersonPreviewInput` so they cannot be reintroduced by accident (`link-preview.test.ts` asserts
   none of them ever reach the emitted tags). Only server-controlled vocabulary - enum labels, the
   formatted schedule, the coarse `cityName`, and a person's own display name/handle - is injected.
   A preview NEVER carries a street address (`addr` / `address`), coordinates, an email, or any
   viewer-specific field. Non-public reports (`visibility !== "public"`) and deleted accounts get
   the defaults, never a preview. Presigned media URLs are refused so no signed token is baked into
   HTML that is cached at the edge. Posts (`/post/:id`) are deliberately NOT previewed: `getPost`
   is `auth: "required"`, so there is no guest-readable payload to build one from.
7. **Open decisions (follow-ups, not implemented).**
   - Whether `/people/<id>` previews should ship `robots: noindex` (a public profile card is
     shareable but arguably should not be search-indexed) - needs a privacy-policy call.
   - Whether the Function needs its own rate-limit bucket (a shared-secret header from the Function
     to the API so `/v1/*` can meter edge-originated preview fetches separately from residents).
8. **Verify after deploy:** `curl -sL https://civfix.org/pin/<id> | grep -i 'og:\|<title'` (any UA works;
   the rewrite is UA-independent), then the Twitter/X card validator, Discord (paste the link) and
   Slack's unfurl. For the Apple/WhatsApp path also curl as their crawlers -
   `-A 'facebookexternalhit/1.1 Facebot Twitterbot/1.0'` (iMessage) and `-A 'WhatsApp/2.23'` - and
   confirm `curl -sI https://civfix.org/og.png` answers `200` + `content-type: image/png` with no
   redirect. A bare `https://civfix.org/`, a missing entity and a 404 URL must all still show the
   branded card. `curl -sI https://civfix.org/cleanups/` must still serve the browse page and
   `https://civfix.org/cleanups/<id>/edit` the SPA shell.
