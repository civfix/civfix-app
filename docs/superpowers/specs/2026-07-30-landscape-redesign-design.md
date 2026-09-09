# FINAL DESIGN — civfix landscape redesign: "The Standing Dock" (synthesized)

Status: **binding spec for implementation.** Synthesized by the design lead from the three proposals
(`proposal-rail-evolution.md` as the base direction — it won all three judge lenses 8/8/8 — with
judge-endorsed grafts from `proposal-two-pane-canvas.md` and `proposal-dock-continuity.md`) and the
three judge verdicts. Every fatal flaw flagged by a judge is either killed or explicitly resolved
below. Where this spec contradicts a proposal, THIS SPEC WINS.

Path roots used throughout:

- `UI` = `/private/tmp/claude-501/-Users-theobong-Documents-GitHub-civfix/54642623-4b1b-452c-9923-8a98913eb8af/scratchpad/repos/civfix-shared/packages/ui/src`
- `WEB` = `/private/tmp/claude-501/-Users-theobong-Documents-GitHub-civfix/54642623-4b1b-452c-9923-8a98913eb8af/scratchpad/repos/civfix-web/apps/community-web/src`

(Implementation agents will work in writable checkouts of the same repos; the paths identify files,
not the writable location.)

Corrections to the judge record, verified against source during synthesis (do not "fix" these back):

1. **The portrait dock's selection pill slides across ALL FOUR tabs with one neutral ink.**
   `UI/shell/TabBar.shared.tsx:10-14` ("Report is a REGULAR view tab styled EXACTLY like the others —
   no always-coral, no isTabCoral") + the render code (`TabBar.web.tsx:40-56`,
   `activeTabIndex` = findIndex over all 4 `TAB_SPECS`, `tabBarLogic.ts:166-168`) + the
   `portrait-390.png` baseline all agree. The theme judge's "Report is always coral / pill slides
   between THREE tabs" claim came from a **stale comment** at `TabBar.web.tsx:4-9`. The rail mirrors
   the CURRENT dock: four regular tabs, one neutral ink, lozenge on the active one. Fix the stale
   comment in passing (WS2).
2. **`EventsBody` and `MessagingListBody` already render their own headers at view roots**
   (`EventsBody.tsx:298` unconditional `EventsHeader`; `MessagingListBody.tsx:276` unconditional
   `InboxHeader`). The "headerless list view root" blind spot is real only for `ReportsBody`
   (`ReportsBody.tsx:135` gates `ReportsHeader` on `layout === "compact"`) and needs verification for
   `SocialBody`. The fix (§3.7/§3.12) is narrower than the judges assumed.
3. **`sidebarStore.setWidth` clamps to `SIDEBAR_MAX_WIDTH` at write time** (`sidebarStore.ts:47-51`),
   confirmed — so the max-width change in §2.4 must land in BOTH the store write clamp and
   `clampSidebarWidth`, or it silently no-ops (the rail-evolution proposal's `MAX_WIDTH_WIDE` as
   written was dead on arrival).
4. **The feed's New post pill is auth-gated at the model** (`feedModel.ts:32-37`
   `showComposer: isAuthenticated`; `FeedBody.tsx:368` renders it only when
   `headerModel.showComposer`). Signed out, the pill **does not render** — it does not
   "route through requireAuth". Spec text below states the true behavior.

---

## 0. Decisions (every open question, one line each)

| # | Question | Decision |
|---|---|---|
| D1 | Overall direction | Rail-evolution base: vertical glass rail (the portrait dock stood upright) + ONE floating sand card + always-live map. No second content pane at launch (see D3). |
| D2 | Sidebar default width | **440** (was 384). Honest measure math: 440−32−52 = 356px ≈ 46ch of Hanken 15. Persist v1→v2 migration rewrites ONLY a stored 384 → 440; hand-chosen widths pass through. |
| D3 | Pane behavior per width | One card at every width, drag range 300–640 (max raised from 560 — BOTH clamp sites), render-clamped so the clear map strip never drops below 280px. No dual pane; the frame-plan seam (§4.1) is built so a future second pane is a slot addition, not a rework. Chosen on identity + scope grounds, NOT on the refuted "weeks-not-days" argument. |
| D4 | Nav chrome | Vertical liquid-glass rail at left:14, 64 wide, **vertically centered ~290px cluster** (4-tab capsule + detached Search orb below). Reuses `useTabBarModel()` ONLY — no TabBar component reuse, no `tabBarStore` height publication, no minimize/occlusion stores (coupling explicitly neutralized). Top-right map float (Locate · Layers · Activity bell · Profile) unchanged. |
| D5 | The card's home | `FeedBody` (the real Twitter feed), portrait-verbatim header: 32pt "Home" + coral New post pill + filter chips. `HeaderProfileButton` hidden in expanded (one avatar affordance: top-right float). |
| D6 | HomeSidebarBody | **Deleted** (file + its 7 private row clones + the `isHome` intercept at `ExpandedShell.tsx:93`). Jobs re-homed: search → Search view; create CTAs → rail Report tab + EventsBody "Host an event" pill; digests → Events view / Reports view / Messages tab / Search discovery. `AppPromoCard` re-homes to ExpandedShell's home slot. |
| D7 | Report wizard | Keep the 4-step upload-first `STEP_ORDER_EXPANDED` (unanimous). Root step gets portrait's **32pt tab-root header** via a `wizardHeaderMode` change keyed on `stepIndex === 0 && stack.length === 0` — **`backAffordance.ts` behavior is NOT touched** (its locked tests stay green; only prose comments update). Add web drag-and-drop onto the capture card with the coral `tokens.shadow.ring` dragover state. |
| D8 | Search | `SearchBody` gains an **expanded-only in-body field** directly under its existing 32pt "Search" title — the documented house pattern for expanded (ReportsBody.tsx:58-60 mirrors). Wired to `useNavStore.query` + `searchBarStore.pinned` + `searchRecentStore` (NEVER local state) so resting/focused/typing surfaces work verbatim. Rail orb press focuses it; `/` key focuses (web+expanded); Esc = clear → blur → `back()` only when stack non-empty. |
| D9 | `/map` deep link | Card (and resize handle) hidden; full-bleed map beside the rail; Map tab lozenge lit. `cardVisible = view !== "map" || active !== null`. Pin tap / long-press brings the card back with the detail. The empty `mapView` body never paints. |
| D10 | `/search` deep link | Search view with the field present but **not auto-focused** (auto-focus only on rail-orb entry). |
| D11 | List deep links (`/cleanups` `/people` `/reports` `/messages`) | **`seedFor` unified**: the four list kinds seed `{ view, stack: [] }` in BOTH modes (two-pane's graft). Kills the list-kind↔view duality; `pathForState`/`LIST_KIND_FOR_VIEW` round-trip already compatible (verified by two judges). Native tablets inherit the same (acceptable: same content, portrait-identical semantics). |
| D12 | List view roots | Every list view root shows its own large-title header in expanded: `EventsBody`/`MessagingListBody` already do; `ReportsBody` (and `SocialBody` if needed) change their header gate from `layout === "compact"` to `layout === "compact" || stack.length === 0`. |
| D13 | Composer presentation | Stacked in the card via `push({kind:"composer"})`, self-chromed (`" "` sentinel). Entry: feed New post pill (renders signed-in only), quote/reply entries, `/compose`. No modal, no second pane. |
| D14 | Back behavior | `backAffordance.ts` **unchanged** (expanded → always true; comment rewritten to cite the rail). View roots render no PanelHeader anyway, so no visible chip appears there; the wizard root chip is removed by D7's header-mode change, not by a back-rule change. |
| D15 | Orientation rule | **Unchanged** (`width >= height`, both copies: `useLayoutMode.ts:19` + `use-web-nav-adapter.ts:37-40`). Native tablets/rotated phones get the rail+card; the centered 290px rail cluster fits a rotated phone's ~365px usable height (verified arithmetic). Restate the two-copies warning in both files' comments. |
| D16 | Attribution offset fix | `--cf-occlusion-left` CSS custom property = the frame plan's single `occlusionLeft` output (90 + card width, or 90 when card hidden), written per-frame during drag from the pan handler (second consumer of the existing `Animated.Value` — no re-render, no release-snap teleport). `globals.css` attribution rule reads the var. Same value feeds `dropPinCamera` and `LocationPicker` centering. |
| D17 | Brand / About entry | The frosted brand pill STAYS in `MapControls`' landscape arm, shifted right of the rail (`left: RAIL_FOOTPRINT + theme.space["2"]`, a static offset — no width coupling, no teleport). It is visible in map mode (portrait parity: portrait's brand pill lives on the map view) and harmlessly under the card elsewhere (exactly today's z50 < z60 behavior). No wordmark in the feed header; no Baloo monogram anywhere. |
| D18 | Dev fake-data verification | New noindex route `WEB/app/landscape/` mounting the REAL `AppShell` (map + controls) under a nested `ApiProvider` with `makeFakeDataContext({auth: signed-in})` + `makeFakePostApi` seeds; `?signedout=1` variant. Modeled on `/bodies` + `home-shell.tsx` (~60-80 lines). |
| D19 | Motion | Rail-evolution's table wholesale (all existing tokens, single curve, passes `motion.test.ts` unchanged) + two-pane's principle: **the map itself never animates — it was always there.** |
| D20 | New tokens | **None.** New geometry constants live in the new pure shell module (§4.1); at most one new i18n key ("or drag photos here"); search placeholder reuses the existing nav-namespace key via `searchModeFor`. |
| D21 | Dead code cleanup | Delete `design.css` `.side-panel`/`.panel-*`/`.home-*` vocabulary + the `@media (max-width:720px)` block + `--sidebar-w`; fix the stale `TabBar.web.tsx:4-9` comment; rewrite the "landscape renders no dock" prose at `backAffordance.ts:106-109`, `wizardSteps.ts:158`, `tabBarStore.ts:5`. |

---

## 1. Concept

**Landscape civfix is the portrait dock stood upright beside the signature card.** The floating sand
card over the live map stays the one content surface — but it becomes the true surface host: the real
`FeedBody` timeline at home, a working search field on `/search`, every body it already hosts. The
missing global navigation arrives as the portrait dock rotated 90°: a slim vertical liquid-glass
capsule (Home · Map · Messages · Report) with the detached Search orb below it, floating at the left
edge in the exact glass vocabulary users know from their phone. The map remains the co-star — always
live, always visible — and gains its first genuinely map-first moment: the Map tab dismisses the card
and hands the whole viewport to the map. One card, one rail, one live map; same sand, glass, coral,
and single easing curve — arranged for wide screens instead of stretched from narrow ones.

---

## 2. Shell anatomy

### 2.1 Regions and z-ladder (landscape only; portrait byte-identical)

```
z0   map            full-bleed, always mounted + painted (AppShell.tsx:72,105 — unchanged)
z50  map controls   brand pill (left: 90 + space2) + top-right float (locate · layers · bell · profile)
z60  the card       floating sand panel: left:90, top/bottom:14, radius 24, bg colors.bg, shadows.s4
z61  resize handle  18px strip glued to the card's right edge (left origin 81, translateX(width))
z65  the rail       vertical glass capsule + orb, left:14, width 64, vertically centered cluster
z70  auth overlay   unchanged
```

z65 deliberately reuses the portrait dock's layer number (`bodyLayout.ts:201-205`) — the rail IS the
dock. Rail and card never overlap horizontally; the rail sits above the card's shadow spill.

### 2.2 The rail

All geometry constants live in the new pure module (§4.1), unit-tested, `postCardRhythm.ts` house
style (every derived value a function of the constants above it):

| constant | value | derivation |
|---|---|---|
| `RAIL_LEFT` | 14 | the shell's card-inset family |
| `RAIL_W` | 64 | `theme.glass.dock.height` (the portrait bar height, rotated) |
| `RAIL_GAP` | 12 | `DOCK_GAP` (`liquidGlassModel.ts`) — capsule↔orb gap AND rail↔card gap |
| `RAIL_FOOTPRINT` | 90 | `RAIL_LEFT + RAIL_W + RAIL_GAP` = the card's left edge |
| `RAIL_ITEM` | 48 | tab hit target (48×48, lozenge radius 24) |
| `RAIL_ITEM_GAP` | 4 | between tabs |
| `RAIL_PAD_V` | 8 | capsule top/bottom inset |
| capsule height | 220 | 8 + 48·4 + 4·3 + 8 |
| capsule radius | 32 | pill on a 64-wide capsule |
| orb | 58 Ø | `ORB_SIZE` (`TabBar.shared.tsx`), centered on the 64 column |
| cluster height | 290 | 220 + 12 + 58 — **vertically centered in the viewport** (fits a rotated phone's ~365px usable height) |

> Superseded by `expandedFramePlan.ts` (56/10/10) — the shipped rail metrics are `RAIL_ITEM` 56,
> `RAIL_ITEM_GAP` 10, `RAIL_PAD_H` 10.

- **Tabs, top→bottom:** Home · Map · Messages · Report — identical order, icons (`iconMap.Home`,
  `iconMap.Map`, `iconMap.MessageCircle`, `iconMap.MapPinPlus`) and i18n `tab.*` labels as
  `TAB_VISUALS` (`TabBar.shared.tsx:35-40`). Icons 24px, strokeWidth 2.4, color
  `theme.colors.textMuted` (the web dock's ink — selection is the lozenge, never a tint; parity
  correction #1 above).
- **Material:** `BlurSurface kind="dock"` (real `backdrop-filter: blur(48px) saturate(180%)` on web;
  fill `rgba(253,250,244,0.62)`, border `glass.dock.border`, top sheen). Shadow: the
  `glass.dock.shadow` spec via `coloredShadow`.
- **Selected tab:** ONE absolutely positioned 48×48 radius-24 lozenge filled `glass.dock.selected`
  (`rgba(33,27,19,0.10)`) that slides vertically between item centers (the vertical twin of the web
  pill, `tabBarLogic.ts:170-175` recipe). It appears on whichever of the FOUR tabs matches
  `railActiveView` (§4.2) and hides (opacity 0) when none matches — same as the web dock's
  `visible = activeIndex >= 0` behavior.
- **Hover:** the same lozenge shape at `opacity 0.6` under the hovered tab (no new color token).
  Press: `scale 0.94 + opacity 0.9` (GlassButton convention).
- **Search orb:** 58Ø `BlurSurface kind="dock"` circle, `iconMap.Search` at 22. Active state
  (`view === "search"` and empty stack): fill `glass.active.fill` (ink), icon `glass.active.icon`
  (card white) — the existing selected-map-button vocabulary, and the portrait orb's active
  treatment. Press when already on search: re-focus the field (§3.5).
- **a11y:** capsule = `accessibilityRole="tablist"` + `aria-orientation="vertical"`; items
  `accessibilityRole="tab"` with `accessibilityState={{selected}}`; orb a plain button; every
  target gets `focusRingProps` (coral ring, free). Add `dataSet: { civfixRail: "" }` →
  `data-civfix-rail` as the screenshot/e2e anchor.
- **Wiring:** `useTabBarModel()` (`TabBar.shared.tsx:63-84`) verbatim — pure store wiring, stable
  handlers. The rail does **NOT** import `TabBar.*`, does **NOT** publish to `tabBarStore`, and
  touches none of the minimize/occlusion/morph stores (theme-judge coupling flaw, neutralized by
  construction).
- Renders **only** in `ExpandedShell` (a sibling of the card inside the fragment, like the resize
  handle). Portrait untouched. Native tablets render through `BlurSurface.native` (expo-blur); no
  Skia, no reanimated. The lozenge slide on native may ship instant (position jump) in v1 — flagged
  in §8 verification; a spring can follow via `motionConfigs.native.ts` factories.

### 2.3 The card

Unchanged personality; three parameter changes:

- `styles.card`: `left: 90` (was 14). Everything else identical — `top/bottom 14`, `borderRadius 24`,
  `backgroundColor: theme.colors.bg`, `overflow: hidden`, `theme.shadows.s4`, z60.
- Resize handle: `left: RAIL_FOOTPRINT − 9 = 81` (was 5); still `translateX(animatedWidth)`, width
  18, grip 6×48, `RESIZE_STEP 24`, `webCursorColResize`, a11y adjustable — all unchanged.
- **New state `cardVisible`** from the frame plan: `view !== "map" || active !== null`. When false,
  the card + handle animate out (§5) with `pointerEvents: "none"` from frame 1; the card stays
  MOUNTED (no body remount, no map re-layout).

### 2.4 Sidebar width store (`UI/shell/sidebarStore.ts`)

```ts
export const SIDEBAR_DEFAULT_WIDTH = 440   // was 384 — D2
export const SIDEBAR_MIN_WIDTH     = 300   // unchanged
export const SIDEBAR_MAX_WIDTH     = 640   // was 560 — ONE cap, changed in BOTH clamp sites (correction #3)
export const MAP_MIN_CLEAR         = 280   // two-pane's MAP_MIN_STRIP as the guardrail

export function clampSidebarWidth(width: number, viewportWidth: number): number {
  const max = Math.min(SIDEBAR_MAX_WIDTH, viewportWidth - RAIL_FOOTPRINT - MAP_MIN_CLEAR)
  const min = Math.min(SIDEBAR_MIN_WIDTH, max)
  return Math.round(Math.min(Math.max(width, min), max))
}
```

- `setWidth`'s write clamp changes to the same `[300, 640]` absolute band (it currently hard-clamps
  to 560 — correction #3).
- Persist: version **1 → 2**, `migrate: (s) => ({ width: s.width === 384 ? 440 : s.width })` — only
  the exact old default is rewritten; a hand-chosen width survives. Cookie key
  `civfix.sidebar-width` unchanged.
- **Why 440:** the card's home is now a `PostCard` timeline; 440 leaves a text measure of
  440 − 32 (rowPaddingH) − 52 (avatar 40 + gutter 12) = **356px ≈ 46ch** of Hanken 15 — the honest
  readable-measure math (the only derivation all three judges' re-checks upheld). 384 leaves ~38ch,
  visibly cramped. Two-up media tiles land at 174px.
- Checkpoint table (default 440):

| viewport | rail col | card | drag range (clamped) | clear map | notes |
|---|---|---|---|---|---|
| 840 | 90 | 440 | 300–470 | 310 | smallest legal landscape; Map tab gives 1-tap full map; drag-to-300 gives 450 |
| 1024 | 90 | 440 | 300–640 | 494 | iPad landscape |
| 1280 | 90 | 440 | 300–640 | 750 | laptop; attribution + zoom clear |
| 1440 | 90 | 440 | 300–640 | 910 | reference desktop |
| 1920 | 90 | 440 | 300–640 | 1390 | width buys the map + an optional roomier card, never a second pane |

### 2.5 Map treatment & chrome

- Map: always mounted + painted (`AppShell` gates unchanged). In map mode it is the whole viewport
  minus the rail.
- **Top-right utility float unchanged** (positions and code path): Locate · Layers · Activity bell
  (coral unread dot outside the circle) · ProfileEntry / "Sign in" pill — today's best-known
  landscape affordance, kept per the parity judge's warning against silent relocation.
- **Brand pill:** stays in the landscape MapControls arm, `left: RAIL_FOOTPRINT + theme.space["2"]`
  (static — D17). Visible in map mode; under the card otherwise (today's behavior).
- maplibre `NavigationControl` (zoom) bottom-right; compact `AttributionControl` bottom-left with the
  dynamic offset: `WEB/app/globals.css` landscape rule becomes
  `.cf-shell .maplibregl-ctrl-bottom-left { left: calc(var(--cf-occlusion-left, 530px) + 14px); }`.
  The var is written by the web host (§4.5) from the frame plan: `90 + width` when the card shows,
  `90` when hidden; updated per-frame during a drag (D16). The portrait orientation media query is
  untouched.

### 2.6 Where the big four live

- **Search** → rail orb → Search view; field in the card (§3.5); `/` key focuses (web+expanded).
- **Composer** → the feed header's coral **New post** pill (`push({kind:"composer"})`), plus all
  existing quote/reply/thread entries and `/compose`.
- **Report** → rail Report tab (`selectView("report")`), plus the map long-press Drop-pin menu and
  report-detail CTAs.
- **Home** → `FeedBody` via the normal router; the `isHome` interception is deleted.

---

## 3. Surface-by-surface spec

Everything renders inside the card unless stated. "PanelHeader" = the existing 36px back chip ·
optional Home chip · 18px Hanken Bold title · pad 14/18/12 · hairline (`ExpandedShell.tsx:233-267`,
geometry untouched).

### 3.1 Home feed (`FeedBody`) — the headline fix

- The `isHome` interception (`ExpandedShell.tsx:93` + Body at `:280-293`) is removed; home renders
  `renderBody(null, "home")` → `VIEW_BODY.home = "feed"`. No PanelHeader (view root).
- **Header: portrait verbatim** — 32pt extrabold "Home" (`feed.title`), coral New post pill
  (`colors.accent` fill + white Megaphone 16 + label; the documented AA trade at
  `FeedBody.tsx:488-497`), filter chips All/Events/Fixes as `tablist`. ONE change:
  `HeaderProfileButton` hidden in expanded (D5) — implement inside `HeaderProfileButton` itself
  (`useLayoutMode() === "expanded" → null`) so the feed, search, and wizard tab-root headers all
  drop it with one change and portrait is untouched.
- **List:** the same virtualized FlatList — flat `POST_SURFACE` rows full-bleed to the card edges,
  web separator `tint(borderStrong, 0.45)` at 1px, hover fill `bgAlt` (already ships), infinite
  paging, `caught_up` footer, entrance animation gated by the existing tracker + reduce motion.
  `RefreshControl` left in place (inert with a wheel, harmless).
- **Widths:** at 300 the feed degrades like a small phone; at 640 media grids relax. No branch —
  `PostCard` is layout-agnostic.
- **Signed out:** 32pt "Home" + chips + the existing `FeedNotice` card ("Nothing here yet · Posts
  from your community will show up here. Sign in to share the first update."). The New post pill
  **does not render** (`showComposer: isAuthenticated` — correction #4). The top-right Sign in pill
  is the auth entry. Matches `portrait-390.png` 1:1.
- **AppPromoCard:** mounts from `ExpandedShell`'s home slot (absolutely pinned to the card bottom;
  it already self-gates to web-landscape and publishes its height). `FeedBody` adds
  `paddingBottom: promoHeight + 14` to its content container when expanded (the plumbing
  `HomeSidebarBody.tsx:156-168` used).

### 3.2 Composer (`PostComposer`)

- Entry: New post pill (signed-in), quote/reply/menu entries, `/compose`. First-class in landscape
  for the first time.
- Stacked in the card; `titleForEntry` returns `" "` so it draws its own chrome. The
  `windowHeight * 0.4` input cap ≈ 360px at 900-tall — fine.
- Create-from-composer: `planComposerCreateEvent` resolves to a stacked panel
  (`[composer, create-cleanup]`), `stackAfterComposerReturn` truncation unchanged — existing
  behavior, now reachable. Verify with the flow tests.
- Signed out: pill absent; `/compose` deep link renders the composer with the submit-time auth gate.

### 3.3 Report flow (`ReportFlowBody`) — D7

**Landscape keeps the 4-step upload-first wizard (`STEP_ORDER_EXPANDED`), intentionally** (unanimous
across proposals): desktop reality is camera-roll/file upload; the embedded-viewfinder objection in
`wizardSteps.ts:196-204` still holds at 440; and the review step's `AddressSearch` +
`LocationPicker mode:"main-map"` driving the live map beside the card is landscape's genuine
superpower — kept and polished.

- Entry: rail Report tab; Drop-pin "Report an issue here" (seeds location, `skipLocation`
  unchanged); report-detail CTAs.
- **Header (the internally consistent revision):** `wizardHeaderMode` gains an `atViewRoot`
  input derived as `stepIndex === 0 && stack.length === 0`. When true in expanded → `"tab-root"`
  (32pt "Report an issue" large title, no chip; `HeaderProfileButton` hidden per D5). All other
  states keep `"detail"` (18px title + back chip + the coral progress hairline) — so mid-flow Back
  works exactly as today. **`backAffordance.ts` behavior does not change** (D14): its expanded
  branch stays `return true`; only its comment (which claims the chevron is "the ONLY exit from the
  whole flow") is rewritten to cite the rail. `wizardSteps.ts:158`'s "landscape renders no dock"
  prose updates too. `wizardSteps` unit tests extend for the new input; `backAffordance.test.ts`
  and `expandedHomeButton.test.ts` stay untouched.
- **Capture step polish (web):** the cream "Capture the issue" card becomes a drag-and-drop target —
  `onDragOver` highlight = `tokens.shadow.ring` (coral 3px), drop = same path as "Choose from
  library". Caption row adds "or drag photos here" (`caption` variant, `textSubtle`; ONE new i18n
  key — run `i18n:check`).
- Review: inline location on the main map (camera centering via `occlusionLeft`, §4.5), mono
  coordinate echo, jurisdiction note, `FeedShareBlock` — unchanged.
- Signed out: wizard fully usable; submit hits the existing auth gate.

### 3.4 Map browse (`view === "map"`) — the `/map` fix (D9)

- Rail Map tab or `/map` → card + handle dismiss (180ms, §5) → full-bleed map beside the rail, Map
  lozenge lit. The empty `mapView` body never paints (resolves the `BodyRouter.tsx:132-136` TODO in
  the "the map IS the screen" direction).
- All map interactions work card-less: pin/cluster tap → `push`/`openDetail` per existing wiring
  (`home-map.tsx:211-218`) → stack non-empty → card returns (220ms) with the detail. Back pops to
  empty → card dismisses again. Symmetric. **The map itself never animates** — it was always there
  (D19).
- Long-press → `openDropPinMenu` → `push({kind:"drop-pin"})` → card returns with `DropPinBody`.
  `dropPinCamera.ts`'s expanded occlusion math switches to the frame plan's `occlusionLeft`
  (90 + live width; 90 while hidden) — §4.5.
- `pathForState` already emits `/map`; no adapter change. Signed out: identical.

### 3.5 Search — the `/search` fix (D8)

- Entry: rail orb (`selectView("search")` + focus request), `/` key (web+expanded, when no input is
  focused), `/search` deep link (no autofocus).
- **The field** is an expanded-only in-body row inside `SearchBody`, rendered directly under its
  existing 32pt "Search" large-title row (`SearchBody.tsx:337-343` — title rhythm preserved;
  `HeaderProfileButton` in that row hides in expanded per D5):
  - Field: height 40, radius 12, pad 14, gap 10 (the `SearchHeader.styles.ts` design literals),
    `colors.surface` fill, border 1px `tint(borderStrong, 0.45)` (web) / hairline `border` (native
    card surface), leading `iconMap.Search` 18 `textSubtle`, text 15 Hanken, placeholder from the
    existing nav-namespace key via `searchModeFor` (no new i18n), trailing 22px clear chip (`bgAlt`
    circle, X 12) when non-empty. Coral focus ring via `focusRingProps`. `webInputReset` applied.
  - **Wiring: `useNavStore.query` (`setQuery`) + `searchBarStore.pinned` on focus + 
    `searchRecentStore` on submit — NOT local state** — so SearchBody's three surfaces work
    verbatim: resting → discovery (Suggested people rail [auth-gated], Events in your area,
    leaderboard preview, Reports nearby); focused → Recently searched; typing → `SearchResults`.
    The exit-freeze machinery is compact-only and stays inert.
  - Focus request from the orb: add a `focusNonce` (or equivalent one-shot signal) to
    `searchBarStore`; the field consumes it in an effect. Deep links never set it.
  - Esc: clear query if non-empty → else blur → else `back()` **only when `stack.length > 0`**
    (fixes the rail-evolution spec fuzz).
  - Amend `SearchBody`'s header doc ("the input is shell chrome") with the expanded exception,
    citing the ReportsBody in-body precedent.
- Search discovery's "See all events" (`SearchBody.tsx:375` → `selectView("events")`) now lands on
  a **self-headed** events view root (§3.7 / D12) with honest rail state (no lozenge — events is
  not a rail tab; same as portrait's dock).
- The three in-body list search fields remain (per-list filters). `HomeSidebarBody`'s fourth
  bespoke search dies with it.
- Signed out: people rail hides (existing gate); everything else renders.

### 3.6 Detail pages

| surface | landscape treatment |
|---|---|
| Report detail (`pin`) | Card panel + PanelHeader; `useMapFocus` pans the live map beside it. |
| Post detail (`post`), saved posts (`saves`), cluster | Card panels, unchanged. |
| Post thread (`post-thread`) | Card, self-chromed: 52pt header + FlatList + docked `ReplyComposer` flex sibling. At 440 it reads like a 440-wide phone — correct. Keyboard-inset math inert on desktop; tablets use the existing path. |
| Person (`person`) | Card, self-chromed; keeps its own Back+Home chips (`PersonDetailBody.tsx:175-179`) — the converted-kind pattern, unchanged. |
| Drop-pin (`drop-pin`) | Card panel; camera offset via `occlusionLeft`. Not URL-addressable, as designed. |
| Media lightbox | `MediaLightboxProvider` overlay above the shell, unchanged — finally has desktop room. |

### 3.7 Events

- **List = the events VIEW root** (D11/D12): reached from search discovery, the feed's Events chip
  context, `/cleanups`, `/events`. `EventsBody` renders its own `EventsHeader` (already
  unconditional) with the "Host an event" pill and the expanded-only in-body search. No PanelHeader,
  no Back (rail is the exit; deep-linked users behave exactly like portrait's compact seeding).
  Where some flow still `push({kind:"cleanups"})`es a stacked list, it renders as today
  (PanelHeader "Events" + Back) — a drill-down with detail chrome is correct there.
- Event detail: card panel — RSVP, organizer + follow, going list, linked reports,
  `EventSlotsBlock`, `EventHoursBlock`, lifecycle regions; host sheets are centered
  `ModalCardSheet`s (correct on desktop).
- Host/edit: card panel; **`CleanupForm` keeps `pickMode: "main-map"`** — tap-to-place on the live
  map beside the card. Preserved on purpose.
- Signed out: public list renders; RSVP/host hit `requireAuth`. (The `land_events.png` error state
  is a no-backend artifact, not a design state.)

### 3.8 Messages

- Rail Messages tab → `selectView("messaging")` → `MessagingListBody` view root (its own
  `InboxHeader` + compose control render as-is — portrait tab-root parity).
- Conversation: card panel (`ConversationBody`'s expanded header branch exists). Groups, channels,
  members, pins, group info: card panels, unchanged.
- Signed out: existing `SignInPrompt`.

### 3.9 Notifications

- Entry: the Activity bell (top-right float, unchanged — D4) → `push({kind:"activity"})` →
  `NotificationsBody` panel; unread coral dot on the bell. Prefs gear → `notification-prefs`.
  `/notifications`, `/notifications/prefs` unchanged. Signed out: `SignInPrompt`.

### 3.10 Profile, service hours, leaderboard, certificates

- Entry: ProfileEntry avatar (top-right) → `profile` panel; person rows → `person`.
- Profile tabs, hours ledger, `ServiceHoursCertificateCard` (two-phase issue→open preserves the
  `window.open` user-activation), `LeaderboardBody` — all card panels, all existing. The
  discovery leaderboard preview becomes reachable via the fixed Search view.
- Signed out: avatar becomes the Sign in pill; `/profile` → `SignInPrompt`.

### 3.11 Settings & account

`language-settings`, `blocked`, `notification-prefs`, `verify`, delete-account modal, data export —
card panels / centered `ModalCardSheet`s, all reachable through profile. Unchanged.

### 3.12 Reports (mine) — the reports VIEW root

`ReportsBody` at the view root: change the `ReportsHeader` gate (`ReportsBody.tsx:135`) from
`layout === "compact"` to `layout === "compact" || stack.length === 0` (D12) so the 19px "Your
reports" section title renders; the expanded in-body filter field stays. Verify `SocialBody` (People)
the same way and apply the same gate if its title is compact-only. Signed out: the existing
sign-in gate card.

### 3.13 Auth

`AuthModal` at z70, centered ≤460 card over the scrim — unchanged, orientation-agnostic. Every gate
(`requireAuth`, `SignInPrompt`) keeps working; the top-right Sign in pill is the persistent
signed-out affordance.

---

## 4. Navigation model & architecture

### 4.1 The frame plan (the single source of truth)

New pure module `UI/shell/expandedFramePlan.ts` — no react-native imports, unit-tested at every
checkpoint width and view (mirrors `portraitShellPlan`, the house pattern the audit recommends):

```ts
export const RAIL_LEFT = 14, RAIL_W = 64, RAIL_GAP = 12
export const RAIL_FOOTPRINT = RAIL_LEFT + RAIL_W + RAIL_GAP  // 90
export const MAP_MIN_CLEAR = 280

export function expandedFramePlan(input: {
  view: View
  stackLength: number
  sidebarWidth: number       // already viewport-clamped
}): {
  cardVisible: boolean       // view !== "map" || stackLength > 0
  occlusionLeft: number      // cardVisible ? RAIL_FOOTPRINT + sidebarWidth : RAIL_FOOTPRINT
}

export function railActiveView(view: View, active: DetailEntry | null): View | null
// = active ? parentViewForEntry(active) ?? null : view
// lozenge lights only when result ∈ {home, map, messaging, report}; orb when result === "search".
```

Consumers: `ExpandedShell` (card visibility + transitions), the rail (active state), the web host
(`--cf-occlusion-left`), `dropPinCamera.ts`, `LocationPicker` main-map centering. One tested place;
the 384px-hardcode bug class dies here (two-pane's graft, merged into rail-evolution's module).

### 4.2 Verbs and panes — unchanged

`push` appends, `openDetail` replaces, `selectView` clears the stack — untouched
(`useNavStore.ts`). The card renders `stack.top` via `BodyTransition` exactly as today. The rail
adds the missing `selectView` callers via `useTabBarModel()`. Re-tap of a lit tab keeps
`selectView`'s existing re-tap rule.

### 4.3 Deep links (the contract)

| URL | landscape result |
|---|---|
| `/` | card: FeedBody home |
| `/map` | **card hidden, full-bleed map, Map lozenge lit** (was: empty headerless card) |
| `/search` | **card: 32pt Search + field (unfocused) + discovery** (was: input-less) |
| `/report` | card: wizard step 1 with the 32pt tab-root header, Report lozenge lit |
| `/compose`, `/compose/quote/:id` | card: composer stacked over home |
| `/cleanups` `/events` | **events view root** (D11 — was: stacked panel) |
| `/people` | social view root |
| `/reports` | reports view root |
| `/messages` | messaging view root, Messages lozenge lit |
| `/pin/:id`, `/post/:id[/thread]`, `/people/:id`, `/cleanups/:id`, `/messages/{dm\|report\|group}/:id`, `/saves`, `/notifications[/prefs]`, `/profile`, `/leaderboard/:geoid`, `/host`, `/verify` | card panels stacked over the seeded view (existing detail seeding; Back pops to the feed) |

Implementation: `seedFor`'s expanded branch for the four `viewForEntry` list kinds changes to the
compact behavior `{ view, stack: [] }` (`routes.ts:433-435`); everything else untouched.
`pathForState` / `LIST_KIND_FOR_VIEW` already round-trip (verified twice). Update
`nav/__tests__/nav.test.ts` fixtures. The web adapter's `liveMode()` duplicate stays in step because
the orientation rule is untouched (D15).

### 4.4 Back behavior (D14)

`backAffordance.ts` behavior **unchanged**: expanded → always `true`. This manifests only where a
header consults it — stacked entries' PanelHeader (correct: Back is the way out of a panel) and the
wizard (whose root now renders the chip-less tab-root header via D7, and whose mid-flow steps keep
the chevron via `stepIndex > 0`). View roots draw no PanelHeader, so no phantom chip. The Home chip
rule (depth > 1) is untouched; `expandedHomeButton.test.ts` / `backAffordance.test.ts` stay green
with zero fixture churn. Comments citing "no dock" are rewritten (D21).

Esc (web, expanded): handled in the shell — if a text input is focused, ignore (except the search
field's own clear-then-blur, §3.5); else if `stack.length > 0`, `back()`; else no-op.

### 4.5 Occlusion plumbing (D16)

- `ExpandedShell` (web arm) writes `--cf-occlusion-left` on the `.cf-shell` element: from the frame
  plan on state changes, AND directly inside the resize `onPanResponderMove` (one
  `style.setProperty` per frame alongside the existing `Animated.Value` write — no re-render, no
  release snap). On card hide/show the var animates via the same 180/220 pair (CSS transition on
  the maplibre rule is acceptable, or stepped with the card's transition — implementer's choice,
  verify visually).
- `WEB/app/globals.css` landscape attribution rule reads the var (fallback `530px` = 90 + 440).
- `UI/map/dropPinCamera.ts` expanded branch and `LocationPicker` main-map centering take
  `occlusionLeft` (plumbed from the frame plan through their existing width parameters).

---

## 5. Motion spec

Vehicle: plain CSS transitions via `cssTransition`/`cssTransitionParts`, single curve
`cubic-bezier(0.22,1,0.36,1)`. **No new motion tokens** — every animation reuses an existing recipe;
`theme/__tests__/motion.test.ts` passes unchanged. Signature principle: **the map never animates —
it was always there.**

| name | what | recipe (reused token) | notes |
|---|---|---|---|
| card-hide | entering bare-map state | opacity 1→0 + translateX(0→−24px), **180ms** (`sheetDismiss`) | `pointer-events: none` from frame 1; handle rides the same clock; DOM kept mounted |
| card-show | leaving bare-map / entry pushed | opacity 0→1 + translateX(−24→0), **220ms** (`bodyPush`) | exit 180 ≤ entrance 220 ✓, both in the tested bands ✓ |
| rail-mount | shell first paint | opacity + scale 0.92→1, **250ms** (`glassIn`) | plays ONCE at shell mount, never per navigation |
| rail-pill | lozenge slides between tabs | translateY between item centers + opacity, **220ms** (`tabPill`) | vertical twin of `tabPillTransition`; opacity 0 when no tab matches |
| orb-select | orb ink fill | background-color, **120ms** (`webTransition`) | |
| body swap | in-card push/pop/replace | existing `BodyTransition.web`: 220 slide / 140 exit / 160 replace | untouched, header-inside-transition invariant kept |
| search-surface | discovery↔recents↔results | 160ms crossfade (`bodyReplace`) | inside SearchBody, existing |
| hover | rail items, rows, pills, glass buttons | 120ms `webTransition` (opacity, background-color, transform) | rail lozenge-at-0.6; PostCard `bgAlt` and GlassButton 0.94 already exist |
| press | rail items + orb | scale 0.94 + opacity 0.9 (GlassButton convention), 120ms | |
| focus | search field, chips, rail | coral ring via `[data-focus-ring]:focus-visible` | zero-duration, correct |
| drag-resize | the handle | transitions disabled during drag (Animated.Value 1:1, existing); no settle animation | occlusion var written per frame |

Reduced motion: `prefersReducedMotion()` drops the slide channels (card-hide/show become pure
opacity per the `bodyTransitionModel` WCAG rule), the lozenge jumps, `globals.css` zeroes durations
globally. Native tablets use `motionConfigs.native.ts` factories (JS-thread-only rule respected).

Verification note (polish judge): card-hide slides −24px toward the rail while fading — confirm via
screenshot that the fading card never reads as colliding with the rail; if it does, flip the slide
direction to +24px (both stay in-contract).

---

## 6. Theme application

| region | tokens |
|---|---|
| card | `colors.bg` (sand), radius 24, `shadows.s4` — untouched signature |
| rail + orb | `glass.dock` fill/border/sheen (BlurSurface web+native), `glass.dock.selected` lozenge, `glass.active` ink/card for the active orb, `glass.dock.shadow`; icons `textMuted` at 24/2.4 |
| icons | `iconMap` only (`lucide-react-native/icons` subpath): Home, Map, MessageCircle, MapPinPlus, Search, Navigation, Layers, Bell |
| New post pill | `colors.accent` fill + `neutral.card` text/icon (documented AA trade); **any coral TEXT anywhere uses `accentText` #B03A2C** |
| hairlines | on-sand rules `borderStrong`, lightened on web with `tint(borderStrong, 0.45)` at 1px; on-card surfaces keep `border` |
| type | Hanken Grotesk everywhere on web (display aliases remap); 32/800 tab-root headings (Home, Search, Report an issue, inbox), 18/700 panel titles, 15/400 body, JetBrains Mono for coordinates/certificates; Baloo 2 only in the Brand pill wordmark |
| search field | `colors.surface` fill, radius 12, h 40 (SearchHeader design literals), placeholder `textSubtle`, ring `shadow.ring` |
| unread dot | `colors.accent`, outside the GlassButton circle (existing badge convention) |

**New tokens: none.** New constants: the `expandedFramePlan.ts` geometry set (§4.1) — shell literals
in the ExpandedShell tradition — plus `MAP_MIN_CLEAR` and the `--cf-occlusion-left` CSS custom
property in the web host. New i18n: exactly one key ("or drag photos here"); rail labels reuse
`tab.*`; the search placeholder reuses the nav-namespace key.

Cleanups shipped with this design (D21): delete `HomeSidebarBody.tsx`; delete dead `design.css`
sidebar vocabulary (`.side-panel`, `.panel-*`, `.home-*`, the `@media (max-width:720px)` block,
`--sidebar-w`); fix the stale `TabBar.web.tsx:4-9` comment; fix `globals.css`'s hardcoded
`calc(384px + 28px)`; rewrite the three "no dock" prose sites.

---

## 7. Risk notes (with owners in the workstreams)

1. **"The card can be absent" is the most cross-cutting change.** Mitigation: `expandedFramePlan` is
   the single tested source of `cardVisible`/`occlusionLeft`/`railActiveView`; all consumers read
   it; unit tests at every checkpoint width × view.
2. **Map claustrophobia at 840** (440 card → 310px map). Accepted with mitigations: drag-to-300, the
   one-tap Map tab, and the clamp guard (`MAP_MIN_CLEAR 280`). If tablet feedback bites, a follow-up
   clamps the *default* (never a stored width) below 1024 — noted, not shipped.
3. **`FeedBody` inherits landscape duties** (promo padding, hover, no soft keyboard). The header
   change is one gate inside `HeaderProfileButton`; everything else is already layout-agnostic per
   the gap audit. Verified in the `/landscape` fake-shell route.
4. **seedFor unification changes native-tablet deep-link behavior** (list URLs land on view roots
   instead of stacked panels). Accepted: same content, portrait-identical semantics, and D12
   guarantees a header. Covered by nav unit tests + an iPad sim pass before release.
5. **Native tablets get the rail sight-unseen.** BlurSurface native is proven (portrait dock); the
   lozenge slide may ship instant on native v1. iPad + rotated-phone sims are in the verification
   matrix; the 4-step wizard decision applies there and goes in release notes.
6. **Losing the old sidebar's "Host an event" one-click prominence.** Parity preserved (Events view
   pill, composer +New event, drop-pin, report detail). If analytics dip, add a hosting card to
   Search's resting discovery — no shell change.
7. **Two copies of the orientation rule** stay in lockstep only because neither changes. Restate the
   warning in both files' comments (D15).
8. **Rollout mechanics:** revert the `link:` pnpm overrides before any PR (CI uses
   `--frozen-lockfile`); run `pnpm --filter @civfix/ui build` after any public-type change;
   `i18n:check` for the new key; the attribution CSS-var change and the rail must land in the same
   release or the attribution sits under the card.
9. **Esc/`/` key handlers** must never fire while a text input is focused (except the search field's
   own Esc ladder). Implement with a focused-element guard in one place (the shell key handler).

---

## 8. Implementation workstreams

Six workstreams. WS1 is the foundation; WS2/WS5 depend on it; WS3 is parallel after WS1's
ExpandedShell edits; WS4 follows WS2+WS3; WS6 is independent; WS7 starts early (the route) and
closes last (the matrix). Each workstream ends with `pnpm --filter @civfix/ui typecheck && test &&
lint && i18n:check` green and, where web files change, `pnpm typecheck && build` in civfix-web.

### WS1 — Frame plan, width store, card geometry (foundation)
- NEW `UI/src/shell/expandedFramePlan.ts` (+ `UI/src/shell/__tests__/expandedFramePlan.test.ts`):
  constants, `expandedFramePlan`, `railActiveView` (§4.1).
- `UI/src/shell/sidebarStore.ts`: DEFAULT 440, MAX 640 in BOTH clamps, `MAP_MIN_CLEAR` guard in
  `clampSidebarWidth`, persist v2 + migrate (§2.4). Update `shell/__tests__/sidebarStore.test.ts`.
- `UI/src/shell/ExpandedShell.tsx`: card `left: 90`, handle origin 81, `cardVisible` state +
  card-hide/show transitions (web CSS via `motionCss.ts`), promo-card home slot (mount point only;
  wiring in WS3).
- Exports: add new module to `shell/index.ts` if consumed by the host.
- Depends on: nothing. Blocks: WS2, WS3, WS5.

### WS2 — The rail
- NEW `UI/src/shell/Rail.tsx` (shared; BlurSurface material; CSS pill transition through the RNW
  pass-through on web, instant on native v1): capsule + 4 tabs + orb, `useTabBarModel()` wiring,
  `railActiveView` state, hover/press/focus states, a11y roles, `data-civfix-rail`.
- `UI/src/shell/ExpandedShell.tsx`: mount the rail as a card sibling.
- `UI/src/map/MapControls.tsx`: brand pill `left: RAIL_FOOTPRINT + space2` (landscape arm only).
- Comment fixes: `TabBar.web.tsx:4-9`, `backAffordance.ts:106-109`, `tabBarStore.ts:5`.
- Depends on: WS1. Blocks: WS4 (orb focus).

### WS3 — Home feed + routing unification
- `UI/src/shell/ExpandedShell.tsx`: delete the `isHome` intercept + `Body`'s `HomeSidebarBody`
  branch; wire `AppPromoCard` into the home slot.
- DELETE `UI/src/bodies/HomeSidebarBody.tsx` (and its orphaned i18n keys if `i18n:check` flags).
- `UI/src/shell/HeaderProfileButton` (wherever it lives, grep `HeaderProfileButton`): return null in
  expanded (D5).
- `UI/src/bodies/FeedBody.tsx`: expanded promo bottom padding.
- `UI/src/nav/routes.ts`: `seedFor` list-kind unification (§4.3); update `nav/__tests__/nav.test.ts`.
- `UI/src/bodies/ReportsBody.tsx` (:135) + `SocialBody.tsx` (verify): view-root header gate (D12).
- Depends on: WS1 (ExpandedShell sequencing). Blocks: WS4.

### WS4 — Search
- `UI/src/bodies/SearchBody.tsx`: expanded-only field row under the title (§3.5), wired to
  `useNavStore.query` + `searchBarStore` + `searchRecentStore`; doc amendment; hide the title row's
  profile affordance in expanded (may fall out of WS3's HeaderProfileButton change).
- `UI/src/shell/searchBarStore.ts`: `focusNonce` one-shot signal; orb press sets it (WS2 handler).
- Web key handlers (`/` and Esc) in the shell's web seam or `WEB/components/home/home-shell.tsx`,
  with the focused-input guard (§7.9).
- Depends on: WS2 + WS3.

### WS5 — Map mode consumers + occlusion plumbing + dead-code deletion
- `WEB/src/components/home/home-shell.tsx` (or a small hook): subscribe to the frame plan/store and
  write `--cf-occlusion-left`; per-frame write from the ExpandedShell pan handler (D16).
- `WEB/src/app/globals.css`: attribution rule → the var; delete the hardcoded 384 rule.
- `UI/src/map/dropPinCamera.ts` + `UI/src/map/LocationPicker.web.tsx`: occlusion-based centering.
- `WEB/src/styles/design.css`: delete `.side-panel`/`.panel-*`/`.home-*`/`@media (max-width:720px)`/
  `--sidebar-w` blocks (zero TSX refs, verified).
- Depends on: WS1.

### WS6 — Report wizard polish
- `UI/src/report/wizardSteps.ts`: `wizardHeaderMode(mode, showBack, atViewRoot)` (or equivalent
  derivation), comment rewrite at :158; extend its unit tests.
- `UI/src/bodies/ReportFlowBody.tsx`: derive `atViewRoot = stepIndex === 0 && stack.length === 0`,
  render the tab-root header in expanded at the root; web drag-and-drop on the capture card with the
  `tokens.shadow.ring` dragover state + "or drag photos here" caption (ONE new i18n key across all
  locale files; run `i18n:check`).
- Depends on: nothing (parallel). The rail (WS2) is what makes the chip-less root navigable — land
  WS6 after WS2 in release order.

### WS7 — Verification harness + screenshot matrix (start early, close last)
- NEW `WEB/src/app/landscape/page.tsx` + `layout.tsx` (noindex) + 
  `WEB/src/components/dev/landscape-preview.tsx`: mounts the real `AppShell` (map + controls) under
  nested `ApiProvider` = `makeFakeDataContext({ auth: signed-in })` with `makeFakePostApi` seeds +
  `CapabilitiesProvider` = `makeFakeCapabilities()`; `?signedout=1` variant. (~60-80 lines, modeled
  on `bodies-gallery.tsx:1411-1440` + `home-shell.tsx`.)
- Run the §9 checklist with headless Chrome (SwiftShader flags, per `notes/web-host-verify.md` §6):
  840×630, 1024×768, 1280×832, 1440×900, 1920×1080, plus 430×932 portrait regression. Anchors:
  `data-civfix-rail`, `data-civfix-panel-heading`, `data-gallery`.
- Depends on: the route needs nothing; the matrix needs WS1–WS6.

---

## 9. Definition of polished (screenshot-verifiable checklist)

A verifier with the dev server + headless Chrome must be able to check every line. R = real `/`
(signed out), F = `/landscape` fake signed-in route.

**Shell & rail**
1. [R,1440×900,`/`] Rail visible at left: 64-wide glass capsule with 4 icon tabs + detached orb
   below, vertically centered; lozenge under Home; map texture visible THROUGH the rail (blur).
2. [R] Card at x=90, width 440 (no cookie), radius 24, sand fill, s4 shadow; resize grip visible at
   its right edge.
3. [R] Top-right float: Locate · Layers · Bell · Sign-in pill, unchanged positions.
4. [R] maplibre attribution bottom-left sits at x ≈ 544 (90+440+14), NOT under the card; zoom
   control bottom-right.
5. [R] Drag the handle to ~560, release, reload: width persists; attribution followed the drag LIVE
   (no snap on release).
6. [R,840×630] Card clamps ≤470; clear map strip ≥ 280px; nothing overlaps the rail.
7. [R,1920×1080] Card still 440 by default; drag reaches 640 and no further.
8. [R] Keyboard: Tab reaches every rail item and the orb; coral focus ring renders; rail announces
   as a vertical tablist.

**Home feed**
9. [F,`/landscape`] Feed renders in the card: 32pt "Home", coral New post pill, All/Events/Fixes
   chips, seeded PostCard rows with 1px lightened separators; NO profile avatar in the header (the
   avatar exists only top-right).
10. [F] Row hover fills `bgAlt`; New post pill hover dims to 0.94; pill press opens the composer
    stacked in the card (its own chrome, no PanelHeader).
11. [R signed out] "Home" + chips + the "Nothing here yet" notice; NO New post pill anywhere; promo
    card pinned at the card bottom without covering the notice.
12. [Both] No trace of the old sidebar (no "Report an issue"/"Host an event" CTA pair, no in-card
    logo header).

**Map mode**
13. [R,`/map`] NO card, NO handle: full-bleed map + rail (Map lozenge lit) + top-right float + brand
    pill visible at x ≈ 98; attribution at x ≈ 104.
14. [R] From `/map`, click a pin: card slides in (~220ms) with the report detail + PanelHeader Back;
    Back dismisses the card again (~180ms); the MAP ITSELF never moves or flickers during either.
15. [R] Long-press (or right-click-hold) the map in map mode: card returns with the Drop-pin menu;
    the dropped pin is centered in the CLEAR map area (right of the card), not under it.

**Search**
16. [R,`/search`] 32pt "Search" + a 40px field UNDER it (surface fill, radius 12, search icon,
    placeholder), NOT focused; discovery sections below (no people rail signed out).
17. [F] Orb press from Home: search view opens with the field FOCUSED; typing filters live
    (`SearchResults`); clear chip appears; Esc clears, second Esc blurs; `/` from the feed focuses
    the field.
18. [F] "See all events" in discovery lands on an events list WITH its own header + "Host an event"
    pill; rail shows NO lit lozenge there (honest state).

**Report wizard**
19. [R,`/report`] Step 1 shows a 32pt "Report an issue" tab-root header with NO back chip; Report
    lozenge lit; the cream capture card renders.
20. [R] Advance to step 2 (add a photo or continue): the 18px detail header WITH back chevron + the
    coral progress hairline appears; Back walks steps, never exits to a dead end.
21. [R] Drag a file over the capture card: coral ring highlight appears; "or drag photos here"
    caption is present (in every locale — `i18n:check` green).

**Deep links & lists**
22. [R] `/cleanups` → events view root (own header, no Back, no lozenge); `/messages` → inbox with
    InboxHeader + Messages lozenge; `/reports` → "Your reports" title over the signed-out gate;
    `/people` → people list with a visible title.
23. [F] `/pin/<seeded-id>` → report detail panel with Back; Back lands on the feed.
24. [R] `/compose` → composer in the card with its own exit affordance.

**Motion & regression**
25. [R] With `prefers-reduced-motion`: no slides anywhere (card hide/show = fade only; lozenge
    jumps); with motion on, no transition visibly exceeds ~260ms.
26. [R,430×932] Portrait is PIXEL-IDENTICAL to the baseline screenshots (feed, dock, orb — no rail,
    no landscape artifacts).
27. [suite] `pnpm --filter @civfix/ui test` green including `motion.test.ts`,
    `backAffordance.test.ts`, `expandedHomeButton.test.ts` (both UNMODIFIED), the new
    `expandedFramePlan.test.ts`, updated `sidebarStore.test.ts` + `nav.test.ts` + wizard tests.
28. [hygiene] Zero references remain to `HomeSidebarBody`; `design.css` dead blocks gone; grep for
    `384` finds no live layout literal in `globals.css`.
