import { beforeEach, describe, expect, it } from "vitest"
import { useNavStore } from "../../nav"
import type { DetailEntry } from "../../nav"
import { openPinnedMessages, clearThreadJumpParam, openThread, openNewGroup, openGroupInfo, isTopEntry } from "../navHelpers"

function resetStore(): void {
  useNavStore.setState({
    view: "home",
    stack: [],
    active: null,
    snap: 0,
    snapAnimated: true,
    query: "",
    mode: "compact",
    originView: null,
  })
}

beforeEach(() => resetStore())

describe("openPinnedMessages", () => {
  it("pushes the pinned-messages detail as a drill-down (thread stays beneath for Back)", () => {
    const thread: DetailEntry = { kind: "thread", id: "room1", roomKind: "report" }
    useNavStore.getState().push(thread)
    openPinnedMessages("room1", "report")
    const s = useNavStore.getState()
    expect(s.stack).toEqual([thread, { kind: "pinned-messages", id: "room1", roomKind: "report" }])
    expect(s.active).toEqual({ kind: "pinned-messages", id: "room1", roomKind: "report" })
    useNavStore.getState().back()
    expect(useNavStore.getState().active).toEqual(thread)
  })
})

describe("openThread (group threads)", () => {
  it("a kind:'group' thread opens roomKind:'group' keyed on the refId (room id), carrying the title", () => {
    openThread({
      id: "t1",
      kind: "group",
      title: "Block crew",
      refId: "room-g1",
      unread: 0,
      members: 4,
      lastFromMe: false,
      muted: false,
    })
    expect(useNavStore.getState().active).toEqual({
      kind: "thread",
      id: "room-g1",
      roomKind: "group",
      title: "Block crew",
    })
  })

  it("falls back to the thread id when refId is absent", () => {
    openThread({ id: "t2", kind: "group", title: "G", unread: 0, members: 2, lastFromMe: false, muted: false })
    expect(useNavStore.getState().active).toMatchObject({ kind: "thread", id: "t2", roomKind: "group" })
  })
})

describe("openNewGroup", () => {
  it("pushes the new-group wizard as a drill-down (the launcher stays beneath for Back)", () => {
    const parent: DetailEntry = { kind: "people" }
    useNavStore.getState().push(parent)
    openNewGroup()
    const s = useNavStore.getState()
    expect(s.stack).toEqual([parent, { kind: "new-group" }])
    expect(s.active).toEqual({ kind: "new-group" })
  })
})

describe("openThread press dedupe", () => {
  const inboxRow = {
    id: "t1",
    kind: "cleanup" as const,
    title: "Crew",
    refId: "room-c1",
    unread: 0,
    members: 3,
    lastFromMe: false,
    muted: false,
  }

  it("a second identical press is a no-op (the same room is already on top)", () => {
    openThread(inboxRow)
    const after = useNavStore.getState().stack
    openThread(inboxRow)
    expect(useNavStore.getState().stack).toBe(after)
    expect(useNavStore.getState().stack).toHaveLength(1)
  })

  it("still opens a DIFFERENT room, and re-opens the same room from elsewhere in the stack", () => {
    openThread(inboxRow)
    openThread({ ...inboxRow, id: "t2", refId: "room-c2" })
    expect(useNavStore.getState().stack).toHaveLength(2)
    useNavStore.getState().push({ kind: "person", id: "p1" })
    openThread(inboxRow)
    expect(useNavStore.getState().stack).toHaveLength(4)
    expect(useNavStore.getState().active).toMatchObject({ kind: "thread", id: "room-c1" })
  })
})

describe("isTopEntry", () => {
  it("matches only the top of the stack, by kind AND id", () => {
    const stack = [
      { kind: "thread", id: "a" },
      { kind: "person", id: "b" },
    ]
    expect(isTopEntry(stack, "person", "b")).toBe(true)
    expect(isTopEntry(stack, "thread", "a")).toBe(false)
    expect(isTopEntry(stack, "person", "a")).toBe(false)
    expect(isTopEntry([], "thread", "a")).toBe(false)
  })
})

describe("openGroupInfo", () => {
  it("pushes the group-info detail as a drill-down (the conversation stays beneath for Back)", () => {
    const thread: DetailEntry = { kind: "thread", id: "room-g1", roomKind: "group", title: "Block crew" }
    useNavStore.getState().push(thread)
    openGroupInfo("room-g1")
    const s = useNavStore.getState()
    expect(s.stack).toEqual([thread, { kind: "group-info", id: "room-g1" }])
    expect(s.active).toEqual({ kind: "group-info", id: "room-g1" })
    useNavStore.getState().back()
    expect(useNavStore.getState().active).toEqual(thread)
  })
})

describe("clearThreadJumpParam", () => {
  it("strips a consumed jumpToMessageId off the room's thread entry (active recomputed)", () => {
    useNavStore.getState().setStack([{ kind: "thread", id: "room1", roomKind: "cleanup", jumpToMessageId: "m9" }])
    clearThreadJumpParam("room1")
    const s = useNavStore.getState()
    expect(s.stack).toEqual([{ kind: "thread", id: "room1", roomKind: "cleanup" }])
    expect(s.active).toEqual({ kind: "thread", id: "room1", roomKind: "cleanup" })
    expect(s.active?.jumpToMessageId).toBeUndefined()
  })

  it("full round-trip: jump from the pinned view, then consumption leaves NO param behind", () => {
    useNavStore.getState().setStack([
      { kind: "thread", id: "room1", roomKind: "dm" },
      { kind: "pinned-messages", id: "room1", roomKind: "dm" },
    ])
    const nav = useNavStore.getState()
    nav.setStack([{ kind: "thread", id: "room1", roomKind: "dm", jumpToMessageId: "m42" }])
    expect(useNavStore.getState().active?.jumpToMessageId).toBe("m42")
    clearThreadJumpParam("room1")
    expect(useNavStore.getState().active).toEqual({ kind: "thread", id: "room1", roomKind: "dm" })
  })

  it("leaves other rooms' thread entries and non-thread entries untouched", () => {
    const other: DetailEntry = { kind: "thread", id: "other", roomKind: "cleanup", jumpToMessageId: "keep" }
    const person: DetailEntry = { kind: "person", id: "p1" }
    const mine: DetailEntry = { kind: "thread", id: "room1", roomKind: "cleanup", jumpToMessageId: "gone" }
    useNavStore.getState().setStack([other, person, mine])
    clearThreadJumpParam("room1")
    expect(useNavStore.getState().stack).toEqual([other, person, { kind: "thread", id: "room1", roomKind: "cleanup" }])
  })

  it("is a pure no-op (no store write) when nothing carries the param", () => {
    const stack: DetailEntry[] = [{ kind: "thread", id: "room1", roomKind: "cleanup" }]
    useNavStore.getState().setStack(stack)
    const before = useNavStore.getState().stack
    clearThreadJumpParam("room1")
    expect(useNavStore.getState().stack).toBe(before)
  })
})
