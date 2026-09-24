/**
 * `useChat` keeps one socket and one hook instance across an in-place room switch (web's BodyRouter
 * renders the conversation unkeyed), so every frame, cache op and pending bubble has to be scoped to
 * the room it belongs to. `frameInRoom` is exercised directly; the hook-internal guards need a React
 * renderer this package does not have, so they are pinned at the source.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { frameInRoom } from "../inbound"

const readHook = (file: string): string => readFileSync(join(__dirname, "..", "hooks", file), "utf8")
const SRC = readHook("chat.ts")
const HISTORY = readHook("chatHistory.ts")
const SOCKET = readHook("chatRoomSocket.ts")

function section(start: string, end: string, source: string = SRC): string {
  const from = source.indexOf(start)
  expect(from).toBeGreaterThan(-1)
  const to = source.indexOf(end, from)
  expect(to).toBeGreaterThan(from)
  return source.slice(from, to)
}

describe("frameInRoom", () => {
  it("matches a cleanup room when the frame carries no roomKind", () => {
    expect(frameInRoom({ cleanupId: "r-1" }, "r-1", "cleanup")).toBe(true)
  })

  it("matches a stamped non-cleanup room of the same kind", () => {
    expect(frameInRoom({ cleanupId: "r-1", roomKind: "dm" }, "r-1", "dm")).toBe(true)
  })

  it("rejects the same id in a different room kind", () => {
    expect(frameInRoom({ cleanupId: "r-1", roomKind: "report" }, "r-1", "group")).toBe(false)
    expect(frameInRoom({ cleanupId: "r-1" }, "r-1", "dm")).toBe(false)
  })

  it("rejects a different room id", () => {
    expect(frameInRoom({ cleanupId: "r-2" }, "r-1", "cleanup")).toBe(false)
  })

  it("scopes reaction, presence, presence_snapshot and typing frames by kind as well as id", () => {
    const handler = section("const offMessage = socket.subscribe", "socket.join(roomId, roomKind)", SOCKET)
    for (const kind of ["reaction", "presence_snapshot", "presence", "typing"]) {
      const body = handler.slice(handler.indexOf(`case "${kind}":`))
      expect(body.slice(0, body.indexOf("break"))).toContain("frameInRoom(frame, roomId, roomKind)")
    }
  })
})

describe("room switch scoping in useChat", () => {
  it("drops a gap-fill page that resolves after the room changed instead of journaling it into the new room", () => {
    const refresh = section("const refreshNewestPage = useCallback", "}, [api, canReadHistory", HISTORY)
    const guard = refresh.indexOf("if (roomGenerationRef.current !== generation) {")
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(refresh.indexOf("cacheOpsRef.current.push(op)"))
    const reset = section("setLiveMessages([])\n    setOutbox([])", "}, [roomId, roomKind, clearTypingState])")
    expect(reset).toContain("resetHistoryJournal()")
    expect(section("const resetHistoryJournal = useCallback", "}, [])", HISTORY)).toContain(
      "roomGenerationRef.current++",
    )
  })

  it("marks the room it left stale when its gap-fill is dropped, so reopening that room refetches the gap", () => {
    const refresh = section("const refreshNewestPage = useCallback", "}, [api, canReadHistory", HISTORY)
    const from = refresh.indexOf("if (roomGenerationRef.current !== generation) {")
    expect(from).toBeGreaterThan(-1)
    const to = refresh.indexOf("return\n", from)
    expect(to).toBeGreaterThan(from)
    expect(refresh.slice(from, to)).toContain(
      'void queryClient.invalidateQueries({ queryKey: key, refetchType: "none" })',
    )
    expect(refresh.slice(0, from)).toContain("const key = queryKeys.chatHistory(roomId, roomKind)")
  })

  it("renders only the current room's pending bubbles", () => {
    const memo = section("const items = useMemo<ChatItem[]>", "const pins = useMemo")
    expect(memo).toContain("outbox.filter((e) => e.message.cleanupId === roomId)")
    expect(memo).not.toMatch(/mergeChatItems\(historyItems, live, outbox,/)
  })

  it("marks the history stale when a reconnect gap-fill fails so the next mount or focus refetches", () => {
    const refresh = section("const refreshNewestPage = useCallback", "}, [api, canReadHistory", HISTORY)
    expect(refresh).not.toContain(".catch(() => {})")
    expect(refresh).toContain('queryClient.invalidateQueries({ queryKey: key, refetchType: "none" })')
  })
})
