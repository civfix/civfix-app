import { describe, expect, it } from "vitest"
import type { MessageThreadDTO } from "@civfix/shared"
import { threadMatchesRoom, threadRoomId } from "../threadRoom"

const thread = (overrides: Partial<MessageThreadDTO>): MessageThreadDTO =>
  ({ id: "t1", kind: "report", refId: "r1", ...overrides }) as MessageThreadDTO

describe("threadRoomId", () => {
  it("keys a room thread by the entity it fronts", () => {
    expect(threadRoomId(thread({ refId: "r1" }))).toBe("r1")
  })

  it("falls back to the thread's own id when there is no ref (a DM)", () => {
    expect(threadRoomId(thread({ kind: "dm", refId: null }))).toBe("t1")
    expect(threadRoomId(thread({ kind: "dm", refId: undefined }))).toBe("t1")
  })
})

describe("threadMatchesRoom", () => {
  it("matches on the room kind AND the room id", () => {
    expect(threadMatchesRoom(thread({}), "report", "r1")).toBe(true)
    expect(threadMatchesRoom(thread({}), "group", "r1")).toBe(false)
    expect(threadMatchesRoom(thread({}), "report", "t1")).toBe(false)
  })
})
