/**
 * Body-render TOTALITY test (Stage 4 review fix).
 *
 * Guards the class of gap this fix closed: a user-reachable surface (a list `View` or a detail
 * `DetailKind`) silently falling through BodyRouter to the placeholder Stub. It asserts that the pure
 * routing tables (`VIEW_BODY` / `DETAIL_BODY` in ../bodyRoutes) resolve EVERY reachable view + kind to a
 * REAL body (a non-`"stub"` BodyId), with the sole documented exception of the dead `new-msg` kind.
 *
 * WHY THE TABLES, NOT A RENDER: the body components import react-native, whose Flow-typed entry does not
 * load under the package's plain vitest/node setup (no RN renderer / jsdom). So instead of rendering, the
 * routing DECISION was factored into ../bodyRoutes - a pure module naming each target by a `BodyId` tag,
 * importing no RN - and BodyRouter maps that BodyId to the RN component. This test consults the pure
 * tables structurally: it is exactly as strong as a render assertion for "does a real body resolve?" (a
 * non-stub BodyId == BodyRouter renders that real body), while loading with zero RN.
 *
 * The tables are typed `Record<View, BodyId>` / `Record<DetailKind, BodyId>`, so TS already enforces
 * totality at compile time; this test ADDS the runtime guarantee that none of those entries is a stub
 * (TS cannot express "non-stub"), and that the table key sets match the canonical View/DetailKind arrays
 * exactly (so a table that drifts from the union is caught even if a future type change masked it).
 */
import { describe, it, expect } from "vitest"
import { VIEW_BODY, DETAIL_BODY, type BodyId } from "../bodyRoutes"
import { BODY_LAYOUT } from "../bodyLayout"
import { ALL_VIEWS, ALL_DETAIL_KINDS, DEAD_DETAIL_KINDS } from "../../nav"

const DEAD = new Set<string>(DEAD_DETAIL_KINDS)

/** A BodyId is a "real body" iff it is not the placeholder stub. */
function isRealBody(id: BodyId): boolean {
  return id !== "stub"
}

describe("BodyRouter routing tables are total over every reachable surface", () => {
  it("maps EVERY list View to a real (non-stub) body", () => {
    for (const view of ALL_VIEWS) {
      const id = VIEW_BODY[view]
      expect(id, `view "${view}" must map to a body`).toBeDefined()
      expect(isRealBody(id), `view "${view}" resolved to a STUB, not a real body`).toBe(true)
    }
  })

  it("maps EVERY DetailKind to a real (non-stub) body, except the documented dead kinds", () => {
    for (const kind of ALL_DETAIL_KINDS) {
      const id = DETAIL_BODY[kind]
      expect(id, `kind "${kind}" must map to a body`).toBeDefined()
      if (DEAD.has(kind)) {
        // A dead kind (no producer) is allowed - and expected - to be a stub.
        expect(isRealBody(id), `dead kind "${kind}" should be a stub`).toBe(false)
      } else {
        expect(isRealBody(id), `kind "${kind}" resolved to a STUB, not a real body`).toBe(true)
      }
    }
  })

  it("the VIEW_BODY keys are exactly the canonical View set (no missing / extra)", () => {
    expect(Object.keys(VIEW_BODY).sort()).toEqual([...ALL_VIEWS].sort())
  })

  it("the DETAIL_BODY keys are exactly the canonical DetailKind set (no missing / extra)", () => {
    expect(Object.keys(DETAIL_BODY).sort()).toEqual([...ALL_DETAIL_KINDS].sort())
  })

  it("pinned-messages (P3 Task 3.8) resolves to its OWN body id (the pinnedOnly ConversationBody)", () => {
    // The pinned list is a distinct BodyId so BodyRouter can pass pinnedOnly; it must not silently
    // alias the plain "conversation" body (which would render a live thread with a composer).
    expect(DETAIL_BODY["pinned-messages"]).toBe("pinnedMessages")
  })

  it("group-info (P4 Task 4.8) resolves to its OWN body id (GroupInfoBody)", () => {
    // The group management surface is a distinct body - it must not alias the roster-only
    // "members" body (no actions/roles there) or the conversation.
    expect(DETAIL_BODY["group-info"]).toBe("groupInfo")
  })

  it("maps feed-first views and post details to their dedicated body ids", () => {
    expect(VIEW_BODY.home).toBe("feed")
    expect(VIEW_BODY.map).toBe("mapView")
    expect(VIEW_BODY.search).toBe("search")
    expect(DETAIL_BODY.post).toBe("post")
    expect(DETAIL_BODY["post-thread"]).toBe("postThread")
    expect(DETAIL_BODY.composer).toBe("postComposer")
    expect(DETAIL_BODY.saves).toBe("saves")
  })

  it("routes person to its own body, rendered as a FULL page (P8)", () => {
    // The routing half was always true; the LAYOUT half is the P8 flip and is what this locks. `person`
    // stopped being a "scroll" pull-up and became a full PAGE on the shell's overlay layer, which is what
    // gives PersonDetailBody its own 52pt header and lets its child drill-downs ride over it as sheets.
    expect(DETAIL_BODY.person).toBe("personDetail")
    expect(BODY_LAYOUT.person).toBe("full")
  })

  it("the only stub in the tables is the documented dead kind(s)", () => {
    const stubViews = ALL_VIEWS.filter((v) => !isRealBody(VIEW_BODY[v]))
    const stubKinds = ALL_DETAIL_KINDS.filter((k) => !isRealBody(DETAIL_BODY[k]))
    expect(stubViews, "no list view may be a stub").toEqual([])
    expect(stubKinds, "the only stub kinds must be the documented dead ones").toEqual([...DEAD_DETAIL_KINDS])
  })
})
