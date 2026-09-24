/**
 * `useChat` has no renderer in this package, so its dependency lists are pinned at the source. The
 * reconnect replay must run once per closed-to-open edge, yet read the outbox and senders of the latest
 * committed render; room-bound callbacks must still change identity on an in-place room switch.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { expectInSourceOrder, expectWrittenInLayoutEffect, sliceBetween } from "../../__tests__/sourceGuards"

const SRC = readFileSync(new URL("../hooks/chat.ts", import.meta.url), "utf8")
const OUTBOX = readFileSync(new URL("../hooks/chatOutbox.ts", import.meta.url), "utf8")
const HISTORY = readFileSync(new URL("../hooks/chatHistory.ts", import.meta.url), "utf8")
const ACTIONS = readFileSync(new URL("../hooks/chatMessageActions.ts", import.meta.url), "utf8")

describe("useChat reconnect replay", () => {
  it("fires only on the connection edge", () => {
    const effect = sliceBetween(SRC, 'const open = connection === "open"', "if (!history.isFetching) drainCacheOps()")
    expect(effect).toContain("if (open && !wasOpenRef.current) replayOnReconnectRef.current()")
    expect(effect).toContain("}, [connection])")
  })

  it("reads the last committed render, never a discarded one", () => {
    expectWrittenInLayoutEffect(SRC, "replayOnReconnectRef.current = () => {")
    const replay = sliceBetween(SRC, "replayOnReconnectRef.current = () => {", "useEffect(() => {")
    expect(replay).toContain("replayOutbox()")
    expect(replay).toContain("refreshNewestPage()")
    const outboxReplay = sliceBetween(OUTBOX, "const replayOutbox = () => {", "const send = useCallback")
    expect(outboxReplay).toContain("replayableEntries(outbox,")
  })
})

describe("useChat effect order", () => {
  it("declares the socket lifecycle, room reset, typing unmount, reconnect replay, drain and read-ack debounce in that order", () => {
    expectInSourceOrder(SRC, [
      "useChatRoomSocket({",
      "setLiveMessages([])",
      "useClearTypingTimersOnUnmount(",
      "replayOnReconnectRef.current = () => {",
      "if (open && !wasOpenRef.current) replayOnReconnectRef.current()",
      "if (!history.isFetching) drainCacheOps()",
      "useDebouncedReadAck({",
    ])
  })
})

describe("room-bound callbacks follow an in-place room switch", () => {
  it("findMessage and patchMessage re-create when the room id or kind changes", () => {
    const find = sliceBetween(HISTORY, "const findMessage = useCallback", "const isHistoryFetchInFlight")
    expect(find).toContain("[queryClient, roomId, roomKind, aroundWindowRef, liveMessagesRef],")
    const patch = sliceBetween(HISTORY, "const patchMessage = useCallback", "const resetHistoryJournal")
    expect(patch).toContain(
      "[queryClient, roomId, roomKind, isHistoryFetchInFlight, setLiveMessages, setAroundWindow],",
    )
  })

  it("delete and votePoll inherit that identity through findMessage and patchMessage", () => {
    const del = sliceBetween(ACTIONS, "const deleteMessage = useCallback", "const setPinned = useCallback")
    expect(del).toMatch(/\[[^\]]*roomId, findMessage, patchMessage\],/)
    const vote = sliceBetween(ACTIONS, "const votePoll = useCallback", "const closePoll = useCallback")
    expect(vote).toContain("[api, findMessage, patchMessage],")
  })
})
