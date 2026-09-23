/**
 * The mobile sheet -> PAGE presentation seam (`resolveBodyLayout` + `SHEET_ONLY_KINDS`).
 *
 * WHY THIS FILE EXISTS AT ALL. `bodyLayout` is shared by civfix-web and civfix-mobile, and
 * `DETAILS_ARE_FULL_PAGE` is now true on both. The flag is a plain parameter precisely so both values can
 * be passed here without a bundler, a renderer or a mock.
 *
 * The two halves are deliberately different in kind:
 *   - the INVARIANTS (drop-pin is never a page, the dock never shows over a detail, `home-view` never
 *     converts, the resolver is the identity at flag=false) must hold in every wave, forever;
 *   - the WAVE MARKER below pins WHICH kinds have converted. It read "armed but NOT FIRED" while the
 *     seam shipped ahead of the conversion; it now reads "FIRED, everything but the permanent
 *     exemption", which is the same assertion with the exemption set narrowed to its floor. It is the
 *     one assertion here that is EXPECTED to be edited again if a kind is ever parked back on the sheet.
 */
import { describe, expect, it } from "vitest"
import type { DetailEntry, DetailKind, View } from "../../nav"
import { ALL_DETAIL_KINDS, ENTRY_IDENTITY_FIELDS, entryIdentity, titleForEntry } from "../../nav"
import {
  BODY_LAYOUT,
  SHEET_ONLY_KINDS,
  fullEntryStack,
  pageLayerKey,
  portraitFramePlan,
  portraitShellPlan,
  resolveBodyLayout,
  topmostFullEntry,
} from "../bodyLayout"

/** A minimal valid entry for a kind - every kind's extra fields are optional on DetailEntry. */
const entryFor = (kind: DetailKind): DetailEntry =>
  ({ kind, id: "x", lat: 1, lng: 2 }) as DetailEntry

const SCROLL_KINDS = ALL_DETAIL_KINDS.filter((kind) => BODY_LAYOUT[kind] === "scroll")
const FULL_KINDS = ALL_DETAIL_KINDS.filter((kind) => BODY_LAYOUT[kind] === "full")

describe("resolveBodyLayout - the sheet/page seam", () => {
  it("is the strict IDENTITY of BODY_LAYOUT at fullPageDetails=false", () => {
    for (const kind of ALL_DETAIL_KINDS) {
      expect(resolveBodyLayout(kind, false), kind).toBe(BODY_LAYOUT[kind])
    }
    expect(resolveBodyLayout("home-view", false)).toBe(BODY_LAYOUT["home-view"])
  })

  it("converts everything OUTSIDE the exemption set to a full page at fullPageDetails=true", () => {
    for (const kind of ALL_DETAIL_KINDS) {
      if (SHEET_ONLY_KINDS.has(kind)) continue
      expect(resolveBodyLayout(kind, true), kind).toBe("full")
    }
  })

  it("leaves the EXEMPT kinds exactly as the table declares them", () => {
    // Reading the table (rather than asserting the literal "scroll") is the point: an exempt kind that is
    // already "full" must not be silently demoted to a sheet by being listed here.
    for (const kind of ALL_DETAIL_KINDS) {
      if (!SHEET_ONLY_KINDS.has(kind)) continue
      expect(resolveBodyLayout(kind, true), kind).toBe(BODY_LAYOUT[kind])
    }
  })

  it("NEVER converts `home-view` - it is the sheet's own resting identity, not a detail", () => {
    expect(resolveBodyLayout("home-view", true)).toBe("scroll")
    expect(resolveBodyLayout("home-view", false)).toBe("scroll")
  })

  it("keeps `drop-pin` a SHEET forever - the one true casualty", () => {
    // The drop-pin menu's whole purpose is the coral pin visible in the map strip BESIDE it, and the
    // camera offset is computed from the live sheet detents (map/dropPinCamera's `occludedHeight(
    // sheetSnapPoints(...), sheetDetent)`, map/dropPinFlow settling at MID). A page covers the map: the
    // pin is invisible and the camera math is meaningless. This assertion must survive every wave.
    expect(SHEET_ONLY_KINDS.has("drop-pin")).toBe(true)
    expect(resolveBodyLayout("drop-pin", true)).toBe("scroll")
    expect(resolveBodyLayout("drop-pin", false)).toBe("scroll")
  })

  it("never lists a table-'full' kind as sheet-only (the set may only ever hold pull-ups)", () => {
    for (const kind of SHEET_ONLY_KINDS) {
      expect(BODY_LAYOUT[kind], `${kind} is already a full body and cannot be sheet-only`).toBe("scroll")
    }
  })

  it("resolves TOTALLY over every DetailKind at both flag values", () => {
    for (const kind of ALL_DETAIL_KINDS) {
      expect(["scroll", "full"], kind).toContain(resolveBodyLayout(kind, false))
      expect(["scroll", "full"], kind).toContain(resolveBodyLayout(kind, true))
    }
  })

  // ---- THE WAVE MARKER. Expected to change; everything above is not. ----
  it("THE CONVERSION HAS FIRED: every pull-up except the permanent exemption is a PAGE on native", () => {
    // The post-fire counterpart of the "armed but NOT FIRED" guard this file shipped with. All three
    // waves (pure content / map-coupled / flows) landed in ONE pass because the request was categorical,
    // so the exemption set is now at its floor: the exact PERMANENT_SHEET_KINDS list and nothing else.
    //
    // Stated as an equality rather than a subset on purpose. A subset check would pass just as happily if
    // a future edit quietly parked half a dozen kinds back on the sheet; this fails, and the failure names
    // the kinds - so re-exempting anything stays a visible, intentional edit, exactly as firing a wave was.
    expect([...SHEET_ONLY_KINDS]).toEqual(["drop-pin"])
    // Every kind the table calls a pull-up, except that one, now presents as a page on native...
    for (const kind of SCROLL_KINDS) {
      if (kind === "drop-pin") continue
      expect(resolveBodyLayout(kind, true), kind).toBe("full")
    }
    // ...and the SHEET path did not move an inch with it (the web guarantee, restated at the wave marker
    // because this is the assertion a future wave edits, and it must not be able to drag web along).
    for (const kind of ALL_DETAIL_KINDS) {
      expect(resolveBodyLayout(kind, false), kind).toBe(BODY_LAYOUT[kind])
    }
  })
})

describe("portraitShellPlan in PAGE mode", () => {
  const page = (view: View, active: DetailEntry | null) => portraitShellPlan(view, active, true)

  it("HIDES the dock over EVERY detail, page or sheet, on every view", () => {
    // The invariant the presentation-derived gate exists for. In sheet mode a table-"full" kind outside
    // the hard-coded three-kind literal (thread / pinned-messages / new-group / new-channel) KEPT the
    // dock; converting ~24 more kinds that way would have floated it over every one of them, where its
    // re-tap-deselect semantics fight the page's own Back.
    for (const view of ["home", "map", "messaging", "report", "search", "social"] as const) {
      for (const kind of ALL_DETAIL_KINDS) {
        const result = page(view, entryFor(kind))
        expect(result.bottomChromeVisible, `${view} / ${kind}`).toBe(false)
        expect(result.detailPresentation, `${view} / ${kind}`).not.toBe("none")
      }
    }
  })

  it("RESTORES the dock the moment there is no detail (the gate is about details, not about pages)", () => {
    for (const view of ["home", "map", "messaging", "report", "search", "social"] as const) {
      // A BARE view is identical in both modes - asserted as a whole plan (not field by field) so a
      // future field cannot drift the two apart unnoticed. The Report tab is the one that matters:
      // portrait-shell.test's WS3 guard depends on it keeping its dock.
      expect(page(view, null), view).toEqual(portraitShellPlan(view, null))
      expect(page(view, null).bottomChromeVisible, view).toBe(true)
      expect(page(view, null).detailPresentation, view).toBe("none")
    }
  })

  it("presents every converted kind as a FULL page and every exempt one as a sheet", () => {
    for (const kind of ALL_DETAIL_KINDS) {
      const expected = SHEET_ONLY_KINDS.has(kind) ? "sheet" : "full"
      expect(page("home", entryFor(kind)).detailPresentation, kind).toBe(expected)
    }
    // The seven own-header bodies were already pages and stay pages in either mode.
    for (const kind of FULL_KINDS) {
      expect(page("home", entryFor(kind)).detailPresentation, kind).toBe("full")
      expect(portraitShellPlan("home", entryFor(kind)).detailPresentation, kind).toBe("full")
    }
  })

  it("leaves the map mount + base body decisions untouched - only the DETAIL layer moves", () => {
    expect(page("map", null).mountMap).toBe(true)
    expect(page("map", null).renderBaseBody).toBe(false)
    expect(page("map", entryFor("pin")).mountMap).toBe(true)
    expect(page("report", null).renderBaseBody).toBe(true)
  })

  it("keeps shell keyboard avoidance the COMPOSER's alone, in both modes", () => {
    // Presentation is not ownership: the composer owns the shell's keyboard inset because it has a docked
    // input, and post-thread / person deliberately do not (see portrait-shell.test's regression guard).
    expect(page("home", { kind: "composer" }).surfaceKeyboardAvoidance).toBe(true)
    expect(page("home", { kind: "post-thread", id: "p" }).surfaceKeyboardAvoidance).toBe(false)
    expect(page("home", { kind: "profile" }).surfaceKeyboardAvoidance).toBe(false)
  })
})

describe("the overlay layer in PAGE mode", () => {
  it("hands a converted kind the overlay layer (topmostFullEntry reads the seam, not the table)", () => {
    for (const kind of ALL_DETAIL_KINDS) {
      const entry = entryFor(kind)
      const expected = resolveBodyLayout(kind, true) === "full" ? entry : null
      expect(topmostFullEntry([entry], true), kind).toEqual(expected)
      // ...and at flag=false the answer is the table's, unchanged.
      expect(topmostFullEntry([entry], false), kind).toEqual(
        BODY_LAYOUT[kind] === "full" ? entry : null,
      )
    }
  })

  it("keeps the exempt drop-pin sheet from claiming the overlay even in page mode", () => {
    expect(topmostFullEntry([{ kind: "drop-pin", lat: 1, lng: 2 }], true)).toBeNull()
  })

  it("still ignores a route-only `view` entry (no BODY_LAYOUT member to read)", () => {
    expect(topmostFullEntry([{ kind: "view", view: "map" }], true)).toBeNull()
  })

  it("reserves NO dock footprint for a page - the bottom safe area is the shell's job instead", () => {
    // `frame.overlay.bottomInset` is the DOCK's footprint, and the dock is hidden over every detail in
    // page mode, so it is 0 - which is exactly why PortraitShell.shared falls back to `bottomSafeArea`
    // (insets.bottom on native, 0 on web). Without that fallback a converted page's last row would run
    // under the home indicator.
    const active: DetailEntry = { kind: "person", id: "p" }
    const frame = portraitFramePlan(
      "social",
      active,
      portraitShellPlan("social", active, true),
      0,
      80,
      [active],
      true,
    )
    expect(frame.overlay.bodyMounted).toBe(true)
    expect(frame.overlay.bottomInset).toBe(0)
    expect(frame.sheet.visible).toBe(false)
    expect(frame.bottomChrome.visible).toBe(false)
    // The BASE surface keeps its footprint regardless: the dock's absence is a paint decision, and the
    // base is not what the user is looking at.
    expect(frame.base.bottomInset).toBe(80)
  })

  it("NO CONVERTED KIND MAY BE HEADERLESS - a page with no header has no exit at all", () => {
    // The trap this whole workstream exists to avoid, stated as a gate on the NEXT wave rather than as
    // prose in a risk list. A page has no drag and the dock is hidden over it, so the shell header's
    // leading chip is the only way off. `titleForEntry` has exactly three outcomes:
    //   "title.x" -> the shell draws the bar.                                                    OK
    //   " "       -> the BODY owns a header (the seven own-header full bodies).                  OK
    //   ""        -> nothing draws anything.                                              TRAPPED USER
    // `blend` WAS the live hazard and is what this guard caught: its title was `entry.event?.title ?? ""`,
    // i.e. DATA-dependent, so a blend entry that arrived before (or without) its event produced the blank.
    // Wave B could not fire until it had a real fallback, and `nav/routes.ts` now returns the existing
    // `title.cleanup` key when the event title is missing. Note this runs on a MINIMAL entry - no `event`
    // field at all - so it exercises precisely that fallback rather than the happy path.
    for (const kind of ALL_DETAIL_KINDS) {
      if (SHEET_ONLY_KINDS.has(kind)) continue
      expect(
        titleForEntry(entryFor(kind)) === "",
        `${kind} converts to a page but titleForEntry gives it no header, so it has no exit`,
      ).toBe(false)
    }
  })

  it("still lets the surviving SHEET ride over a retained page (the layering machinery outlives the waves)", () => {
    // The overlay's `interactive` gate exists for a sheet riding ABOVE a still-mounted full body: the
    // sheet card leaves a bare strip at the top of the screen, and a tap there must not reach the page
    // behind it. Now that everything but `drop-pin` is a page, drop-pin is the only sheet that can ever
    // be the upper half of that pair - so it is the one the assertion uses. The lower half stays a page
    // and must stay PAINTED (not unmounted, revealing the base view) while the sheet is up.
    const stack: DetailEntry[] = [{ kind: "composer" }, { kind: "drop-pin", lat: 1, lng: 2 }]
    const active = stack[1]!
    const shell = portraitShellPlan("home", active, true)
    const frame = portraitFramePlan("home", active, shell, 0, 80, stack, true)
    expect(shell.detailPresentation).toBe("sheet")
    expect(frame.sheet.visible).toBe(true)
    expect(frame.overlay.entry).toEqual({ kind: "composer" })
    expect(frame.overlay.bodyMounted).toBe(true)
    expect(frame.overlay.interactive).toBe(false)
  })

  it("hands the frame BOTH shapes, and they cannot disagree about the top", () => {
    // `entry` is what the WEB overlay renders and `entries` is what the native page stack mounts; both
    // come from ONE `fullEntryStack` scan in `portraitFramePlan`, so the web body is by construction the
    // last layer. A second scan (or a re-derived `topmostFullEntry` call) is exactly how they would drift.
    const stack: DetailEntry[] = [{ kind: "profile" }, { kind: "followers", id: "u1" }]
    const active = stack[1]!
    const frame = portraitFramePlan(
      "social",
      active,
      portraitShellPlan("social", active, true),
      0,
      80,
      stack,
      true,
    )
    expect(frame.overlay.entries).toEqual(stack)
    expect(frame.overlay.entry).toEqual(frame.overlay.entries[frame.overlay.entries.length - 1])
    expect(frame.overlay.layerKeys).toEqual([
      pageLayerKey("social", stack[0]!, 0),
      pageLayerKey("social", stack[1]!, 1),
    ])
  })

  it("gives a CONVERTED kind on top of a page the overlay layer outright (no sheet is left to ride)", () => {
    // The mirror of the case above, and the one the waves actually created: `create-cleanup` used to ride
    // as a sheet over the composer page ("+ New event" from the composer) and is now a page itself, so it
    // TAKES the overlay layer rather than floating over it. `topmostFullEntry` scanning from the top is
    // what makes that correct - the newest page wins, and Back re-reveals the composer underneath.
    const stack: DetailEntry[] = [{ kind: "composer" }, { kind: "create-cleanup" }]
    const active = stack[1]!
    const shell = portraitShellPlan("home", active, true)
    const frame = portraitFramePlan("home", active, shell, 0, 80, stack, true)
    expect(shell.detailPresentation).toBe("full")
    expect(frame.sheet.visible).toBe(false)
    expect(frame.overlay.entry).toEqual({ kind: "create-cleanup" })
    expect(frame.overlay.interactive).toBe(true)
  })
})

/**
 * `fullEntryStack` - the derivation the native PAGE STACK is mounted from.
 *
 * `topmostFullEntry` answered "which ONE body owns the overlay layer", which is all a hard cut needs. A
 * pop cannot be animated against a page that was never mounted, so the whole list is now the primitive
 * and the old function is its last element. These tests exist to keep that relationship exact: the moment
 * the two are derived separately, the page the shell ANIMATES and the page it RENDERS can disagree.
 */
describe("fullEntryStack - the page stack itself", () => {
  it("is EXACTLY the entries `topmostFullEntry` would have scanned, in stack order", () => {
    for (const flag of [false, true]) {
      for (const kind of ALL_DETAIL_KINDS) {
        const entry = entryFor(kind)
        const expected = resolveBodyLayout(kind, flag) === "full" ? [entry] : []
        expect(fullEntryStack([entry], flag), `${kind} @ ${flag}`).toEqual(expected)
      }
    }
  })

  it("keeps `topmostFullEntry` its LAST element at both flag values - one scan, two answers", () => {
    // The equivalence that makes growing the frame plan safe: every historic caller and assertion of
    // `topmostFullEntry` still gets the identical value, because it is now literally derived from this.
    const stacks: DetailEntry[][] = [
      [],
      [{ kind: "view", view: "map" }],
      [{ kind: "drop-pin", lat: 1, lng: 2 }],
      [{ kind: "profile" }, { kind: "followers", id: "u1" }],
      [{ kind: "composer" }, { kind: "drop-pin", lat: 1, lng: 2 }],
      [{ kind: "composer" }, { kind: "create-cleanup" }, { kind: "post-thread", id: "p" }],
      [{ kind: "pin", id: "r1", lat: 1, lng: 2 }, { kind: "person", id: "u2" }, { kind: "profile" }],
    ]
    for (const flag of [false, true]) {
      for (const stack of stacks) {
        const entries = fullEntryStack(stack, flag)
        expect(topmostFullEntry(stack, flag)).toEqual(entries[entries.length - 1] ?? null)
      }
    }
  })

  it("preserves BOTTOM-first order - the layers are mounted in the order they were pushed", () => {
    // Reversed, `entries[entries.length - 1]` would be the ROOT and every push would animate backwards.
    const stack: DetailEntry[] = [
      { kind: "profile" },
      { kind: "followers", id: "u1" },
      { kind: "event-dashboard" },
    ]
    expect(fullEntryStack(stack, true)).toEqual(stack)
  })

  it("skips route-only `view` entries and whatever is still a sheet", () => {
    const stack: DetailEntry[] = [
      { kind: "view", view: "map" },
      { kind: "profile" },
      { kind: "drop-pin", lat: 1, lng: 2 },
    ]
    // In PAGE mode the drop-pin sheet is the only thing filtered out besides the route entry...
    expect(fullEntryStack(stack, true)).toEqual([{ kind: "profile" }])
    // ...and in SHEET mode (web) `profile` is a pull-up too, so nothing claims the layer.
    expect(fullEntryStack(stack, false)).toEqual([])
  })

  it("returns the SAME entry objects, not copies - the layer keys depend on their identity", () => {
    // PageStack memoizes each layer's body element on the entry's reference. Copying here would rebuild
    // (and re-render) every page body on every shell render, which is the cost retaining layers exists
    // to avoid paying.
    const root: DetailEntry = { kind: "profile" }
    expect(fullEntryStack([root], true)[0]).toBe(root)
  })
})

describe("pageLayerKey - stable page identity", () => {
  const person = (id: string): DetailEntry => ({ kind: "person", id })

  it("keeps two same-kind, same-id pages at different depths APART", () => {
    // A person profile reached from a person profile. Without the depth prefix both layers key to
    // "person:u1", React reconciles them as one, and the stack collapses to a single page.
    expect(pageLayerKey("social", person("u1"), 0)).not.toBe(pageLayerKey("social", person("u1"), 1))
  })

  it("does not change while an entry sits at the same depth (so a page is never remounted)", () => {
    // The key must survive a page moving front <-> under across a push and its matching pop, which is
    // exactly what "keyed by index" buys: the index does not move while the entry is on the stack.
    expect(pageLayerKey("social", person("u1"), 1)).toBe(pageLayerKey("social", person("u1"), 1))
  })

  it("carries the same identity `portraitSurfaceTransitionKey` gives the web overlay", () => {
    expect(pageLayerKey("home", { kind: "pin", id: "r1", lat: 1, lng: 2 }, 2)).toBe("2:pin:r1:::::")
    expect(pageLayerKey("home", { kind: "composer", composerMode: "reply", targetPostId: "p1" }, 0)).toBe(
      "0:composer:reply:p1",
    )
  })

  it("is the nav store's own `entryIdentity`, depth-prefixed - ONE discriminating-field list, not two", () => {
    for (const entry of [
      { kind: "pin", id: "r1" },
      { kind: "org", slug: "acme" },
      { kind: "leaderboard", geoid: "0644000" },
      { kind: "thread", id: "r1", roomKind: "group" },
      { kind: "my-ticket", id: "e1", seatId: "seat-9" },
      { kind: "composer", composerMode: "quote", targetPostId: "p1" },
    ] satisfies DetailEntry[]) {
      expect(pageLayerKey("home", entry, 3), entry.kind).toBe(`3:${entryIdentity(entry)}`)
    }
  })

  it("tells two SEATS on one event apart - the collision `seatId` was missing for", () => {
    const nine: DetailEntry = { kind: "my-ticket", id: "e1", seatId: "seat-9" }
    const ten: DetailEntry = { kind: "my-ticket", id: "e1", seatId: "seat-10" }
    expect(pageLayerKey("home", nine, 0)).not.toBe(pageLayerKey("home", ten, 0))
    expect(pageLayerKey("home", nine, 0)).not.toBe(
      pageLayerKey("home", { kind: "my-ticket", id: "e1" }, 0),
    )
  })

  it("reflects EVERY field `entryIdentity` discriminates on, so a new one cannot silently collide", () => {
    for (const field of ENTRY_IDENTITY_FIELDS) {
      const bare: DetailEntry = { kind: "cleanup" }
      const set = { ...bare, [field]: "discriminator" } as DetailEntry
      expect(entryIdentity(bare), field).not.toBe(entryIdentity(set))
      expect(pageLayerKey("home", bare, 0), field).not.toBe(pageLayerKey("home", set, 0))
    }
  })

  it("tells two organizations apart, which carry a slug and never an id", () => {
    const acme: DetailEntry = { kind: "org", slug: "acme" }
    const river: DetailEntry = { kind: "org", slug: "river-keepers" }
    expect(pageLayerKey("home", acme, 1)).not.toBe(pageLayerKey("home", river, 1))
    expect(pageLayerKey("home", acme, 1)).toBe("1:org::::acme::")
  })

  it("tells two leaderboards apart, which carry a geoid and never an id", () => {
    const la: DetailEntry = { kind: "leaderboard", geoid: "0644000" }
    const sf: DetailEntry = { kind: "leaderboard", geoid: "0667000" }
    expect(pageLayerKey("home", la, 0)).not.toBe(pageLayerKey("home", sf, 0))
  })

  it("cannot collide a RETAINED leaving layer with any surviving one", () => {
    // The exit animation renders the popped page ABOVE the stack it just left, keyed by the key it had
    // BEFORE the pop. That key's depth is old-length-1, and every surviving layer's depth is at most
    // old-length-2, so the prefix makes the collision impossible rather than unlikely.
    const before: DetailEntry[] = [person("u1"), person("u1")]
    const beforeKeys = before.map((entry, depth) => pageLayerKey("social", entry, depth))
    const afterKeys = before.slice(0, -1).map((entry, depth) => pageLayerKey("social", entry, depth))
    const goneKey = beforeKeys[beforeKeys.length - 1]!
    expect(afterKeys).not.toContain(goneKey)
  })
})
