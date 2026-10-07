/**
 * Guards a user-reachable view or detail kind silently falling through BodyRouter to the placeholder
 * Stub. The body components import react-native, which does not load under this package's node vitest, so
 * the routing decision lives in the pure ../bodyRoutes tables and this test asserts on them: a non-stub
 * BodyId is exactly what BodyRouter renders as a real body. TS already enforces key totality; this adds
 * "non-stub" (which TS cannot express) and exact key-set equality with the canonical arrays.
 */
import { describe, it, expect } from "vitest"
import { VIEW_BODY, DETAIL_BODY, type BodyId } from "../bodyRoutes"
import { BODY_LAYOUT } from "../bodyLayout"
import { ALL_VIEWS, ALL_DETAIL_KINDS, DEAD_DETAIL_KINDS } from "../../nav"

const DEAD = new Set<string>(DEAD_DETAIL_KINDS)

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
        // A dead kind (no producer) is expected to be a stub.
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

  it("pinned-messages resolves to its OWN body id (the pinnedOnly ConversationBody)", () => {
    // The pinned list is a distinct BodyId so BodyRouter can pass pinnedOnly; it must not silently
    // alias the plain "conversation" body (which would render a live thread with a composer).
    expect(DETAIL_BODY["pinned-messages"]).toBe("pinnedMessages")
  })

  it("group-info resolves to its OWN body id (GroupInfoBody)", () => {
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

  it("routes person to its own body, rendered as a FULL page", () => {
    // As a full page on the overlay layer, PersonDetailBody owns its 52pt header and its child
    // drill-downs ride over it as sheets.
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
