# community-web

The PUBLIC civfix user web app: a Next.js 15 (App Router) + React 19 + TypeScript + Tailwind +
shadcn/ui application, built as a STATIC-EXPORTED SPA (`output: "export"`). All dynamic data is
fetched at runtime from the civfix API via the typed `@civfix/shared` client. There is no web server
at runtime; the export emits a static shell + JS to `out/`. The only server-side code is the
Cloudflare Pages Functions in `functions/` (see "Rich link previews").

Most of the UI is the shared `@civfix/ui` package (the `AppShell`, the feature bodies, the Map seam
and the `@civfix/ui/data` hooks), rendered through react-native-web. This app is the web HOST: it
supplies the route shells, the providers (API client, auth, capabilities, theme, i18n), the URL <->
nav-store bridge, and the web-only surfaces such as the host console (`/manage/*`), the public event
signup pages (`/e/*`) and the organization pages (`/orgs/*`).

## Run

From the monorepo root (`civfix-app/`):

```
pnpm install
pnpm build        # turbo: builds @civfix/shared (tsup dist) + @civfix/ui (dist-types) first,
                  # then this app's static export
pnpm typecheck
pnpm lint
pnpm test
```

`@civfix/shared` and `@civfix/ui` are `workspace:*` dependencies in this repo, so an edit to either
lands here directly: no registry install, no version range to bump. `@civfix/shared` is consumed
from its built `dist` and `@civfix/ui` from its `.tsx` source (with `dist-types` for `tsc`); turbo's
`^build` ordering means every root `build` / `typecheck` / `lint` / `test` / `dev` builds them first.

Per-app (from `apps/community-web/`):

```
pnpm dev          # next dev (http://localhost:3000)
pnpm build        # next build -> static export in ./out, then scripts/cf-pages-postbuild.mjs
pnpm og-image     # regenerate public/og.png + public/apple-touch-icon.png
```

`predev` / `prebuild` run `scripts/copy-contract-fonts.mjs` first (see "Fonts"). `next start` does
NOT serve an exported app; serve `out/` with a static file server, e.g.
`python3 -m http.server 4173 --directory out` (a plain file server does not apply `_redirects`, so
deep links to catch-all routes 404 there; `wrangler pages dev` serves them through the real Pages
routing).

## Environment

Copy `.env.example` to `.env.local` and adjust. All public vars are inlined at build time, so a
change needs a rebuild, not a restart.

| Variable                        | Default                 | Purpose                                            |
| ------------------------------- | ----------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`           | `http://localhost:8080` | civfix API base URL. The chat WebSocket URL is derived from it. |
| `NEXT_PUBLIC_TURNSTILE_SITEKEY` | (unset)                 | Cloudflare Turnstile sitekey. Unset = dev no-op.   |
| `NEXT_PUBLIC_SITE_URL`          | `https://civfix.org`    | Canonical origin of this build; `metadataBase` for every og/twitter image. Reduced to a bare origin by `normalizeSiteUrl()`, so a trailing slash or a path is harmless. |
| `NEXT_PUBLIC_CARTO_API_KEY`     | (unset)                 | Publishable CARTO basemap key, appended to the tile URLs when set. Unset, the same CARTO tiles render with CARTO's watermark. |

`NEXT_PUBLIC_COMMIT_SHA` is not an input: `next.config.mjs` sets it from `GITHUB_SHA` (else
`git rev-parse HEAD`) for the "Source" link.

The app builds and runs with the backend OFF: every data hook handles loading, empty, and error
states, and the CARTO basemap renders without the backend (only the pins are missing).

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
motion. `tailwind.config.ts` imports the `tokens` object and maps the scales into the theme, so app
code uses semantic utilities and never hardcodes a hex that exists in tokens:

- Colors: `bg-paper` `bg-paper2` `bg-cardflat` `text-ink` `text-ink-3` `border-ink-5`,
  the brand scales `bg-bloom-500` `text-moss-600` `bg-sun-500` `bg-sky-500` `bg-lilac-500`,
  the report category colors `text-cat-graffiti` / `bg-cat-trash`, and `bg-cleanup`. These resolve
  to CSS variables declared in `src/styles/design.css` (a light `:root` block and a `:root.dark`
  block; `design-css-tokens.test.ts` asserts they match the token hexes), so they follow the color
  scheme. The host console (`/manage/*`) uses the scheme-aware `console.*` group from `globals.css`.
- shadcn semantic colors (`background`, `primary`, `secondary`, `accent`, `muted`, `destructive`,
  `card`, `popover`, `border`, `ring`) are wired to CSS variables in `globals.css`. Those variables
  are the HSL form of token hexes (the source hex is named in a comment beside each one).
- Type ramp: `text-token-12 .. text-token-64`. Spacing: `p-token-4`, `gap-token-6`, etc.
- Radius: `rounded-xs` (6) `rounded-sm` (10) `rounded-md` (14) `rounded-lg` (20) `rounded-xl` (28)
  `rounded-2xl` (36) `rounded-pill`; the teardrop pin shape is the `.rounded-pin` utility
  (`50% 50% 50% 6px`, mirrors `tokens.radius.pin`).
- Shadow: `shadow-s1 .. shadow-s4`, `shadow-pin`, `shadow-ring`. Motion: `duration-d1..d4`,
  `ease-out`/`ease-spring`/`ease-in-out`.

Map pin colors come from the shared `categoryColor()` / `cleanupColor` helpers inside `@civfix/ui`'s
Map seam, so they always match the tokens.

### Fonts

Fonts are self-hosted; nothing is fetched from a font CDN at runtime. `scripts/copy-contract-fonts.mjs`
copies the woff2 files into `public/fonts/` from the installed `@fontsource` packages and verifies
the checksum and license of the tracked Hanken Grotesk variable font, and
`src/styles/contract-fonts.css` declares an `@font-face` for every literal family name the shared UI
emits through react-native-web (e.g. `HankenGrotesk_600SemiBold`). `globals.css` points
`--font-display` / `--font-body` at Hanken Grotesk and `--font-mono` at JetBrains Mono, which back the
`font-display` / `font-body` / `font-mono` utilities. Baloo 2 is the brand wordmark face only.

## API client wiring (cookie + CSRF + X-Client)

`src/lib/api.ts` builds the typed client with `createApiClient` from `@civfix/shared/client`:

- `baseURL` from `NEXT_PUBLIC_API_URL`.
- `fetchImpl` bound to `window.fetch` in the browser (falls back to `globalThis.fetch` on the server
  so module evaluation during export never throws).
- The shared client always sends `credentials: "include"`, so the httpOnly session cookie rides
  along on every request (web cookie-session auth).
- `defaultHeaders: { "x-client": "web" }` so the backend can distinguish web from mobile.
- `getCsrfToken` (`resolveCsrfToken`) reads the CSRF token from the auth store at call time, first
  waiting out the optimistic boot window; the shared client injects it as `x-csrf-token` only on
  CSRF endpoints (mutations).
- `onUnauthorized` clears the auth store on a 401 so the UI flips to signed-out.
- `toAppError()` normalizes thrown values (including network failures when the backend is down) into
  the shared `AppError` shape for consistent error UI.

## State and data

- `src/store/auth-store.ts` (zustand): `status`, `user`, `csrfToken`, `roles`, `enabledProviders`, `guestSmsEnabled` and `optimistic` (the
  signed-in state restored from a local snapshot before the session check lands). Revalidated from
  `GET /auth/session` by `src/components/auth/auth-hydrator.tsx`.
- `src/store/ui-store.ts`: the auth modal's open state (the bottom sheet belongs to `AppShell`).
- `src/store/appearance-store.ts`: the light / dark / system preference (localStorage), registered as
  `@civfix/ui`'s appearance store.
- `src/store/claim-handoff.ts`: the `reportId` + `claimCode` of the last anonymous submit, kept in
  localStorage for the `/claim` flow. The report draft itself lives in `@civfix/ui`'s report wizard.
- `src/lib/query.ts`: `makeQueryClient()` (conservative retries; never retries 4xx);
  `src/lib/query-persist.ts` persists a safelisted slice of the cache across reloads.
- Data hooks come from `@civfix/ui/data`, keyed by its `queryKeys`; `src/hooks/` holds only the
  web-host hooks (auth, auth gate, realtime channel, debounce, visual-viewport shift, profile
  registration).

## Routing and static export

`src/app/*` holds thin route shells. Most routes (`/`, `/pin/*`, `/cleanups/*`, `/people/*`,
`/messages/*`, `/post/*`, `/compose/*`, ...) render the same `HomeShell`
(`src/components/home/home-shell.tsx`), which mounts `@civfix/ui`'s `AppShell` client-side
(`dynamic(..., { ssr: false })`). `use-web-nav-adapter.ts` seeds the shared nav store from
`window.location` and keeps the URL in sync with raw `history.pushState`, so the shell never remounts
on navigation.

With `output: "export"` a dynamic segment must enumerate its params at build time, and real ids are
unknown then. Every detail route is therefore a CATCH-ALL (`app/pin/[...id]`, `app/e/[...slug]`,
`app/manage/[...path]`, ...) whose `generateStaticParams` returns the single placeholder `_` with
`dynamicParams = false`, so the export emits one shell per route at `out/<route>/_/index.html`. The
real id is read client-side from the URL, never from `useParams()` (which would return the build-time
`_`). `trailingSlash: true` is enabled, so each route exports as a directory with an `index.html`.

The Cloudflare Pages deployment ships two control files in `public/` (copied verbatim into `out/`):
`_redirects` implements the SPA fallback (`/<route>/* -> /<route>/_/ 200`) with **directory-form**
rewrite destinations (Pages silently drops any rule whose destination ends in `/index.html` as an
infinite loop) and pins the real `/cleanups`, `/people`, `/messages`, `/compose` browse pages first so
the catch-all rewrite can't shadow them (on
Pages a `_redirects` rule wins over a matching static asset, and the `*` splat matches the bare
`/<route>/` too). `_headers` sets immutable caching for `/_next/static/*`, revalidated caching for the
HTML shells, and the security-header suite (CSP, frame-ancestors, nosniff, Referrer-Policy,
Permissions-Policy, COOP, HSTS) the static host would otherwise lack. The protective rules target
`/__spa/<route>/` copies of the browse pages, which `scripts/cf-pages-postbuild.mjs` (run after
`next build` via the `build` script) produces from the export; it also fails the build when a
catch-all placeholder shell has no matching `_redirects` rule. That same postbuild step appends a
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
a local static-server preview; Cloudflare consumes these only at deploy time.

## Deploy

`.github/workflows/deploy-web.yml` builds this app's static export and publishes it to the Cloudflare
Pages project `civfix-web` with `wrangler pages deploy` (Direct Upload, not Pages' own git build):
a push to `main` publishes STAGING to the `staging` branch (alias `staging.civfix-web.pages.dev`,
served as https://civfix.dev), and a published `v*` release rebuilds the same commit with production
values and publishes it to the Pages production branch `main` (https://civfix.org). On a push,
only paths that feed the web build trigger it, so a mobile-only change never redeploys the site; a
release always deploys.

The Pages config lives in this app, not at the repo root: `apps/community-web/wrangler.jsonc` supplies
the project name and `pages_build_output_dir: "out"`, and `wrangler` picks up the sibling
`apps/community-web/functions/` dir relative to its cwd, which is why the workflow's deploy step runs
with `working-directory: apps/community-web`. The same layout makes `wrangler pages dev` serve `out/`
through the real Pages routing engine.

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
   (a `v*` release -> `https://civfix.org`, `main` -> `https://civfix.dev`), falling back to
   `DEFAULT_SITE_URL`. Regenerate the artwork with
   `pnpm --filter community-web og-image` (headless Chrome renders the favicon pin + the Baloo 2
   wordmark from `public/fonts/` into `public/og.png`, and the pin alone into the 180x180
   `public/apple-touch-icon.png`; set `CHROME_BIN` if it cannot find a browser). `og.png` is held
   under 300 KB by both the generator and the postbuild check - WhatsApp silently drops a bigger
   preview image - and `public/_headers` pins `Content-Type: image/png` on both files so iMessage
   gets one un-redirected image response.
2. **Per-entity previews at the edge.** The export is static, so this app's Pages Functions
   (`apps/community-web/functions/{pin,cleanups,people,e,orgs,post}/[[path]].ts` - all paths below are
   relative to this app dir, which is also the cwd `wrangler pages deploy` runs in) fetch the shell
   from `env.ASSETS`, call the PUBLIC guest API (`/v1/reports/:id`, `/v1/cleanups/:id`,
   `/v1/people/:id`, `/v1/posts/:id`, ...) and rewrite `head > title` +
   the meta tags. The split is deliberate: `functions/_preview-core.ts` holds the whole security
   boundary as plain functions (route parsing, id validation, upstream request construction,
   fallback policy, cache key/TTL, header re-application) and is unit-tested in node
   (`functions/_preview.test.ts`, discovered by the app's `vitest.config.ts`);
   `functions/_preview.ts` is only the `HTMLRewriter` glue, injected as `deps.rewrite`.
   Only `onRequestGet` is exported, so HEAD/POST/OPTIONS have no handler and Cloudflare passes them
   straight to the asset server (`parsePreviewRoute` re-asserts GET-only anyway).
   `public/_routes.json` limits Function invocation to `/pin/*`, `/cleanups/*`, `/people/*`, `/e/*`,
   `/orgs/*` and `/post/*` (with
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
4. **Ids.** Only a single path segment matching one of its kind's id shapes
   (`ID_PATTERNS` in `functions/_preview-core.ts`, every one anchored and length-bounded) is ever
   previewed: report -> a uuid or a reference code (`GR-12-000001`, type codes from
   `REPORT_TYPE_CODE`); event -> a uuid, an `EVENT-12-000045` reference code or a page slug;
   person -> a uuid or a handle (`HANDLE_REGEX`, mixed case allowed); org -> an org slug; signup ->
   a page slug; post -> a uuid. The id is passed upstream exactly as shared, never lowercased: the
   API matches reference codes case-sensitively, so `gr-12-000001` is not a report id and gets the
   plain shell. Anything else - a dot, a wrong-case code, an over-long slug, `..%2F`, a nested route
   such as `/pin/<id>/edit` - short-circuits to the plain SPA shell and never reaches the API.
5. **Mapping** (pure + unit-tested in `src/lib/link-preview.ts`) follows X's card format: the
   title is `<who or what> on civfix` (headline clamped at 90 chars, 80 for an event title, before
   the suffix), the description is the entity's own public text clamped at 200 chars, and the
   image is the entity's first picture. Report -> `Graffiti in Los Angeles, CA on civfix` (type or
   category label + the coarse `cityName`; reports are publicly anonymous, so there is no byline)
   and `In progress · <title> · <description>`, falling back to
   `Graffiti — In progress · Los Angeles, CA` when the resident wrote neither. Post ->
   `Ada Rivera (@ada) on civfix` (the organization's name and slug when it was posted as one) and
   the body, else the attached report's or event's title; a plain repost renders the ORIGINAL
   post's card, a quote keeps the quoter's text and borrows the quoted post's image only when it
   has none. Event -> `<title> on civfix` and `Cancelled? · <schedule in the event's zone> · <host>
   · <description, else "A volunteer event on civfix">`, host = the organization, else
   `Name (@handle)` of a live organizer; an UNLISTED event keeps only its title and
   `Cancelled? · <schedule> · A volunteer event on civfix` (see 6). Person -> `Name (@handle) on civfix` and the bio. Org ->
   `Name (@slug) on civfix` and `Verified … · N events · <description>`. Signup pages keep the
   host's own `seo` title/description. Images: a report or post uses the FIRST `ready` slide of
   the carousel (`firstCarouselImage`) - its thumbnail, else the full image when it is an image
   with no thumbnail (never with `og:image:width`/`height`: the media worker stores the
   pre-rotation size, so a portrait phone photo's stored dimensions can be swapped; only the
   brand `og.png` carries dimensions); a slide that
   has neither is the brand image, never slide two. A post with no media falls back to the
   attached report's thumbnail. An event uses its cover, else its first gallery image; a person
   their avatar; an org its logo. Every image must be an UNSIGNED https URL. `twitter:card` is
   `summary_large_image`, except `summary` for an avatar or logo (a square picture in a large
   card is a blurry crop). `og:url`, `rel=canonical`, `og:image` and the icon links are
   built from the request's ENVIRONMENT origin - `resolveSiteOrigin(request.url)` in
   `src/lib/site-meta.ts`, which maps an exact known hostname (`PRODUCTION_HOSTNAMES` /
   `STAGING_HOSTNAMES` in that file) onto that environment's ONE canonical origin
   (`https://civfix.org` / `https://civfix.dev`), requires https on the default port, and otherwise
   falls back to `DEFAULT_SITE_URL`. There is no suffix or
   substring rule, and one environment still has exactly one canonical host, so the alias hostnames
   cannot be indexed as duplicates. It never reads `Host`, `X-Forwarded-Host` or any other client-supplied
   header, so the origin cannot be poisoned into a preview; it exists so a staging card points at
   `https://civfix.dev/og.png` (which exists) instead of a prod URL that 404s. The entity id still
   comes from the DTO, falling back to the validated route id.
6. **Privacy rules (load-bearing).** A preview carries the entity's OWN public text in X's
   format; it NEVER carries a street-address field, coordinates, an account email or a
   viewer-specific field, never a non-public or deleted entity, never a presigned URL. Owner's
   decision: unlisted events stay shareable by link with a title + schedule card, noindex, no
   cover, no host text - no organizer or organization byline and no event description, exactly
   what an unlisted link showed before the X format. Text a resident typed into a PUBLIC field - a
   post body, a report title/description, an event description, an org description, a profile
   bio - is theirs to publish and is carried as written (escaped, one line, clamped). What is
   dropped, per field: `addr` / `address` (report, event, signup event), `lat` / `lng`, `email`,
   and every viewer field (`viewer.*`, `mine`, `chatUnread`, `following`, `isFollowing`,
   `blockedByMe`, `myRole`), plus a post's counts and mentions; none of them is declared on the
   `*PreviewInput` types, so they cannot be read by accident (`link-preview.test.ts` asserts they
   never reach the emitted tags). Non-public reports (`visibility !== "public"`), private events,
   deleted accounts, deleted posts and reposts of a deleted post get the defaults, never a
   preview. Presigned media URLs are refused so no signed token is baked into
   HTML that is cached at the edge. Posts (`/post/:id`) are previewed from `GET /v1/posts/:id`,
   which serves a PUBLIC post to a guest; a hidden or deleted post is a 404 there, so it unfurls as
   the default card. That route also serves a PUBLIC reply to a guest (accepted, `DECISIONS.md` §55).
7. **Open decisions (follow-ups, not implemented).**
   - Whether `/people/<id>` previews should ship `robots: noindex` (a public profile card is
     shareable but arguably should not be search-indexed) - needs a privacy-policy call.
   - Whether the Function needs its own rate-limit bucket (a shared-secret header from the Function
     to the API so `/v1/*` can meter edge-originated preview fetches separately from residents).
8. **Verify after deploy:** `curl -sL https://civfix.org/pin/<id> | grep -i 'og:\|<title'` (any UA works;
   the rewrite is UA-independent), the same for a reference code
   (`curl -sL https://civfix.org/pin/GR-12-000001`) and a post (`curl -sL https://civfix.org/post/<uuid>`), then the Twitter/X card validator, Discord (paste the link) and
   Slack's unfurl. For the Apple/WhatsApp path also curl as their crawlers -
   `-A 'facebookexternalhit/1.1 Facebot Twitterbot/1.0'` (iMessage) and `-A 'WhatsApp/2.23'` - and
   confirm `curl -sI https://civfix.org/og.png` answers `200` + `content-type: image/png` with no
   redirect. A bare `https://civfix.org/`, a missing entity and a 404 URL must all still show the
   branded card. `curl -sI https://civfix.org/cleanups/` must still serve the browse page and
   `https://civfix.org/cleanups/<id>/edit` the SPA shell.
