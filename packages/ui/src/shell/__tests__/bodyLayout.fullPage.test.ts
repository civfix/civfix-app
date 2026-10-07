/**
 * The sheet-to-page presentation seam (`resolveBodyLayout` + `SHEET_ONLY_KINDS`). The flag is a plain
 * parameter so both values are testable here without a bundler, renderer or mock.
 *
 * The invariants (drop-pin is never a page, the dock never shows over a detail, `home-view` never
 * converts, the resolver is the identity at flag=false) must always hold. The exemption-set marker below
 * is the one assertion expected to change if a kind is ever parked back on the sheet.
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

/** Every kind's extra fields are optional on DetailEntry. */
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
    // Read from the table, not the literal "scroll": an exempt kind that is already "full" must not be
    // demoted to a sheet by being listed here.
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
    // The drop-pin menu exists for the pin visible in the map strip beside it, and dropPinCamera's
    // offset is computed from the live sheet detents. A page would cover the map and the pin.
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

  // Expected to change if a kind is re-exempted; everything above is not.
  it("THE CONVERSION HAS FIRED: every pull-up except the permanent exemption is a PAGE on native", () => {
    // An equality rather than a subset, so parking kinds back on the sheet fails and names them.
    expect([...SHEET_ONLY_KINDS]).toEqual(["drop-pin"])
    for (const kind of SCROLL_KINDS) {
      if (kind === "drop-pin") continue
      expect(resolveBodyLayout(kind, true), kind).toBe("full")
    }
    // Restated here so an edit to this marker cannot drag the sheet path along with it.
    for (const kind of ALL_DETAIL_KINDS) {
      expect(resolveBodyLayout(kind, false), kind).toBe(BODY_LAYOUT[kind])
    }
  })
})

describe("portraitShellPlan in PAGE mode", () => {
  const page = (view: View, active: DetailEntry | null) => portraitShellPlan(view, active, true)

  it("HIDES the dock over EVERY detail, page or sheet, on every view", () => {
    // The dock's re-tap-deselect semantics would fight a page's own Back.
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
      // Asserted as a whole plan so a future field cannot drift the two modes apart. The Report tab
      // must keep its dock.
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
    // The own-header bodies are pages in either mode.
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
    // input; post-thread and person deliberately do not.
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
    // `overlay.bottomInset` is the hidden dock's footprint (0), which is why PortraitShell.shared falls
    // back to `bottomSafeArea`; otherwise a page's last row would run under the home indicator.
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
    // The dock's absence is a paint decision, and the base is not what the user is looking at.
    expect(frame.base.bottomInset).toBe(80)
  })

  it("NO CONVERTED KIND MAY BE HEADERLESS - a page with no header has no exit at all", () => {
    // A page has no drag and the dock is hidden, so the header's leading chip is the only way off.
    // `titleForEntry` returning "" means nothing draws a header: a trapped user. The minimal entry has no
    // `event` field, so this exercises data-dependent titles' fallbacks (such as `blend`'s).
    for (const kind of ALL_DETAIL_KINDS) {
      if (SHEET_ONLY_KINDS.has(kind)) continue
      expect(
        titleForEntry(entryFor(kind)) === "",
        `${kind} converts to a page but titleForEntry gives it no header, so it has no exit`,
      ).toBe(false)
    }
  })

  it("still lets the surviving SHEET ride over a retained page (the layering machinery outlives the waves)", () => {
    // A sheet over a still-mounted page leaves a bare strip at the top, and a tap there must not reach
    // the page, which must stay painted rather than unmount and reveal the base. drop-pin is the only
    // sheet that can be the upper half.
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
    // `entry` (the web overlay) and `entries` (the native page stack) come from one `fullEntryStack` scan;
    // a second scan is how they would drift.
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
    // `create-cleanup` opened from the composer is a page itself, so it takes the overlay layer: the
    // newest page wins and Back re-reveals the composer underneath.
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
 * A pop cannot animate against a page that was never mounted, so the whole list is the primitive and
 * `topmostFullEntry` is its last element. Derived separately, the page the shell animates and the page it
 * renders could disagree.
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
    // In page mode only the drop-pin sheet is filtered out besides the route entry.
    expect(fullEntryStack(stack, true)).toEqual([{ kind: "profile" }])
    // In sheet mode `profile` is a pull-up too, so nothing claims the layer.
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
