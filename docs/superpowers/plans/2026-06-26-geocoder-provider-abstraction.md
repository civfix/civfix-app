# Geocoder Provider Abstraction (Photon + Mapbox) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abstract civfix forward autocomplete and reverse geocoding behind a provider interface with interchangeable Photon (default) and Mapbox (opt-in via API key) implementations, switchable by config, Photon always the fallback.

**Architecture:** Forward dispatch lives in `@civfix/shared/geocode` (`suggestAddresses` picks `mapboxSuggest` vs `photonSuggest` by `opts.mapboxToken`, falling back to Photon on Mapbox throw/empty). `@civfix/ui` gains a `GeocoderProvider`/`useMapboxToken()` context (default `undefined` → Photon, never throws) that `AddressSearch` reads. Each app injects its public token. Reverse geocoding gains a backend `makeMapboxReverseGeocode` adapter + a `chainReverse` composer, wired into a container `streetReverseGeocode` seam (`Mapbox? → Photon`), de-duplicating the two route files.

**Tech Stack:** TypeScript ESM, vitest, React (web Next.js static export + mobile Expo), Fastify backend. Mapbox Geocoding API v6 (`/forward?autocomplete=true`, `/reverse`).

**Spec:** `docs/superpowers/specs/2026-06-26-geocoder-provider-abstraction-design.md`

**Branch:** `geocoder-provider-abstraction` in each repo (civfix-shared, civfix-web, civfix-mobile, civfix-backend).

---

## File Structure

**civfix-shared/packages/shared**
- Modify `src/geocode.ts` — add `SuggestProvider`, `mapboxSuggest`, `suggestAddresses`, `mapboxToken` opt, `"mapbox"` source, `coordSuggestion` helper.
- Modify `__tests__/geocode.test.ts` — add Mapbox + dispatch cases.
- Modify `package.json` — version `0.22.0` → `0.23.0`.

**civfix-shared/packages/ui**
- Create `src/capabilities/geocoder.tsx` — `GeocoderProvider` + `useMapboxToken`.
- Modify `src/capabilities/index.ts` — re-export them.
- Modify `src/bodies/AddressSearch.tsx` — call `suggestAddresses` with `useMapboxToken()`; Mapbox attribution row.
- Modify `package.json` — bump `@civfix/shared` to `^0.23.0`.

**civfix-web/apps/community-web**
- Create `src/lib/mapbox.ts` — `MAPBOX_TOKEN` env read.
- Modify `src/components/providers.tsx` — wrap in `<GeocoderProvider>`.
- Modify `.env.example`, `.github/workflows/deploy.yml`.
- Modify `package.json` — bump `@civfix/shared` + `@civfix/ui` to `^0.23.0`.
- Delete `src/lib/geosuggest.ts` (dead).

**civfix-mobile/apps/community-mobile**
- Modify `app.config.ts` — `EXPO_PUBLIC_MAPBOX_TOKEN` read + `extra.mapboxToken`.
- Modify `src/config.ts` — `MAPBOX_TOKEN` export.
- Modify `app/_layout.tsx` — wrap in `<GeocoderProvider>`.
- Modify `.env.example`.
- Modify `package.json` — bump `@civfix/shared` + `@civfix/ui` to `^0.23.0`.

**civfix-backend/services/api**
- Create `src/adapters/reverse-geocode.chain.ts` — `ReverseGeocode` type + `chainReverse`.
- Create `src/adapters/reverse-geocode.mapbox.ts` — `makeMapboxReverseGeocode` + `formatMapboxReverse`.
- Create `test/unit/reverse-geocode-chain.test.ts`, `test/unit/reverse-geocode-mapbox.test.ts`.
- Modify `src/env/types.ts`, `src/env.ts`, `.env.example`.
- Modify `src/di.ts` — `streetReverseGeocode` seam.
- Modify `src/routes/anon.routes.ts`, `src/routes/reports.routes.ts` — use the seam.

---

## PHASE A — `@civfix/shared` forward dispatch (TDD)

Working dir: `civfix-shared/packages/shared`. Test cmd: `pnpm vitest run __tests__/geocode.test.ts`.

### Task A1: Types — `SuggestProvider`, `mapboxToken`, `"mapbox"` source

**Files:** Modify `src/geocode.ts`.

- [ ] **Step 1:** In `src/geocode.ts`, change the `SuggestionSource` union (currently `"coordinate" | "curated" | "photon"`) to add `"mapbox"`:

```ts
export type SuggestionSource = "coordinate" | "curated" | "photon" | "mapbox"
```

- [ ] **Step 2:** Add a provider type just below `GeoSuggestion`:

```ts
/** Any forward-geocoding suggestion provider. photonSuggest + mapboxSuggest both conform. */
export type SuggestProvider = (query: string, opts?: SuggestOptions) => Promise<GeoSuggestion[]>
```

- [ ] **Step 3:** Add `mapboxToken` to `SuggestOptions` (after `locationBiasScale`):

```ts
  /** When set, suggestAddresses uses Mapbox (Geocoding v6) as the primary provider, Photon as fallback. */
  mapboxToken?: string
```

- [ ] **Step 4:** Typecheck. Run: `pnpm typecheck`. Expected: PASS (no usages yet).

- [ ] **Step 5:** Commit.

```bash
git add src/geocode.ts && git commit -m "feat(geocode): add mapbox source + SuggestProvider type + mapboxToken opt"
```

### Task A2: `mapboxSuggest` (failing test first)

**Files:** Modify `__tests__/geocode.test.ts`, `src/geocode.ts`.

- [ ] **Step 1: Write failing tests.** Add to `__tests__/geocode.test.ts` (mirror the existing Photon `vi.stubGlobal` style). Place a helper near the top-level (after the existing `photonResponse` helper):

```ts
/** A Mapbox Geocoding v6 FeatureCollection with one feature. */
function mapboxResponse(features: unknown[]): Response {
  return new Response(JSON.stringify({ type: "FeatureCollection", features }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}
```

Then a new describe block:

```ts
describe("mapboxSuggest", () => {
  it("throws without a token", async () => {
    await expect(mapboxSuggest("main st", {})).rejects.toThrow()
  })

  it("normalizes v6 features and forwards proximity + autocomplete + country params", async () => {
    let calledUrl = ""
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calledUrl = url
        return mapboxResponse([
          {
            geometry: { coordinates: [-118.24, 34.05] },
            properties: {
              name: "123 Main Street",
              place_formatted: "Los Angeles, California 90012, United States",
              context: { place: { name: "Los Angeles" }, region: { region_code: "CA" } },
            },
          },
        ])
      }),
    )
    const out = await mapboxSuggest("123 main st", {
      mapboxToken: "pk.test",
      proximity: { lat: 34.05, lng: -118.24 },
      limit: 6,
    })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      label: "123 Main Street",
      secondary: "Los Angeles, California 90012, United States",
      lat: 34.05,
      lng: -118.24,
      source: "mapbox",
    })
    const params = new URL(calledUrl).searchParams
    expect(params.get("q")).toBe("123 main st")
    expect(params.get("access_token")).toBe("pk.test")
    expect(params.get("autocomplete")).toBe("true")
    expect(params.get("country")).toBe("us")
    expect(params.get("limit")).toBe("6")
    expect(params.get("proximity")).toBe("-118.24,34.05")
  })

  it("throws on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })))
    await expect(mapboxSuggest("x", { mapboxToken: "pk.test" })).rejects.toThrow()
  })

  it("returns [] for blank input without calling the network", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect(await mapboxSuggest("  ", { mapboxToken: "pk.test" })).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```

Add `mapboxSuggest` and `suggestAddresses` to the import from `../src/geocode.js` at the top of the test file.

- [ ] **Step 2: Run, verify fail.** Run: `pnpm vitest run __tests__/geocode.test.ts`. Expected: FAIL (`mapboxSuggest is not a function`).

- [ ] **Step 3: Implement `mapboxSuggest`.** In `src/geocode.ts`, after the Photon section (after `photonSuggest`), add:

```ts
const MAPBOX_FORWARD_URL = "https://api.mapbox.com/search/geocode/v6/forward"

interface MapboxV6Context {
  address?: { name?: string }
  street?: { name?: string }
  neighborhood?: { name?: string }
  place?: { name?: string }
  region?: { name?: string; region_code?: string }
  postcode?: { name?: string }
  country?: { name?: string; country_code?: string }
}
interface MapboxV6Properties {
  name?: string
  place_formatted?: string
  full_address?: string
  feature_type?: string
  context?: MapboxV6Context
}
interface MapboxV6Feature {
  geometry?: { coordinates?: [number, number] } // [lon, lat]
  properties?: MapboxV6Properties
}

/** Primary line for a Mapbox feature. */
function mapboxLabel(p: MapboxV6Properties): string {
  return p.name || p.full_address || p.place_formatted || "Unknown place"
}
/** Secondary line (city/region), skipping anything already in the label. */
function mapboxSecondary(p: MapboxV6Properties, label: string): string | undefined {
  if (p.place_formatted && p.place_formatted !== label) return p.place_formatted
  const ctx = p.context ?? {}
  const region = ctx.region?.region_code ?? ctx.region?.name
  const parts = [ctx.place?.name, region].filter((v): v is string => !!v && v !== label)
  return parts.length ? parts.join(", ") : undefined
}

/**
 * Live address autocomplete via Mapbox Geocoding v6. Requires opts.mapboxToken (throws if missing).
 * Throws on network/HTTP failure so suggestAddresses can fall back to Photon.
 */
export async function mapboxSuggest(query: string, opts: SuggestOptions = {}): Promise<GeoSuggestion[]> {
  const q = query.trim()
  if (!q) return []
  const token = opts.mapboxToken
  if (!token) throw new Error("mapboxSuggest: missing mapboxToken")
  const url = new URL(MAPBOX_FORWARD_URL)
  url.searchParams.set("q", q)
  url.searchParams.set("access_token", token)
  url.searchParams.set("autocomplete", "true")
  url.searchParams.set("limit", String(opts.limit ?? 5))
  url.searchParams.set("language", "en")
  url.searchParams.set("country", "us")
  url.searchParams.set("types", "address,street,place,locality,neighborhood,postcode")
  if (opts.proximity) {
    url.searchParams.set("proximity", `${opts.proximity.lng},${opts.proximity.lat}`)
  }
  const res = await fetch(url.toString(), { signal: opts.signal, headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error(`Mapbox request failed: ${res.status}`)
  const data = (await res.json()) as { features?: MapboxV6Feature[] }
  const features = Array.isArray(data.features) ? data.features : []
  const out: GeoSuggestion[] = []
  for (const f of features) {
    const coords = f.geometry?.coordinates
    if (!coords || coords.length < 2) continue
    const [lng, lat] = coords
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const props = f.properties ?? {}
    const label = mapboxLabel(props)
    out.push({
      id: `mapbox:${label}:${lat.toFixed(5)},${lng.toFixed(5)}`,
      label,
      secondary: mapboxSecondary(props, label),
      lat,
      lng,
      source: "mapbox",
    })
  }
  return out
}
```

- [ ] **Step 4: Run, verify pass.** Run: `pnpm vitest run __tests__/geocode.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/geocode.ts __tests__/geocode.test.ts && git commit -m "feat(geocode): add mapboxSuggest (Mapbox Geocoding v6 autocomplete)"
```

### Task A3: `suggestAddresses` dispatcher + `coordSuggestion` helper (TDD)

**Files:** Modify `__tests__/geocode.test.ts`, `src/geocode.ts`.

- [ ] **Step 1: Write failing tests.** Add describe block:

```ts
describe("suggestAddresses", () => {
  it("short-circuits a coordinate paste with no network", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const out = await suggestAddresses("34.05, -118.24", { mapboxToken: "pk.test" })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ source: "coordinate", lat: 34.05, lng: -118.24 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("uses Photon when no mapbox token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => photonResponse([{ geometry: { coordinates: [-118.2, 34.0] }, properties: { name: "Echo Park" } }])),
    )
    const out = await suggestAddresses("echo park", {})
    expect(out[0]?.source).toBe("photon")
  })

  it("uses Mapbox when a token is set", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mapboxResponse([{ geometry: { coordinates: [-118.2, 34.0] }, properties: { name: "Echo Park" } }])),
    )
    const out = await suggestAddresses("echo park", { mapboxToken: "pk.test" })
    expect(out[0]?.source).toBe("mapbox")
  })

  it("falls back to Photon when Mapbox throws (HTTP error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("mapbox.com")
          ? new Response("err", { status: 500 })
          : photonResponse([{ geometry: { coordinates: [-118.2, 34.0] }, properties: { name: "Echo Park" } }]),
      ),
    )
    const out = await suggestAddresses("echo park", { mapboxToken: "pk.test" })
    expect(out[0]?.source).toBe("photon")
  })

  it("falls back to Photon when Mapbox returns empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("mapbox.com")
          ? mapboxResponse([])
          : photonResponse([{ geometry: { coordinates: [-118.2, 34.0] }, properties: { name: "Echo Park" } }]),
      ),
    )
    const out = await suggestAddresses("echo park", { mapboxToken: "pk.test" })
    expect(out[0]?.source).toBe("photon")
  })
})
```

- [ ] **Step 2: Run, verify fail.** Run: `pnpm vitest run __tests__/geocode.test.ts`. Expected: FAIL (`suggestAddresses is not a function`).

- [ ] **Step 3: Implement.** In `src/geocode.ts`, add a coordinate-suggestion helper near `parseLatLng` and refactor `suggestPlaces` to use it, then add `suggestAddresses`.

Add helper (after `parseLatLng`):

```ts
/** Build the single offline "exact coordinates" suggestion for a parsed lat/lng. */
function coordSuggestion(coord: LatLng): GeoSuggestion {
  return {
    id: `coordinate:${coord.lat},${coord.lng}`,
    label: `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`,
    secondary: "Exact coordinates",
    lat: coord.lat,
    lng: coord.lng,
    source: "coordinate",
  }
}
```

In `suggestPlaces`, replace the inline coordinate object literal (the `if (coord) { return [ {...} ] }` block) with:

```ts
  const coord = parseLatLng(q)
  if (coord) return [coordSuggestion(coord)]
```

Add the dispatcher (after `suggestPlaces`):

```ts
/**
 * Provider-dispatched address autocomplete (no curated list): coordinate paste short-circuits; then
 * Mapbox when opts.mapboxToken is set (falling back to Photon on Mapbox throw OR empty); else Photon.
 * This is what the app AddressSearch uses. Errors degrade to [].
 */
export async function suggestAddresses(query: string, opts: SuggestOptions = {}): Promise<GeoSuggestion[]> {
  const q = query.trim()
  if (!q) return []

  const coord = parseLatLng(q)
  if (coord) return [coordSuggestion(coord)]

  if (opts.mapboxToken) {
    try {
      const hits = await mapboxSuggest(q, opts)
      if (hits.length > 0) return hits
    } catch {
      // Mapbox unavailable → fall through to Photon.
    }
  }
  try {
    return await photonSuggest(q, opts)
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run, verify pass.** Run: `pnpm vitest run __tests__/geocode.test.ts`. Expected: PASS (all old + new).

- [ ] **Step 5: Typecheck + build.** Run: `pnpm typecheck && pnpm build`. Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add src/geocode.ts __tests__/geocode.test.ts && git commit -m "feat(geocode): add suggestAddresses provider dispatcher (Mapbox→Photon fallback)"
```

### Task A4: Version bump

- [ ] **Step 1:** In `packages/shared/package.json`, change `"version": "0.22.0"` → `"version": "0.23.0"`.
- [ ] **Step 2:** Commit. `git add package.json && git commit -m "chore(shared): bump to 0.23.0"`

---

## PHASE B — `@civfix/ui` provider + AddressSearch wiring

Working dir: `civfix-shared/packages/ui`.

### Task B1: `GeocoderProvider` + `useMapboxToken`

**Files:** Create `src/capabilities/geocoder.tsx`; Modify `src/capabilities/index.ts`.

- [ ] **Step 1: Create `src/capabilities/geocoder.tsx`:**

```tsx
// The geocoder seam: an OPTIONAL Mapbox token for forward autocomplete. Unlike useCapabilities, this
// does NOT throw when no provider is mounted — it defaults to undefined so AddressSearch uses Photon.
import React, { createContext, useContext } from "react"

const MapboxTokenContext = createContext<string | undefined>(undefined)
MapboxTokenContext.displayName = "MapboxTokenContext"

export interface GeocoderProviderProps {
  /** Mapbox public token. When set, AddressSearch uses Mapbox (Photon fallback). Omit for Photon. */
  token?: string
  children: React.ReactNode
}

export function GeocoderProvider({ token, children }: GeocoderProviderProps) {
  return <MapboxTokenContext.Provider value={token}>{children}</MapboxTokenContext.Provider>
}

/** The active Mapbox token, or undefined when no GeocoderProvider is mounted / no token is set. */
export function useMapboxToken(): string | undefined {
  return useContext(MapboxTokenContext)
}
```

- [ ] **Step 2:** In `src/capabilities/index.ts`, add (after the `./context` exports):

```ts
export { GeocoderProvider, useMapboxToken } from "./geocoder"
export type { GeocoderProviderProps } from "./geocoder"
```

- [ ] **Step 3:** Typecheck. Run: `pnpm -C ../.. -F @civfix/ui typecheck` (or the repo's `pnpm typecheck` in `packages/ui`). Expected: PASS.

- [ ] **Step 4:** Commit. `git add src/capabilities/geocoder.tsx src/capabilities/index.ts && git commit -m "feat(ui): add GeocoderProvider + useMapboxToken (optional, Photon default)"`

### Task B2: `AddressSearch` uses `suggestAddresses` + token

**Files:** Modify `src/bodies/AddressSearch.tsx`.

- [ ] **Step 1:** Change the geocode import (line ~24) from `photonSuggest` to `suggestAddresses`:

```ts
import { parseLatLng, suggestAddresses, ipLocate, type GeoSuggestion, type LatLng } from "@civfix/shared/geocode"
```

- [ ] **Step 2:** Add the token hook import. The component already imports `useGeolocation` from `"../capabilities"`; add `useMapboxToken` to that same import statement.

- [ ] **Step 3:** Inside the component body (near `const geo = useGeolocation()`), add:

```ts
  const mapboxToken = useMapboxToken()
```

- [ ] **Step 4:** Change the call site (line ~120) from `photonSuggest(...)` to:

```ts
    const res = await suggestAddresses(trimmed, { ...bias, signal: ac.signal, limit: 6, mapboxToken })
```

Ensure `mapboxToken` is in the `runSearch`/`useCallback` dependency array if `runSearch` is memoized.

- [ ] **Step 5:** Typecheck. Run the ui `pnpm typecheck`. Expected: PASS.

- [ ] **Step 6:** Commit. `git add src/bodies/AddressSearch.tsx && git commit -m "feat(ui): AddressSearch routes through suggestAddresses (Mapbox when keyed)"`

### Task B3: Mapbox attribution row

**Files:** Modify `src/bodies/AddressSearch.tsx`.

- [ ] **Step 1:** Read the suggestions-dropdown render block to find where the list items are mapped (the array of `GeoSuggestion` rows). Track whether Mapbox results are present:

```ts
  const showMapboxAttribution = results.some((r) => r.source === "mapbox")
```

(use the actual results state variable name in the file).

- [ ] **Step 2:** Render a muted attribution row as the last child of the dropdown list (Mapbox TOS requires attribution wherever its results are shown). Match the file's existing styling primitives (`theme`, `Text`/`View` or `div`/`span` per the web/native split). Concretely, after the mapped rows:

```tsx
{showMapboxAttribution ? (
  <Text style={{ fontSize: 11, color: theme.colors.textMuted, paddingHorizontal: 12, paddingVertical: 6 }}>
    © Mapbox © OpenStreetMap
  </Text>
) : null}
```

(Adapt element/style to the file's conventions; if the dropdown is web `div`s, use a `<span>` with `webInputReset`-adjacent styling. Use the muted-text token actually present in `theme`.)

- [ ] **Step 3:** Typecheck. Expected: PASS.

- [ ] **Step 4:** Commit. `git add src/bodies/AddressSearch.tsx && git commit -m "feat(ui): show Mapbox attribution when Mapbox results are shown"`

### Task B4: ui dep bump

- [ ] **Step 1:** In `packages/ui/package.json`, bump the `@civfix/shared` dependency to `workspace:^0.23.0`.
- [ ] **Step 2:** Build ui. Run: `pnpm -C ../.. build` (build shared then ui) or the workspace build. Expected: PASS.
- [ ] **Step 3:** Commit. `git add package.json && git commit -m "chore(ui): require @civfix/shared ^0.23.0"`

### Task B5: Publish shared + ui (release gate)

> Publishing is CI-driven on push to the registry `repo.civfix.org` (local publish = ENEEDAUTH). Push the branch / merge per the repo's release flow so `@civfix/shared@0.23.0` + the new `@civfix/ui` are available before the apps install.

- [ ] **Step 1:** Push the `geocoder-provider-abstraction` branch for civfix-shared and run the publish flow (CI). Verify `0.23.0` is published.

---

## PHASE C — civfix-web wiring

Working dir: `civfix-web/apps/community-web`. Branch `geocoder-provider-abstraction`.

### Task C1: Token env read

- [ ] **Step 1:** Create `src/lib/mapbox.ts`:

```ts
/**
 * Mapbox public token for forward geocoding. Inlined into the static export at build time via
 * NEXT_PUBLIC_MAPBOX_TOKEN. Undefined → AddressSearch uses Photon.
 */
export const MAPBOX_TOKEN: string | undefined = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
```

- [ ] **Step 2:** Commit. `git add src/lib/mapbox.ts && git commit -m "feat(web): NEXT_PUBLIC_MAPBOX_TOKEN env read"`

### Task C2: Wrap provider tree

- [ ] **Step 1:** In `src/components/providers.tsx`, add imports:

```ts
import { CapabilitiesProvider, GeocoderProvider, makeFakeCapabilities, type PlatformCapabilities } from "@civfix/ui/capabilities"
import { MAPBOX_TOKEN } from "@/lib/mapbox"
```

(extend the existing `@civfix/ui/capabilities` import; add the mapbox import).

- [ ] **Step 2:** In the `Providers` JSX, wrap inside `CapabilitiesProvider`:

```tsx
        <CapabilitiesProvider value={webCapabilities}>
          <GeocoderProvider token={MAPBOX_TOKEN}>
            <AuthHydrator />
            <RealtimeChannel />
            <I18nMount>
              <ToastProvider>
                <BootSplash>{children}</BootSplash>
                <FirstRunGate />
              </ToastProvider>
            </I18nMount>
          </GeocoderProvider>
        </CapabilitiesProvider>
```

- [ ] **Step 3:** Commit. `git add src/components/providers.tsx && git commit -m "feat(web): mount GeocoderProvider with NEXT_PUBLIC_MAPBOX_TOKEN"`

### Task C3: Docs + CI env + dead-code removal

- [ ] **Step 1:** Add to `.env.example` (mirroring the Turnstile comment):

```
# Optional. Mapbox public token (pk.…) for address autocomplete; falls back to Photon if unset.
# NEXT_PUBLIC_ vars are inlined into the static export at build time.
NEXT_PUBLIC_MAPBOX_TOKEN=
```

- [ ] **Step 2:** In `.github/workflows/deploy.yml`, add under the `Build static export` step's `env:` block:

```yaml
    NEXT_PUBLIC_MAPBOX_TOKEN: ${{ vars.NEXT_PUBLIC_MAPBOX_TOKEN }}
```

- [ ] **Step 3:** Delete the dead `src/lib/geosuggest.ts`. Run `grep -rn "geosuggest\|suggestAddresses" src` to confirm no importers first. Expected: only the file itself.
- [ ] **Step 4:** Commit. `git add -A && git commit -m "chore(web): document NEXT_PUBLIC_MAPBOX_TOKEN, wire CI, drop dead geosuggest"`

### Task C4: Dep bump + lockfile + verify

- [ ] **Step 1:** In `apps/community-web/package.json`, bump `@civfix/shared` and `@civfix/ui` to `^0.23.0`.
- [ ] **Step 2:** Run `pnpm install` at the web repo root (updates lockfile). Expected: resolves `0.23.0`.
- [ ] **Step 3:** Run `pnpm -F community-web typecheck && pnpm -F community-web build`. Expected: PASS.
- [ ] **Step 4:** Commit. `git add package.json ../../pnpm-lock.yaml && git commit -m "chore(web): bump @civfix/{shared,ui} ^0.23.0 + lockfile"`

---

## PHASE D — civfix-mobile wiring

Working dir: `civfix-mobile/apps/community-mobile`. Branch `geocoder-provider-abstraction`.

### Task D1: Token plumbing (app.config + config)

- [ ] **Step 1:** In `app.config.ts`, add a read near line 14:

```ts
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? ""
```

- [ ] **Step 2:** In the `extra` object (lines ~266), add:

```ts
    mapboxToken: MAPBOX_TOKEN,
```

- [ ] **Step 3:** In `src/config.ts`, extend the `Extra` type with `mapboxToken?: string` and add:

```ts
/** Mapbox public token for address autocomplete (public, provisioned from EXPO_PUBLIC_MAPBOX_TOKEN). Empty → Photon. */
export const MAPBOX_TOKEN: string = extra.mapboxToken ?? ""
```

- [ ] **Step 4:** Commit. `git add app.config.ts src/config.ts && git commit -m "feat(mobile): EXPO_PUBLIC_MAPBOX_TOKEN → extra.mapboxToken → config"`

### Task D2: Wrap provider tree

- [ ] **Step 1:** In `app/_layout.tsx`, add `GeocoderProvider` to the `@civfix/ui/capabilities` import (line ~31-35) and `MAPBOX_TOKEN` to the `@/config` import.
- [ ] **Step 2:** Insert `<GeocoderProvider token={MAPBOX_TOKEN || undefined}>` between `<MediaLightboxProvider>` (line ~400) and `<BottomSheetModalProvider>` (line ~401), and the matching `</GeocoderProvider>` between `</BottomSheetModalProvider>` (~442) and `</MediaLightboxProvider>` (~443).
- [ ] **Step 3:** Commit. `git add app/_layout.tsx && git commit -m "feat(mobile): mount GeocoderProvider with EXPO_PUBLIC_MAPBOX_TOKEN"`

### Task D3: Docs + dep bump + lockfile + verify

- [ ] **Step 1:** Add to `apps/community-mobile/.env.example`:

```
# Optional. Mapbox public token (pk.…) for address autocomplete; falls back to Photon if unset.
EXPO_PUBLIC_MAPBOX_TOKEN=
```

- [ ] **Step 2:** Bump `@civfix/shared` + `@civfix/ui` to `^0.23.0` in `apps/community-mobile/package.json`.
- [ ] **Step 3:** `pnpm install` at the mobile repo root (lockfile). Then `pnpm -F community-mobile typecheck`. Expected: PASS.
- [ ] **Step 4:** Commit. `git add -A && git commit -m "chore(mobile): doc EXPO_PUBLIC_MAPBOX_TOKEN, bump @civfix/{shared,ui} ^0.23.0 + lockfile"`

---

## PHASE E — civfix-backend reverse (TDD)

Working dir: `civfix-backend/services/api`. Branch `geocoder-provider-abstraction`. Test cmd: `pnpm vitest run test/unit/<file>`.

### Task E1: `chainReverse` composer (TDD)

**Files:** Create `src/adapters/reverse-geocode.chain.ts`, `test/unit/reverse-geocode-chain.test.ts`.

- [ ] **Step 1: Write failing test** `test/unit/reverse-geocode-chain.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { chainReverse, type ReverseGeocode } from "../../src/adapters/reverse-geocode.chain.js"

const ok = (label: string): ReverseGeocode => async () => label
const nul: ReverseGeocode = async () => null

describe("chainReverse", () => {
  it("returns the first non-null result", async () => {
    expect(await chainReverse(nul, ok("A"), ok("B"))(1, 2)).toBe("A")
  })
  it("returns null when all providers return null", async () => {
    expect(await chainReverse(nul, nul)(1, 2)).toBeNull()
  })
  it("skips null/undefined providers", async () => {
    expect(await chainReverse(null, undefined, ok("C"))(1, 2)).toBe("C")
  })
  it("honors order (earlier provider wins)", async () => {
    expect(await chainReverse(ok("first"), ok("second"))(1, 2)).toBe("first")
  })
})
```

- [ ] **Step 2: Run, verify fail.** Run: `pnpm vitest run test/unit/reverse-geocode-chain.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/adapters/reverse-geocode.chain.ts`:

```ts
/** A street-level reverse geocoder: coords → one-line address, or null. Photon + Mapbox conform. */
export type ReverseGeocode = (lat: number, lng: number) => Promise<string | null>

/**
 * Compose reverse geocoders into one that tries each in order and returns the first non-null result.
 * null/undefined entries are skipped, so callers can pass `cond ? make() : null` inline.
 */
export function chainReverse(...providers: Array<ReverseGeocode | null | undefined>): ReverseGeocode {
  const active = providers.filter((p): p is ReverseGeocode => typeof p === "function")
  return async (lat: number, lng: number): Promise<string | null> => {
    for (const p of active) {
      const r = await p(lat, lng)
      if (r) return r
    }
    return null
  }
}
```

- [ ] **Step 4: Run, verify pass.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/adapters/reverse-geocode.chain.ts test/unit/reverse-geocode-chain.test.ts && git commit -m "feat(api): add chainReverse reverse-geocoder composer"`

### Task E2: Mapbox reverse adapter (TDD)

**Files:** Create `src/adapters/reverse-geocode.mapbox.ts`, `test/unit/reverse-geocode-mapbox.test.ts`.

- [ ] **Step 1: Write failing test** `test/unit/reverse-geocode-mapbox.test.ts` (mirror the Photon adapter test — injected `fetchImpl`, no global stub):

```ts
import { describe, it, expect } from "vitest"
import { makeMapboxReverseGeocode, formatMapboxReverse } from "../../src/adapters/reverse-geocode.mapbox.js"

/** A fake fetch returning one Mapbox v6 reverse feature with the given properties. */
function okFetch(props: unknown): typeof fetch {
  return (async () =>
    ({ ok: true, json: async () => ({ features: [{ properties: props }] }) }) as unknown as Response) as unknown as typeof fetch
}

describe("formatMapboxReverse", () => {
  it("builds '<addr>, City, ST' and drops US country", () => {
    expect(
      formatMapboxReverse({
        name: "123 Imperial Hwy",
        context: { place: { name: "Inglewood" }, region: { region_code: "CA" }, country: { country_code: "us", name: "United States" } },
      }),
    ).toBe("123 Imperial Hwy, Inglewood, CA")
  })
  it("keeps a non-US country", () => {
    expect(
      formatMapboxReverse({
        name: "Stanley Park",
        context: { place: { name: "Vancouver" }, region: { region_code: "BC" }, country: { country_code: "ca", name: "Canada" } },
      }),
    ).toBe("Stanley Park, Vancouver, BC, Canada")
  })
  it("returns null for empty input", () => {
    expect(formatMapboxReverse({})).toBeNull()
  })
})

describe("makeMapboxReverseGeocode", () => {
  it("returns a formatted address for a coordinate", async () => {
    const geocode = makeMapboxReverseGeocode({
      token: "pk.test",
      fetchImpl: okFetch({ name: "1 Main St", context: { place: { name: "Springfield" }, region: { region_code: "IL" }, country: { country_code: "us" } } }),
    })
    expect(await geocode(39.8, -89.6)).toBe("1 Main St, Springfield, IL")
  })
  it("returns null on non-ok HTTP", async () => {
    const geocode = makeMapboxReverseGeocode({ token: "pk.test", fetchImpl: (async () => ({ ok: false }) as unknown as Response) as unknown as typeof fetch })
    expect(await geocode(39.8, -89.6)).toBeNull()
  })
  it("returns null when fetch throws", async () => {
    const geocode = makeMapboxReverseGeocode({ token: "pk.test", fetchImpl: (async () => { throw new Error("net") }) as unknown as typeof fetch })
    expect(await geocode(39.8, -89.6)).toBeNull()
  })
  it("returns null for empty features", async () => {
    const geocode = makeMapboxReverseGeocode({ token: "pk.test", fetchImpl: (async () => ({ ok: true, json: async () => ({ features: [] }) }) as unknown as Response) as unknown as typeof fetch })
    expect(await geocode(39.8, -89.6)).toBeNull()
  })
  it("does not call fetch for a non-finite coordinate", async () => {
    let called = false
    const geocode = makeMapboxReverseGeocode({ token: "pk.test", fetchImpl: (async () => { called = true; return { ok: true, json: async () => ({}) } as unknown as Response }) as unknown as typeof fetch })
    expect(await geocode(Number.NaN, -89.6)).toBeNull()
    expect(called).toBe(false)
  })
  it("sends redirect:error (SSRF guard)", async () => {
    let opts: RequestInit | undefined
    const geocode = makeMapboxReverseGeocode({
      token: "pk.test",
      fetchImpl: (async (_u: string, o: RequestInit) => { opts = o; return { ok: true, json: async () => ({ features: [] }) } as unknown as Response }) as unknown as typeof fetch,
    })
    await geocode(39.8, -89.6)
    expect(opts?.redirect).toBe("error")
  })
})
```

- [ ] **Step 2: Run, verify fail.** Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/adapters/reverse-geocode.mapbox.ts` (mirror `reverse-geocode.photon.ts` exactly):

```ts
import type { ReverseGeocode } from "./reverse-geocode.chain.js"

const MAPBOX_REVERSE_URL = "https://api.mapbox.com/search/geocode/v6/reverse"
const DEFAULT_TIMEOUT_MS = 4000

interface MapboxReverseContext {
  address?: { name?: string }
  street?: { name?: string }
  place?: { name?: string }
  region?: { name?: string; region_code?: string }
  country?: { name?: string; country_code?: string }
}
interface MapboxReverseProps {
  name?: string
  full_address?: string
  place_formatted?: string
  context?: MapboxReverseContext
}

export interface MapboxReverseOptions {
  /** Mapbox access token (required). */
  token: string
  /** Override the reverse base URL. */
  url?: string
  /** Geocode timeout in ms (default 4000). */
  timeoutMs?: number
  /** Injected fetch (tests). Defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

/** Normalize a Mapbox v6 reverse feature to "<addr>, City, ST" (US country dropped), or null. */
export function formatMapboxReverse(p: MapboxReverseProps): string | null {
  const ctx = p.context ?? {}
  const primary = p.name || ctx.address?.name || ctx.street?.name || ctx.place?.name || ""
  if (!primary) return null
  const region = ctx.region?.region_code ?? ctx.region?.name ?? null
  const cc = ctx.country?.country_code
  const tail = [
    ctx.place?.name && ctx.place.name !== primary ? ctx.place.name : null,
    region,
    cc && cc.toUpperCase() !== "US" ? ctx.country?.name ?? cc.toUpperCase() : null,
  ].filter((v): v is string => !!v)
  return [primary, ...tail].join(", ")
}

/**
 * Street-level reverse geocoder via Mapbox v6. Never throws / never blocks: any failure → null.
 * Mirrors the Photon adapter's SSRF + timeout posture (redirect:"error", AbortController).
 */
export function makeMapboxReverseGeocode(opts: MapboxReverseOptions): ReverseGeocode {
  const baseUrl = opts.url ?? MAPBOX_REVERSE_URL
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const doFetch = opts.fetchImpl ?? fetch
  return async (lat: number, lng: number): Promise<string | null> => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const url = new URL(baseUrl)
      url.searchParams.set("longitude", String(lng))
      url.searchParams.set("latitude", String(lat))
      url.searchParams.set("access_token", opts.token)
      url.searchParams.set("limit", "1")
      url.searchParams.set("types", "address")
      url.searchParams.set("language", "en")
      const res = await doFetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        redirect: "error",
      })
      if (!res.ok) return null
      const data = (await res.json()) as { features?: { properties?: MapboxReverseProps }[] }
      const props = data.features?.[0]?.properties
      return props ? formatMapboxReverse(props) : null
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }
}
```

- [ ] **Step 4: Run, verify pass.** Run: `pnpm vitest run test/unit/reverse-geocode-mapbox.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/adapters/reverse-geocode.mapbox.ts test/unit/reverse-geocode-mapbox.test.ts && git commit -m "feat(api): add Mapbox v6 reverse-geocode adapter"`

### Task E3: env `MAPBOX_TOKEN`

**Files:** Modify `src/env/types.ts`, `src/env.ts`, `.env.example`.

- [ ] **Step 1:** In `src/env/types.ts`, add near the other optional secrets (e.g. after `CF_TURNSTILE_SECRET?: string`):

```ts
  /** Mapbox server token for reverse geocoding [OPT] — reverse falls back to Photon when unset. */
  MAPBOX_TOKEN?: string
```

- [ ] **Step 2:** In `src/env.ts`, add `"MAPBOX_TOKEN"` to the `optGroup([...])` array (alongside `"CF_TURNSTILE_SECRET"`).
- [ ] **Step 3:** In `services/api/.env.example`, add near `CF_TURNSTILE_SECRET`:

```
MAPBOX_TOKEN=                              # [OPT] Mapbox server token; reverse geocoding falls back to Photon if absent
```

- [ ] **Step 4:** Typecheck. Run: `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit. `git add src/env/types.ts src/env.ts .env.example && git commit -m "feat(api): add optional MAPBOX_TOKEN env"`

### Task E4: Container seam `streetReverseGeocode`

**Files:** Modify `src/di.ts`.

- [ ] **Step 1:** Add imports near the other adapter imports:

```ts
import { makePhotonReverseGeocode } from "./adapters/reverse-geocode.photon.js"
import { makeMapboxReverseGeocode } from "./adapters/reverse-geocode.mapbox.js"
import { chainReverse, type ReverseGeocode } from "./adapters/reverse-geocode.chain.js"
```

- [ ] **Step 2:** In the `Container` interface (after `readonly geocoder: Geocoder`), add:

```ts
  /** Street-level reverse geocoder: Mapbox (if MAPBOX_TOKEN) then Photon. Returns null on miss. */
  readonly streetReverseGeocode: ReverseGeocode
```

- [ ] **Step 3:** In `buildContainer`, after the `geocoder` construction, add:

```ts
  const streetReverseGeocode: ReverseGeocode = chainReverse(
    env.MAPBOX_TOKEN ? makeMapboxReverseGeocode({ token: env.MAPBOX_TOKEN }) : null,
    makePhotonReverseGeocode(),
  )
```

- [ ] **Step 4:** Add `streetReverseGeocode,` to the returned container object literal (after `geocoder,`).
- [ ] **Step 5:** Typecheck. Expected: PASS.
- [ ] **Step 6:** Commit. `git add src/di.ts && git commit -m "feat(api): container streetReverseGeocode seam (Mapbox→Photon)"`

### Task E5: Route wiring (both files)

**Files:** Modify `src/routes/anon.routes.ts`, `src/routes/reports.routes.ts`.

- [ ] **Step 1:** In `anon.routes.ts`: remove the `import { makePhotonReverseGeocode } ...` (line ~47) and the `const photonReverseGeocode = makePhotonReverseGeocode()` singleton (lines ~54-55). Change the seam (lines ~136-137) to:

```ts
      reverseGeocode: async (lat, lng) =>
        (await container.streetReverseGeocode(lat, lng)) ?? container.geocoder.cityStateLabel(lat, lng),
```

- [ ] **Step 2:** In `reports.routes.ts`: same — remove the import (line ~56) and singleton (lines ~65-66); change the production seam (lines ~316-317) identically. Leave the test override (`overrides.reverseGeocode`) untouched.
- [ ] **Step 3:** Typecheck + full unit tests. Run: `pnpm typecheck && pnpm vitest run`. Expected: PASS (route suites still green; reverse now via container seam, default behavior identical since no MAPBOX_TOKEN in test env → Photon-only chain).
- [ ] **Step 4:** Commit. `git add src/routes/anon.routes.ts src/routes/reports.routes.ts && git commit -m "refactor(api): route reverse geocoding through container streetReverseGeocode seam"`

---

## PHASE F — Release

- [ ] **Step 1:** Push all four branches. Publish `@civfix/shared@0.23.0` + `@civfix/ui` via CI (Phase B5).
- [ ] **Step 2:** Deploy web (Cloudflare) + backend (`services/api` auto-deploys on push to main). Mobile needs an EAS build.
- [ ] **Step 3:** Set tokens when ready: web/mobile `*_MAPBOX_TOKEN` (public pk., restricted by URL in the Mapbox dashboard); backend `MAPBOX_TOKEN` into SOPS `infra/secrets/api.env`. Until set, everything stays on Photon.

---

## Self-Review

- **Spec coverage:** forward dispatch (A2/A3), `"mapbox"` source (A1), GeocoderProvider non-throwing default (B1), AddressSearch wiring (B2), attribution (B3), web token+provider (C1/C2), mobile token+provider (D1/D2), backend Mapbox adapter (E2), chainReverse (E1), env (E3), container seam (E4), route de-dup (E5), versioning/lockfiles (A4/B4/C4/D3), Photon-fallback on throw+empty (A3 tests) — all covered.
- **Type consistency:** `ReverseGeocode` defined once in `reverse-geocode.chain.ts`, imported by mapbox adapter + di. `SuggestProvider`/`SuggestOptions.mapboxToken`/`"mapbox"` source defined in A1, used in A2/A3/B2. `GeocoderProvider`/`useMapboxToken` defined B1, used B2/C2/D2. Names consistent across tasks.
- **Placeholder scan:** none.
