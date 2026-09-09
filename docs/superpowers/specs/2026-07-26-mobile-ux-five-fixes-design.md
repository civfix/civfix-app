# Mobile UX: five fixes — inline replies, drop-pin camera restore, in-tab report camera, search exit motion, reports-nearby rows

Date: 2026-07-26
Status: approved (design), not yet planned or implemented
Repos touched: `civfix-shared` (`@civfix/ui`), `civfix-mobile`

---

## Scope

Five independent workstreams, requested together. They share no state and can ship in one
`@civfix/ui` minor. Four of the five land entirely in `@civfix/ui`; workstream 3 also touches
`civfix-mobile`.

| # | Workstream | Primary repo |
|---|---|---|
| 1 | Inline "Show replies" in a post thread (X parity) | `civfix-shared` |
| 2 | Restore the map camera when the drop-pin pull-up is dismissed | both |
| 3 | Camera embedded in the Report tab; navbar visible for the whole flow | both |
| 4 | Smooth the transition when leaving Search | `civfix-shared` |
| 5 | Reports-nearby rows show the report photo + location | `civfix-shared` |

**Cross-cutting:** none of the thread files, and none of `PortraitMapPickStep`, have
`.native.tsx`/`.web.tsx` splits. Workstreams 1 and 3 therefore **ship to `civfix-web` too** on the
same `@civfix/ui` version. This is accepted, not an oversight. Release is a `@civfix/ui` publish +
consumer bumps + an EAS build (0.x caret ranges exclude new minors, so consumer bumps are
mandatory — see `civfix-cross-repo-feature-release-flow`).

---

## Workstream 1 — Inline "Show replies"

### Problem

Tapping "Show N replies" on a reply while already inside a post thread pushes a brand-new
full-screen thread page. `ThreadReplyRow.tsx:180` calls `push({kind: "post-thread", id: post.id})`;
`MobileNavAdapter.tsx:225-232` bridges that entry out to `router.push("/post/[id]")`, which mounts a
second `PostThreadBody` and slides in from the right (root Stack default `slide_from_right`).

### What X actually does (researched, and it is not what "nested replies" implies)

X shipped indented, branching reply threading in Feb 2020 and **killed it in Dec 2020** — Twitter
Support: the layout "wasn't it, as it was harder to read and join conversations." The current model:

- **Zero indentation.** A nested reply sits at the *identical* left gutter as a top-level reply.
- Each top-level reply is a **module** (`displayType: "VerticalConversation"`) holding that reply
  plus a short *linear chain* of descendants — a chain, not a tree; X picks one path.
- Hierarchy is carried by exactly two signals: **grouping**, and a continuous ~2pt **threadline**
  through the avatar column linking parent to child. It never branches or steps right.
- **No row hairline between chained rows inside a module** — the threadline replaces it. That
  absence is what reads as "these belong together." Hairlines separate modules.
- In-module "Show replies" is a **cursor**, not a link: it expands in place. Tapping the *reply row
  itself* is what navigates, promoting that reply to focal post.
- Expansion is a plain list append: **no scroll compensation, no auto-scroll, no highlight**. The
  focal post and the scroll offset do not move; content grows downward.
- Uniform ~40pt avatars at every level (X does not shrink nested avatars). The "Show replies" row is
  left-aligned to the **text column** (~68pt), in link blue, no chevron.

Confidence note: the in-module expand-vs-navigate behavior is ~75% confident from API structure
(`cursorType: "ShowMore"` scoped inside the module) and from a userscript that clicks these buttons
in a loop on the same page. Everything else is well corroborated. This is the one item worth
device-verifying if it ever looks wrong.

### Design

Splice a reply's direct children into the **same** `FlatList`, directly beneath it, at the same left
gutter, joined by a threadline through the avatar column.

- `PostThreadBody` gains a **row-type union** — `reply | nested | show-more | loading` — flattened
  into the one list. Never a nested `FlatList` (RN warns and breaks measurement).
- `buildThreadRailPlan` is index-positional over a flat ASC list (`rails[index]`, consumed at
  `PostThreadBody.tsx:114-117, 221`) and its doc relies on that ordering being stable under paging.
  Splicing children silently misaligns every rail below the insertion. Replace with a new pure
  `buildThreadRows(items, expandedIds, childrenById)` beside it in `threadModel.ts`, unit-tested
  like its neighbours.
- **No scroll compensation** — matches X, and avoids needing a helper that does not exist here.
- **Inline depth cap: 2 levels below the focal post.** Numbering the focal post depth 0 and its
  direct replies depth 1: expanding a depth-1 reply splices its children inline at depth 2. A
  depth-2 reply's "Show replies" **navigates** to that reply's permalink instead of expanding —
  which is exactly how X reaches depth. Bounds the N+1 (below) at two expanded queries per branch.
- Tapping a reply **row** still navigates. `/post/[id]` and the `/post/:id/thread` web route stay —
  deep links and share links depend on them. Do **not** remove the `MobileNavAdapter` bridge.
- The reply row's **comment glyph** (`ThreadReplyRow.tsx:171`) stops navigating and re-aims the
  docked composer at that reply, with a "Replying to @x" bar. `ComposerModeBar` is already wired via
  `threadFocalExcerpt` (`ReplyComposer.tsx:430`), and the draft store is already keyed by target id,
  so only the prop and the mode-bar copy change. Today the glyph and "show replies" do the same
  push, which makes them indistinguishable; inline expansion forces them to mean different things.
- Expansion is **local component state**, reset when the thread unmounts. Nothing in the codebase
  persists per-row UI state, and X's expansion is one-way for the session anyway.
- Android hardware back / iOS swipe-back **do not** collapse an expansion — they leave the thread,
  unchanged. Inline expansion is not a nav level.

### Data

No backend change. `usePostReplies(childId)` works today: `queryKeys.postReplies(id)` is per-parent
under the `["posts"]` prefix, so `patchPostInListCaches` already reaches every replies list, and
`useCreatePost`'s reply branch already appends to `postReplies(replyToId)` and bumps the parent's
`counts.replies` in both the list caches and the `post(parentId)` detail.

Cost: one `usePostReplies` infinite query per expanded row — N+1, bounded by the depth cap. A
subtree endpoint is possible later (`posts.thread_root_id` and the partial index
`posts_thread_root_idx` already exist) but is a four-repo release and is **out of scope**.

### Copy

`show_replies_one/_other` exists in all four locales (`home-feed.json:64-65`). A collapse label
("Hide replies") does **not** exist and must be added to en/es/de/ko.

### Risks

- **Optimistic reply placement.** `PostThreadBody`'s `sentReplies` local tail and its `scrollToEnd`
  assume every new reply belongs at the bottom of one flat list. A reply composed against an
  expanded child belongs under that child.
- **Scroll host is fragile.** `PostThreadBody`'s header documents that `PLAIN_SCROLL_HOST` and
  `minHeight: 0` are load-bearing (rn-web flex shrink; the keyboard-aware host's `revealFocused`
  reads a global focused input that is the docked composer, outside the list). Do not restructure
  the list/composer relationship.
- **Stale code in the blast radius, do not "fix" by accident:** `PostThreadBody.tsx:93-97` claims
  `PostDTO` has no `replyTo` and runs a second `usePost(replyToId)`. The backend populates
  `replyTo` now (`post-repository.drizzle.ts:572`), so that query is redundant. Harmless; note it,
  leave it, or remove it deliberately.
- `PostDetailBody.tsx` is unreachable on mobile (nothing pushes `{kind: "post"}`; `/post/[id]`
  renders `PostThreadBody`). Its "View conversation" pill is not the screen in question.

---

## Workstream 2 — Restore the map camera on drop-pin dismiss

### Problem

`onLongPressMap` (`civfix-mobile/apps/community-mobile/app/index.tsx:471-513`) opens the pull-up and
then flies the camera to a south-shifted centre at `zoom = max(currentZoom, 17)`. **The pre-press
viewport is never captured.** The handler already reads `useMapViewport.getState().viewport` at :489
— for the zoom floor only — and discards the centre. When the fly settles,
`acknowledgeMapSettlement` overwrites `mapLifecycle.lastViewport` with the drop-pin camera and
`rememberMapViewport` persists it, so afterwards there is no record of where the user was. Every
dismissal leaves the camera parked on the pin. No restore helper exists anywhere in the monorepo.

### Decisions

- **Restore on dismissal only**: Cancel, sheet drag-down, content drag, tapping the map, Android
  hardware back.
- **A pan or zoom while the menu is open cancels the restore.** The strip of map above the MID sheet
  is live and pannable; moving it is deliberate and must be respected.
- **"Report an issue here" and host-an-event do not restore.** Those are commitments to the
  location.

### Design

1. **Snapshot** in `onLongPressMap`, before the `flyTo` at :510, from
   `useMapViewport.getState().viewport`. Guard on there being no `drop-pin` entry on the stack yet —
   `"drop-pin"` is not a `FLOW_KIND`, so a second long-press while the menu is open re-runs the
   whole handler and would otherwise overwrite the snapshot with the first fly's camera.
2. **Restore** from `armDropPinCleanup` (`map/dropPinFlow.ts:54-61`) — the single subscription that
   already fires exactly once when the drop-pin entry leaves the stack, covering every dismissal
   route including the ones that never enter `DropPinBody` (drag, map tap, Android back).
3. The shared package **must not touch the camera** (`dropPinCamera.ts:64-68`, "THE HOST OWNS THE
   CAMERA"). The flow module calls a host-registered callback, mirroring `setCameraNavigator`.
4. Pure math and the snapshot type live in `map/dropPinCamera.ts` beside `dropPinCameraTarget`, so
   they are unit-testable alongside the existing `map/__tests__/dropPinCamera.test.ts`.
5. Pan detection: compare the viewport at dismiss time against the snapshot's expected post-fly
   camera. If it differs beyond a tolerance, the user moved the map — skip the restore.

### Risks

- **Argument order.** The host's `flyTo` is `(lng, lat, zoom)` (`index.tsx:267`, warned at :508-510)
  while `MapHandle.flyTo` is `(lat, lng, zoom)` (`map/types.ts:140`). Copying the wrong one flies to
  the transposed coordinate silently.
- **Publish-then-dismiss trap.** `stackAfterFlowPublished` truncates only up to the topmost FLOW
  kind, so publishing an event from a drop pin leaves the stack as `[drop-pin, cleanup]` —
  `CreateCleanupBody.tsx:357` clears the pin manually *precisely because* the subscription will not
  fire. Dismissing that event sheet later empties the stack; a naive "drop-pin left the stack →
  restore" rule would yank the camera off the event just created.
- **Generation race.** The restore must go through `beginMapRequest`/host `flyTo`
  (`index.tsx:259-279`), not `MapHandle.flyTo` directly, or a concurrent Locate/detail request
  clobbers it (or it clobbers a newer legitimate move).
- **Double-fire.** `collapseToParent` is reachable from four routes. The store action is idempotent;
  the restore hung off it must be too.
- **Timing.** The store drops the detail synchronously but the card keeps sliding for
  `theme.motion.sheetDismiss` (~180ms). Firing on the store event moves the camera under a card
  still on screen; firing on `onClosed` costs 180ms of dead time. Pick one deliberately.
- **Source fidelity.** `useMapViewport.center` is the arithmetic bbox midpoint, not the Mercator
  camera centre — exact enough at z17, drifts at low zoom. `mapLifecycle.lastViewport` can be stale
  while an unmatched `inFlightTarget` is outstanding.
- **Web parity.** `dropPinCameraTarget`/`openDropPinMenu` are shared and civfix-web's home map calls
  the same pair. Without a web-side camera callback the restore no-ops there.

---

## Workstream 3 — Report tab: embedded camera, navbar throughout

### Correction to prior assumptions

The report wizard is **already** a top-level tab VIEW rendered inside the app shell, not the old
full-screen screens. `portraitShellPlan("report", null)` returns `renderBaseBody: true` and
`bottomChromeVisible: true`, and `base.bottomInset` is the tab-bar footprint unconditionally. The
draft (`useDraftReportStore`) is module-level zustand and **already survives** tabbing away;
`ReportFlowBody` re-derives the step on remount via `resumeStep`.

So the request reduces to the **two surfaces that cover the dock**, both of which are full-screen
native surfaces rather than shell state.

### Decisions

- Draft persistence across app kill: **not in scope.** Tab-away already works, and persisting
  resurrects state the in-memory design assumed was ephemeral (notably `locationPrefilled`, which
  permanently drops the compact LOCATION step, and `idempotencyKey`, which has a backend window).
- The map picker is un-Modal'd for the **report wizard**. Host-an-event keeps its `<Modal>`.

  *Amended 2026-07-26 during planning.* The original intent was to change both flows. It cannot be
  done "the same way": `CleanupForm`'s `MeetLocationCompact` (`bodies/CleanupForm.tsx:227-301`) sits
  inside `CreateCleanupBody`, a `"scroll"` detail — i.e. inside the gorhom bottom sheet, which
  `usePickStepSheetSnap` deliberately **collapses to peek** while picking. An in-body absolute-fill
  layer there would be clipped to a peeked card. Covering the screen from that surface needs a
  shell-level full-screen layer host mounted below the dock's z (the `MediaLightboxProvider` shape),
  which is separate work. The seam therefore takes `presentation?: "modal" | "layer"` defaulting to
  `"modal"`, so `CleanupForm` is byte-identical and only the report wizard opts into `"layer"`. The
  user-facing requirement — navbar visible for the whole *report* flow — is fully met.

### 3a — Embed the camera

Today: `CaptureStep` calls `camera.capture()` → `nativeCamera.capture()` parks a resolver and calls
the registered navigator → `CameraNavigatorBridge` does `router.push("/report/camera")` → a 701-line
vision-camera screen captures and calls `resolveCameraCapture(media) + router.back()`. On native the
viewfinder auto-opens on entering the capture step with an empty draft, so "Report" already means
"you are in the viewfinder" — just on a screen above the shell.

`CameraCapability` (`capabilities/types.ts:71-95`) is **imperative-only** — `isAvailable`, `capture`,
`pickFromLibrary`, `prepareUpload`. There is no renderable slot. That is the structural reason the
viewfinder must be a separate screen.

Design:

1. Add a **renderable slot** to `CameraCapability` — an optional
   `Viewfinder?: React.ComponentType<{onCaptured, onCancel, mode}>`, or a registration mirroring
   `setCameraNavigator`. Precedent for a renderable native surface behind a seam:
   `LocationPicker.{native,web}.tsx`.
2. Extract the viewfinder body from `app/report/camera.tsx` into a reusable component under
   `civfix-mobile/src/components/`, leaving the route a **thin wrapper**. **Keep
   vision-camera in the mobile app** and inject through the seam — do not add
   `react-native-vision-camera` to `@civfix/ui` peer deps.

   *Amended 2026-07-26 during planning:* the `/report/camera` route and `setCameraNavigator` must
   **stay**. `camera.capture()` has two live callers outside the report wizard —
   `primitives/useComposerAttachments.ts:143` (the post composer's Camera attachment) and the
   profile avatar picker in `bodies/ProfileBody.tsx`. Deleting the route breaks both.
3. `CaptureStep` renders the injected viewfinder inline, **inset above the dock** (not under a
   translucent dock — honest framing area on a small phone). The auto-open latch becomes "is the
   viewfinder mounted"; `stepCameraAutoOpen`/`autoOpensCameraOnEnter` retire or change meaning.
4. The capture step must **escape the wizard's shared vertical ScrollView**
   (`ReportFlowBody.tsx:1248-1262`) — a live viewfinder inside a vertical scroller fights pan
   gestures.
5. **Session lifecycle** (the main new hazard): explicitly pause/release the camera when the tab
   loses focus or the step leaves `capture`. Today `router.back()` unmounts it for free. iOS will
   otherwise hold the capture session — battery, heat, and conflicts with other camera consumers.
6. Permission-denied becomes an **inline state** (with library fallback + Settings link) instead of
   a full screen. No manifest change: all four usage strings and the vision-camera / image-picker /
   location plugin configs are already in `app.config.js`.

### 3b — Un-Modal the map picker

`PortraitMapPickStep.native.tsx:78` renders the picker inside an RN `<Modal>` and collapses the
sheet detent. Render it as an in-body absolute-fill layer beneath the dock instead.
`usePickStepSheetSnap`'s detent capture/restore is coupled to `visible` and must be rechecked.

### Also fix while in here

`ReportFlowBody.tsx:267` uses `key={m.uri}` and :270 calls `removeMedia(m.uri)`, contradicting the
identity contract at `draftStore.ts:26-33` and :322-330 — URIs are **not** unique (picking the same
library asset twice yields two items with one URI). Result: duplicate React keys, and removing one
thumb drops the wrong match. Should be `m.id` in both places.

### Risks

- The **mic-permission deferral** (`camera.tsx:83`, :269-275) — a fresh grant must land in a
  re-render before `startRecording`, or the first clip is silent. Subtle, load-bearing, easy to lose
  in an extract-and-embed refactor.
- Permission prompts **move**: currently fired on a screen the user opted into, now on the Report
  tab itself.
- **Landscape/expanded has no dock at all** (`wizardSteps.ts:110-113`); the wizard's own back chip is
  the only exit there. Anything gated on "the dock is the way out" must keep that branch intact.
- `wizardSteps.test.ts` locks `stepCameraAutoOpen`'s once-per-mount contract and needs updating —
  with the viewfinder mounted rather than pushed, the decision moves from a `useEffect` to a lazy
  `useState` initializer, so the latch retires outright rather than changing meaning.

  *Amended 2026-07-26 during planning:* `portraitShellPlan` needs **no** change, and
  `shell/__tests__/portrait-shell.test.ts` is a *guard*, not an update. Both new surfaces are
  children of the report BODY, so `plan("report", null)` is unchanged. The guard exists because the
  tempting alternative implementations — viewfinder as a `full` detail entry, picker as a
  `drop-pin`-style stack entry — would flip `bottomChromeVisible` to `false` and re-hide the dock,
  which is the whole bug being fixed.
- "Inset above the dock" is already free: `PortraitShell.shared.tsx:106` pads the base surface by
  `frame.base.bottomInset` unconditionally for a base body. The corollary is a real hazard — the
  extracted viewfinder must **drop** the route's own `Math.max(insets.bottom, space5) + 6` controls
  padding, and the pick layer must drop `insets.top`/`insets.bottom`, or the inset applies twice.
- **Web answer needed**: `autoOpensCameraOnEnter` is deliberately native-only (browsers block a
  gesture-less file-input click). Web keeps the tap-to-open file input — the embedded viewfinder is
  native-only.

---

## Workstream 4 — Smooth leaving Search

### Scope

**Leaving Search only** — the leading glass circle showing the previous tab's glyph
(`TabBar.native.tsx:610-616`, `onExitSearch` = `Keyboard.dismiss(); selectView(prevView)`). The ✕
(`TabBar.native.tsx:663-679`) keeps its current meaning: clear the query and blur, stay in Search
(the Apple News/Music model the dock was built against). Its shared defects are fixed as a
consequence of 1 and 2 below, which is fine.

### The four defects, in order of loudness

1. **The keyboard reserve collapses ~289pt in one un-animated frame, mid-descent.**
   `Keyboard.dismiss()` → iOS posts `keyboardWillHide` → the reducer deliberately **holds**
   `reserveOverlap` (`keyboardInsetModel.ts:98-102`). One tick later blur fires, `enabled` flips
   false, and the ownership branch (:123-124) returns `reserveOverlap: 0` **unconditionally**,
   overriding that hold while the keyboard is still travelling. `SearchBodyReveal.native.tsx:90`
   consumes it as `paddingBottom` and re-lays-out the whole overlay in a single frame
   (measured 411→94 on an iPhone 17 Pro).
   **Fix:** in the pure reducer, when `phase === "engaged"` and a close is already in flight, carry
   the reserve until `did-settle`, exactly as the will-hide branch does. Extend
   `shell/__tests__/keyboardInsetModel.test.ts`.

2. **Two competing timings on the same value.** The ownership effect
   (`useKeyboardAnchor.native.ts:198-225`) re-issues `overlap.value = withTiming(0, {duration: 220})`
   on top of the will-hide's still-running `withTiming(0, {duration: OSdur})`. Restarting an ease-out
   mid-flight re-accelerates the dock while the real keyboard keeps decelerating on the OS curve.
   **Fix:** no-op the ownership command when a close on the same target is already in flight.

3. **Two curves multiply into one glass width.** On exit, `p` times to 0 on `dockMorphOut` (200ms)
   *and* `focusProgress` times to 0 on `dockFocus` (200ms) simultaneously, and `dockShapes(p, …, f, …)`
   takes both: `rightW = lerp(f, rightWp(p), fieldFocusW)`.
   **Fix:** the exit is carried by a single curve — settle `f` at exit-start so only `p` animates.

4. **Two hard content remounts on the fade frames.** `selectView` clears `query`, so
   `SearchBody.tsx:54` swaps `SearchResults` → `SearchResting`, then `pinned` flips and :278 swaps
   `RecentlySearched` → `Discovery` ~1 frame later — mounting three react-query-backed sections plus
   a horizontal ScrollView of avatar cards and FollowButtons, on the exact frames the overlay is
   fading and the glass is morphing.
   **Fix:** freeze the search body content during exit and let it die with the fade — the same shape
   as the `bodyFadeStyle` freeze-while-closing from the feed redesign. Zero remounts on the fade
   frames.

### Motion vocabulary

The chrome already uses the right tokens: `dockMorphOut` (200ms) for leaving, `dockFocus` (200ms)
for the blur collapse, both on `EASE_STANDARD` — and the stated doctrine is "dismissals start on
frame 1 and read gone by 150-200ms." What lacks a token is any **content** crossfade; if one is
needed, add a `bodyExitConfig()` adapter over the existing `bodyExit` (140ms) in
`motionConfigs.native.ts` rather than inventing a number.

### Hard constraints

- **Nothing in `SearchBody`'s layout may be gated on a keyboard signal**, and the content container
  stays content-height (no `flex-grow`, no `justify-content`). Commit `a637875` (@civfix/ui 0.33.0)
  did exactly that and was reverted at the user's explicit request; `SearchBody.tsx:244-268` is the
  standing warning.
- **Never animate a layout property off `reserved`** (`useKeyboardAnchor.types.ts:12-13`). `lift` is
  per-frame/UI-thread; `reserved` is per-transition/JS-thread. The ~289pt step stays a
  per-transition layout step — the fix makes it *invisible* (behind the keyboard's own travel), not
  animated.
- **Never call a `*Config()` factory inside a worklet** — release-build SIGABRT with no debug guard
  (commit `a89c3eb`). Hoist into `useMemo`.
- **Do not add a second mounted copy of a body for a crossfade on native** — native bodies register
  into gorhom's one shared active-scrollable registry (`BodyTransition.native.tsx:11-20`). The
  search overlay uses `PLAIN_SCROLL_HOST`, which may make it safe, but that must be checked.
- **Do not swap ScrollHost identity** to achieve a crossfade — it swaps the ScrollView component
  *type* at the same position and remounts the whole subtree.
- **Reduce-motion escape hatches exist everywhere** and jump straight to target. Any new animation
  needs one.

### Note

`0.27.5`'s keyboard fix is **web-only** (`snapAnimated` + `CompactShell.web.tsx`) and on the *focus*
side, so a native dismiss change cannot regress it directly. The transferable rule still applies:
never move a focused field's position while the OS is animating the keyboard.

---

## Workstream 5 — Reports-nearby rows

### Problem

`ReportHitRow` (`bodies/SearchResults.tsx:105-125`) hand-rolls a row with a `MapPin` glyph in a
tinted circle, and its subtitle is the report *description*. The user wants the report's photo and
location details.

### Design

Render via the existing shared `ReportRowView` (`bodies/ReportRow.tsx`) — "the ONE shared report
list-row", already used by "Your reports" and the map-cluster list, which draws the report's first
photo as a 36px rounded-square thumb and falls back to the category pin dot when there is none. This
also makes the three surfaces read identically, which is that component's stated purpose.

Subtitle becomes **location**: `distanceLabel(miles)` + `addr`, e.g. `0.4 mi · 1200 S Hope St`.
Fall back to whichever is present; fall back to the description only if neither is.

### Data — already on the wire, no backend change

`ReportPinDTOSchema` (`shared/src/schemas/entities.ts:188-200`) carries `title`, `description`,
`thumbUrl`, `addr`. `toMapPinDTO` in `report-service.ts` presigns `thumbUrl` and includes `addr`.
Distance is computed client-side with `haversineMeters` from `@civfix/shared` against
`useUserLocation()` — the same pattern as `searchSuggestModel.ts:62` and `EventsBody.tsx:234` —
and formatted with `distanceLabel` (`bodies/relativeTime.ts:31-36`).

Note `ReportRowView` owns its own tap nav (`push({kind: "pin", id, lat, lng})`), which is identical
to `ReportHitRow`'s current handler, so nav behavior is unchanged.

---

## Testing

**There is no React test harness in either repo.** `@civfix/ui` runs vitest over pure `.ts` modules
only (`find src -name "*.test.tsx"` returns nothing); `civfix-mobile`'s `test` script is
`node --experimental-strip-types --test` scoped to `tests/` and `src/{components,lib,theme}/*.test.ts`.
So every unit test below targets a pure module, and the RN component work is gated on `pnpm typecheck`
plus simulator verification. Do not invent a component-testing setup.

Per-workstream, matching house patterns:

1. `buildThreadRows` — expansion splicing, rail alignment under insertion, depth cap, dedupe with
   optimistic rows.
2. `dropPinCamera` restore-target math and the pan-detection predicate, in the existing
   `map/__tests__/dropPinCamera.test.ts`. `dropPinFlow` restore-vs-not branching, including the
   `[drop-pin, cleanup]` publish case.
3. `wizardSteps.test.ts` (auto-open contract change) and `shell/__tests__/portrait-shell.test.ts`
   (a guard that the plan shape is unchanged). Draft media identity (`m.id` not `m.uri`). The
   genuinely testable camera policy — the mic deferral, the session gate, the 10s cap — goes in
   `civfix-mobile/src/lib/cameraSession.ts`, which the mobile `test` glob already covers.
4. `shell/__tests__/keyboardInsetModel.test.ts` — the reserve is carried through a blur-driven close
   and only drops at `did-settle`.
5. Row-model test for the location subtitle fallback chain.

Device verification on the iOS simulator for 1–4 (the reusable recipe: rsync
`civfix-shared/packages/ui/src/` over `civfix-mobile/node_modules/@civfix/ui/src/`; new i18n keys
need an app relaunch, not just a reload; synthetic `swipe` does not drive gorhom's sheet handle —
use `touch_path` with ~30ms steps).

---

## Out of scope

- A backend subtree/thread endpoint for replies (the `thread_root_id` index exists; deferred).
- Report draft persistence across app kill.
- Reply sorting.
- Any change to `PostDetailBody` (unreachable on mobile).
- Web-specific treatment of the embedded viewfinder — web keeps the tap-to-open file input.
