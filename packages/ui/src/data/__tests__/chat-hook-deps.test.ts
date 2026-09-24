/**
 * `useChat` has no renderer in this package, so its dependency lists are pinned at the source. The
 * reconnect replay must run once per closed-to-open edge, yet read the outbox and senders of the latest
 * committed render; room-bound callbacks must still change identity on an in-place room switch.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { expectWrittenInLayoutEffect, sliceBetween } from "../../__tests__/sourceGuards"

const SRC = readFileSync(new URL("../hooks/chat.ts", import.meta.url), "utf8")

describe("useChat reconnect replay", () => {
  it("fires only on the connection edge", () => {
    const effect = sliceBetween(SRC, 'const open = connection === "open"', "const send = useCallback")
    expect(effect).toContain("if (open && !wasOpenRef.current) replayOnReconnectRef.current()")
    expect(effect).toContain("}, [connection])")
  })

  it("reads the last committed render, never a discarded one", () => {
    expectWrittenInLayoutEffect(SRC, "replayOnReconnectRef.current = () => {")
    const replay = sliceBetween(SRC, "replayOnReconnectRef.current = () => {", "useEffect(() => {")
    expect(replay).toContain("replayableEntries(outbox,")
    expect(replay).toContain("refreshNewestPage()")
  })
})

describe("room-bound callbacks follow an in-place room switch", () => {
  it("findMessage and patchMessage re-create when the room id or kind changes", () => {
    const find = sliceBetween(SRC, "const findMessage = useCallback", "const clearSendTimer")
    expect(find).toContain("[queryClient, roomId, roomKind],")
    const patch = sliceBetween(SRC, "const patchMessage = useCallback", "patchMessageRef.current = patchMessage")
    expect(patch).toContain("[queryClient, roomId, roomKind, isHistoryFetchInFlight],")
  })

  it("delete and votePoll inherit that identity through findMessage and patchMessage", () => {
    const del = sliceBetween(SRC, "const deleteMessage = useCallback", "const setPinned = useCallback")
    expect(del).toMatch(/\[[^\]]*roomId, findMessage, patchMessage\],/)
    const vote = sliceBetween(SRC, "const votePoll = useCallback", "const closePoll = useCallback")
    expect(vote).toContain("[api, findMessage, patchMessage],")
  })
})
