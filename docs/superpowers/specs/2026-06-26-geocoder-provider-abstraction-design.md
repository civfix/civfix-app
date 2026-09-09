# Geocoder Provider Abstraction — Photon + Mapbox (autocomplete + reverse)

**Date:** 2026-06-26
**Status:** Approved design (pending spec review)

## Goal

Abstract civfix geocoding behind a provider interface in **both** directions —
forward autocomplete and reverse geocoding — with interchangeable **Photon**
(default, keyless) and **Mapbox** (opt-in via API key) implementations. Photon
stays the always-available fallback. The active provider is selected by config
(presence of a Mapbox token) and switches seamlessly, independently per side
(web, mobile, backend each activate Mapbox by their own token).

## Background (current state)

- **Forward:** `@civfix/shared/geocode.ts` exposes `photonSuggest(query, opts)`.
  `AddressSearch.tsx` (`@civfix/ui`) calls it directly with
  `{ ...bias, signal, limit: 6 }`. The curated `suggestPlaces`/`HOST_PLACES`
  path is unused by the apps. The web `lib/geosuggest.ts` helper is dead code
  (no importers).
- **Reverse:** backend `src/adapters/reverse-geocode.photon.ts`
  `makePhotonReverseGeocode()` returns `(lat, lng) => Promise<string | null>`.
  It is instantiated as a module singleton **duplicated** in `anon.routes.ts`
  and `reports.routes.ts`, chained as
  `reverseGeocode: (lat,lng) => (await photon(lat,lng)) ?? container.geocoder.cityStateLabel(lat,lng)`
  where `cityStateLabel` is TIGER/PostGIS ("Los Angeles, CA").
- `@civfix/shared` is **env-free**: all config flows via the `opts` object /
  injected `fetch`. A key must never live inside it.
- **Config patterns:** web `NEXT_PUBLIC_*` (inlined into the static export),
  mobile `EXPO_PUBLIC_*` → `app.config.ts` `extra` → `src/config.ts`, backend
  `src/env.ts` (`optGroup` for optional secrets) + SOPS-encrypted
  `infra/secrets/api.env`.

## Non-goals

- No Mapbox basemap tiles (basemap stays CARTO Voyager).
- No Search Box API / session-token billing (use the simpler Geocoding v6).
- No change to the curated `suggestPlaces`/`HOST_PLACES` path.
- Reverse stays backend-only (clients keep calling `POST /map/reverse-label`).

## Activation model

Three **independent**, optional tokens; each side falls back to Photon when its
token is unset:

| Token | Where | Type | Activates |
|---|---|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | civfix-web | public `pk.` (inlined into bundle) | web autocomplete |
| `EXPO_PUBLIC_MAPBOX_TOKEN` | civfix-mobile | public `pk.` (inlined into binary) | mobile autocomplete |
| `MAPBOX_TOKEN` | backend (SOPS secret) | restricted server token | reverse geocoding |

## Mapbox API — Geocoding v6 (per-request billed; free tier ~100k/mo)

- **Forward:** `GET https://api.mapbox.com/search/geocode/v6/forward`
  params: `q`, `access_token`, `autocomplete=true`, `limit=6`,
  `proximity={lng},{lat}`, `bbox={minLon},{minLat},{maxLon},{maxLat}`,
  `country=us`, `types=address,street,place,locality,neighborhood,postcode`.
- **Reverse:** `GET https://api.mapbox.com/search/geocode/v6/reverse`
  params: `longitude`, `latitude`, `access_token`, `limit=1`, `types=address`.
- **Response:** GeoJSON `FeatureCollection`;
  `feature.geometry.coordinates` = `[lng, lat]`;
  `feature.properties` = `{ name, place_formatted, full_address, feature_type,
  context: { address:{name}, street:{name}, place:{name},
  region:{region_code,name}, postcode:{name} } }`.
- Chosen over Search Box because v6 returns coordinates inline → drops straight
  into the existing `GeoSuggestion` / `onPick` flow with no second "retrieve"
  call and no session-token management.

## The abstraction (symmetric)

### Forward provider (in `@civfix/shared/geocode.ts`)

```ts
export type SuggestProvider = (query: string, opts: SuggestOptions) => Promise<GeoSuggestion[]>

export const photonSuggest: SuggestProvider   // existing
export const mapboxSuggest: SuggestProvider    // new; requires opts.mapboxToken, throws if absent
```

- `SuggestionSource` gains `"mapbox"`.
- `SuggestOptions` gains `mapboxToken?: string`.
- Config-driven selector (the "switch" is purely token presence):

```ts
export async function suggestAddresses(query: string, opts: SuggestOptions): Promise<GeoSuggestion[]> {
  // 1. coordinate-paste short-circuit (parseLatLng) — provider-independent
  // 2. primary = opts.mapboxToken ? mapboxSuggest : photonSuggest
  // 3. try primary; if it THROWS, or returns [] while primary !== photon → fall back to photonSuggest
  // 4. return results in provider order; honor opts.signal throughout
}
```

Both implementations share the same signature and `GeoSuggestion[]` return, so
they are interchangeable — switching providers is config only.

### Reverse provider (backend `services/api`)

```ts
// the signature the Photon adapter already returns
export type ReverseGeocode = (lat: number, lng: number) => Promise<string | null>

export function makePhotonReverseGeocode(opts): ReverseGeocode   // existing
export function makeMapboxReverseGeocode(opts): ReverseGeocode    // new; opts: { token, url?, timeoutMs?, fetchImpl? }
```

- A composer for seamless chaining (`src/adapters/reverse-geocode.chain.ts`):

```ts
export function chainReverse(...providers: Array<ReverseGeocode | null | undefined>): ReverseGeocode {
  const active = providers.filter(Boolean) as ReverseGeocode[]
  return async (lat, lng) => {
    for (const p of active) {
      const r = await p(lat, lng)
      if (r) return r
    }
    return null
  }
}
```

- Built once in the DI container:
  `streetReverseGeocode = chainReverse(env.MAPBOX_TOKEN ? makeMapboxReverseGeocode({ token: env.MAPBOX_TOKEN }) : null, makePhotonReverseGeocode())`.
- Both route files collapse to:
  `reverseGeocode: (lat,lng) => (await container.streetReverseGeocode(lat,lng)) ?? container.geocoder.cityStateLabel(lat,lng)`.

Both directions follow the same shape: a provider **type**, named **impls**
(photon/mapbox), and a config-driven **selector/chainer**. Adding a third
provider later = implement the signature + register it.

## Components & files

### `@civfix/shared` (packages/shared)
- `src/geocode.ts`: add `SuggestProvider`, `mapboxSuggest`, `suggestAddresses`,
  `mapboxToken` opt, `"mapbox"` source, v6 parse + label/secondary builders
  (`mapboxLabel`/`mapboxSecondary`, mirroring the Photon helpers).
- `__tests__/geocode.test.ts`: add Mapbox + dispatch cases.
- Version bump `0.22.0` → `0.23.0`.

### `@civfix/ui` (packages/ui)
- New small `GeocoderProvider` + `useMapboxToken(): string | undefined` context
  module, exported from the package index (default `undefined`).
- `src/bodies/AddressSearch.tsx`: replace the `photonSuggest(...)` call with
  `suggestAddresses(trimmed, { ...bias, signal: ac.signal, limit: 6, mapboxToken: useMapboxToken() })`.
  No prop changes; the 4 render sites stay untouched.
- Render the required **Mapbox attribution** in the suggestions dropdown when
  the active results came from Mapbox (TOS compliance).
- Bump workspace dep on `@civfix/shared` to `^0.23.0`.

### civfix-web (apps/community-web)
- `src/lib`: `export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN`
  (mirrors `turnstile.tsx`).
- Wrap the app root in `<GeocoderProvider token={MAPBOX_TOKEN}>`.
- Add `NEXT_PUBLIC_MAPBOX_TOKEN` to `.env.example` and to the `Build static export`
  env block in `.github/workflows/deploy.yml` (as a repo **Variable**, not Secret).
- Bump `@civfix/shared` + `@civfix/ui` pins to `^0.23.0`; lockfile `pnpm install`.
- Delete the dead `src/lib/geosuggest.ts`.

### civfix-mobile (apps/community-mobile)
- `app.config.ts`: `const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? ""`
  → add `mapboxToken: MAPBOX_TOKEN` to `extra`.
- `src/config.ts`: extend `Extra` with `mapboxToken?` and
  `export const MAPBOX_TOKEN = extra.mapboxToken ?? ""`.
- Wrap the root in `<GeocoderProvider token={MAPBOX_TOKEN || undefined}>`.
- Add `EXPO_PUBLIC_MAPBOX_TOKEN` to `.env.example`.
- Bump `@civfix/shared` + `@civfix/ui` pins to `^0.23.0`; lockfile `pnpm install`.

### civfix-backend (services/api)
- New `src/adapters/reverse-geocode.mapbox.ts`: `makeMapboxReverseGeocode` +
  exported pure `formatMapboxReverse` (mirror Photon exactly — `redirect:"error"`
  SSRF, `AbortController` 4s timeout, finite-coord guard, swallow-all → `null`;
  output `"123 Main St, Inglewood, CA"`, comma-joined, US country dropped).
- New `src/adapters/reverse-geocode.chain.ts`: `chainReverse(...providers)`.
- `src/env/types.ts`: add `MAPBOX_TOKEN?: string` ([OPT]).
- `src/env.ts`: add `"MAPBOX_TOKEN"` to the `optGroup` list.
- `services/api/.env.example`: document `MAPBOX_TOKEN` ([OPT]).
- `src/di.ts`: build `streetReverseGeocode` seam; add to the `Container`
  interface + the returned object.
- `src/routes/anon.routes.ts` + `src/routes/reports.routes.ts`: remove the
  duplicated Photon singleton; chain `container.streetReverseGeocode` before
  `cityStateLabel`.
- `test/unit/reverse-geocode-mapbox.test.ts` + `test/unit/reverse-geocode-chain.test.ts`.
- Ops: put the real `MAPBOX_TOKEN` into SOPS `infra/secrets/api.env` at deploy
  time (until then, reverse stays on Photon).

## Data flow

**Forward:** user types → `AddressSearch` debounce → `resolveBias`
(viewport → device → IP) → `useMapboxToken()` →
`suggestAddresses(q, { ...bias, signal, limit: 6, mapboxToken })` →
[Mapbox v6 **or** Photon] → on Mapbox throw/empty → Photon → `GeoSuggestion[]`
→ dropdown (+ Mapbox attribution if Mapbox) → `onPick(lat,lng)`.

**Reverse:** client `POST /map/reverse-label` → route →
`container.streetReverseGeocode(lat,lng)` = `chainReverse(mapbox?, photon)` →
first non-null wins → else `container.geocoder.cityStateLabel` (TIGER) → else
`null` → `{ cityStateLabel }` response.

## Error handling

- **Forward:** Mapbox throw or empty → Photon; both empty → `[]`; abort → bail;
  coordinate paste short-circuits before any provider.
- **Reverse:** every provider swallows all errors → `null`; the chain tries the
  next; final fallback is TIGER `cityStateLabel`; report creation is never
  blocked.

## Testing

- `shared/__tests__/geocode.test.ts` (vitest, `vi.stubGlobal("fetch")`):
  `mapboxSuggest` parses v6 + forwards `proximity`/`bbox`/`country`/
  `autocomplete`/`limit`; `suggestAddresses` uses Mapbox when keyed, Photon when
  unkeyed, falls back to Photon on Mapbox HTTP-error, falls back on Mapbox-empty,
  coordinate short-circuit (no network).
- `backend/test/unit/reverse-geocode-mapbox.test.ts` (vitest, injected
  `fetchImpl`, `okFetch`-style v6 shape): happy / non-ok / throw / empty /
  non-finite-no-fetch; pure `formatMapboxReverse` cases; assert `redirect:"error"`.
- `backend/test/unit/reverse-geocode-chain.test.ts`: first-non-null wins,
  all-null → null, skips null providers, order honored.

## Release / versioning

1. Publish `@civfix/shared` `0.23.0` (+ `@civfix/ui`) to `repo.civfix.org`.
2. Bump web + mobile pins to `^0.23.0`; `pnpm install` (commit lockfile —
   `--frozen-lockfile` CI footgun).
3. Deploy web (Cloudflare), mobile (EAS).
4. Backend reverse: deploy `services/api`; set `MAPBOX_TOKEN` in SOPS
   `api.env` when ready (until then Photon).

Admin untouched.

## Risks / caveats

- Mapbox TOS requires attribution wherever Mapbox results are shown.
- A public `pk.` token is exposed in client bundles (expected) — restrict it by
  URL/scope in the Mapbox dashboard.
- Caret-on-`0.x` excludes new minors → must bump consumer pins + lockfile.
- v6 per-request billing; debounced per-keystroke fits the free tier but monitor.
- The reverse wiring is duplicated across two route files today; the container
  seam de-duplicates them.
