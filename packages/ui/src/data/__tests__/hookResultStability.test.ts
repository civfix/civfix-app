/**
 * Hook-shape guarantees that keep consumers from re-rendering or reconnecting for nothing. The hooks
 * need a React renderer this package does not have, so the shapes are pinned at the source.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { sliceBetween } from "../../__tests__/sourceGuards"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("query hooks keep TanStack's tracked-property subscription", () => {
  it("useUserSearch and useNotifications pick fields instead of spreading the query result", () => {
    const direct = code(read("../hooks/direct.ts"))
    const notifications = code(read("../hooks/notifications.ts"))
    expect(direct).not.toContain("...query")
    expect(notifications).not.toContain("...query")
    expect(direct).toContain("return { data, isLoading, isPending, isError, refetch, term: trimmed }")
    expect(notifications).toContain("return { data, isLoading, isError, unreadCount }")
  })

  it("useReportSearch memoizes its flattened items and hands out stable callbacks", () => {
    const reports = code(read("../hooks/reports.ts"))
    expect(reports).toContain("const items = useMemo<ReportPinDTO[]>(")
    expect(reports).toContain("const fetchNextPage = useCallback(")
    expect(reports).toContain("const refetch = useCallback(")
  })

  it("useStartDm depends on the mutation's stable mutate, not the result object", () => {
    const direct = code(read("../hooks/direct.ts"))
    expect(direct).toContain("const { mutate: openDm, isPending } = useOpenDm()")
    expect(direct).toContain("[requireAuth, openDm],")
  })
})

describe("superseded type-ahead and pan queries abort their request", () => {
  it.each([
    ["../hooks/direct.ts", "api.searchUsers({ q: trimmed, limit: USER_SEARCH_LIMIT }, { signal })"],
    ["../hooks/social.ts", "api.checkHandle({ handle: candidate }, { signal })"],
    ["../hooks/social.ts", "api.mentionSearch({ q: trimmed }, { signal })"],
  ])("%s passes TanStack's signal through", (file, call) => {
    expect(code(read(file))).toContain(call)
  })

  it("map pins, report search and the audience preview pass the signal as the call's extra", () => {
    const reports = code(read("../hooks/reports.ts"))
    expect(reports).toMatch(/queryFn: \(\{ signal \}\) =>\s*api\.mapReports\([\s\S]*?\{ signal \},\s*\)/)
    expect(reports).toMatch(/queryFn: \(\{ pageParam, signal \}\) =>\s*api\.searchReports\([\s\S]*?\{ signal \},\s*\)/)
    expect(code(read("../hooks/announcements.ts"))).toMatch(
      /queryFn: \(\{ signal \}\) =>\s*api\.previewEventBroadcast\([\s\S]*?\{ signal \},\s*\)/,
    )
  })
})

describe("a room switch reuses the chat socket", () => {
  const SOCKET = code(read("../hooks/chatRoomSocket.ts"))

  it("holds the socket in its own effect, keyed off the room", () => {
    const join = sliceBetween(SOCKET, "setJoinRejected(null)", "useEffect(() => {\n    if (!enabled) return")
    expect(join).not.toContain("socket.retain()")
    expect(join).not.toContain("socket.release()")
    expect(SOCKET).toMatch(
      /useEffect\(\(\) => \{\s*if \(!enabled\) return\s*socket\.retain\(\)\s*return \(\) => socket\.release\(\)\s*\}, \[socket, enabled, myUserId\]\)/,
    )
  })

  it("declares the hold after the join effect, so unmount flushes and leaves before releasing", () => {
    expect(SOCKET.indexOf("socket.leave(roomId, roomKind)")).toBeLessThan(SOCKET.indexOf("socket.release()"))
    expect(SOCKET.indexOf("socket.join(roomId, roomKind)")).toBeLessThan(SOCKET.indexOf("socket.retain()"))
  })
})
