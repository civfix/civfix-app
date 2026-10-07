import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider, notifyManager, type InfiniteData } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  AppError,
  ErrorCode,
  type ChatHistoryResponse,
  type ChatMessageDTO,
  type PersonDTO,
  type RoomKind,
  type UserDTO,
  type WsClientMessage,
  type WsServerMessage,
} from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"
import { ApiProvider } from "../context"
import { makeFakeDataContext } from "../fakes"
import { queryKeys } from "../keys"
import {
  QUEUED_SEND_TIMEOUT_MS,
  SEND_TIMEOUT_MS,
  useChat,
  type UseChatOptions,
  type UseChatResult,
} from "../hooks/chat"
import type { ChatConnState, ChatSendOutcome, ChatSocketLike } from "../types"

const NOW = Date.parse("2026-09-01T12:00:00.000Z")
const ROOM_A = "room-a"
const ROOM_B = "room-b"
const ME = "u-me"
const OTHER = "u-other"
const ME_USER = { id: ME, displayName: "Mia Me" } as unknown as UserDTO

// React Query notifies observers on a zero-delay timeout, which fake timers push 1 ms out when it is
// scheduled mid-tick; a microtask keeps cache writes visible without moving the clock under test.
notifyManager.setScheduler(queueMicrotask)

type ClientFrame<T extends WsClientMessage["type"]> = Extract<WsClientMessage, { type: T }>

class FakeChatSocket implements ChatSocketLike {
  status: ChatConnState
  outcome: ChatSendOutcome = "sent"
  readonly sent: WsClientMessage[] = []
  readonly log: string[] = []
  private readonly frameHandlers = new Set<(frame: WsServerMessage) => void>()
  private readonly statusHandlers = new Set<(status: ChatConnState) => void>()

  constructor(status: ChatConnState = "open") {
    this.status = status
  }

  retain = () => {
    this.log.push("retain")
  }
  release = () => {
    this.log.push("release")
  }
  join = (roomId: string, roomKind: RoomKind) => {
    this.log.push(`join ${roomKind}:${roomId}`)
  }
  leave = (roomId: string, roomKind: RoomKind) => {
    this.log.push(`leave ${roomKind}:${roomId}`)
  }
  markRoomRejected = (roomId: string, roomKind: RoomKind) => {
    this.log.push(`rejected ${roomKind}:${roomId}`)
  }
  send = (frame: WsClientMessage) => {
    this.sent.push(frame)
    this.log.push(`send ${frame.type}`)
    return this.outcome
  }
  subscribe = (handler: (frame: WsServerMessage) => void) => {
    this.frameHandlers.add(handler)
    return () => {
      this.frameHandlers.delete(handler)
    }
  }
  onStatus = (handler: (status: ChatConnState) => void) => {
    this.statusHandlers.add(handler)
    handler(this.status)
    return () => {
      this.statusHandlers.delete(handler)
    }
  }
  getStatus = () => this.status

  emit(frame: WsServerMessage): void {
    act(() => {
      for (const handler of [...this.frameHandlers]) handler(frame)
    })
  }

  setStatus(status: ChatConnState): void {
    act(() => {
      this.status = status
      for (const handler of [...this.statusHandlers]) handler(status)
    })
  }

  framesOf<T extends WsClientMessage["type"]>(type: T): ClientFrame<T>[] {
    return this.sent.filter((f): f is ClientFrame<T> => f.type === type)
  }
}

function person(id: string, name = `Name ${id}`): PersonDTO {
  return { id, name, avatar: null, followers: 0, following: 0, isFollowing: false }
}

function at(seconds: number): string {
  return new Date(NOW - 3_600_000 + seconds * 1000).toISOString()
}

function msg(id: string, seconds: number, over: Partial<ChatMessageDTO> = {}): ChatMessageDTO {
  return {
    id,
    cleanupId: ROOM_A,
    from: person(OTHER),
    body: `body ${id}`,
    kind: "text",
    attachments: [],
    reactions: [],
    mentions: [],
    createdAt: at(seconds),
    ...over,
  }
}

function page(items: ChatMessageDTO[], nextCursor: string | null = null): ChatHistoryResponse {
  return { items, nextCursor }
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (err: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

interface HistoryQuery {
  cleanupId?: string
  threadId?: string
  id?: string
  before?: string
  around?: string
  limit?: number
}

function makeChatApi(rooms: Record<string, ChatHistoryResponse>) {
  const serve = (roomId: string | undefined): Promise<ChatHistoryResponse> =>
    Promise.resolve(rooms[roomId ?? ""] ?? page([]))
  return {
    cleanupMessages: vi.fn((q: HistoryQuery) => serve(q.cleanupId)),
    dmMessages: vi.fn((q: HistoryQuery) => serve(q.threadId)),
    reportMessages: vi.fn((q: HistoryQuery) => serve(q.id)),
    groupMessages: vi.fn((q: HistoryQuery) => serve(q.id)),
    toggleCleanupMessageReaction: vi.fn(),
    toggleDmMessageReaction: vi.fn(),
    toggleReportMessageReaction: vi.fn(),
    toggleMessageReaction: vi.fn(),
    editChatMessage: vi.fn(),
    editDmMessage: vi.fn(),
    deleteCleanupMessage: vi.fn(),
    deleteDmMessage: vi.fn(),
    deleteReportMessage: vi.fn(),
    deleteGroupMessage: vi.fn(),
    setMessagePinned: vi.fn(),
    createPoll: vi.fn(),
    votePoll: vi.fn(),
    closePoll: vi.fn(),
  }
}

type ChatApi = ReturnType<typeof makeChatApi>

interface ChatProps {
  roomId: string
  roomKind?: RoomKind
  options?: UseChatOptions
}

interface RenderedFrame {
  roomId: string
  result: UseChatResult
}

function renderChat({
  api,
  socket,
  props = {},
  user = ME_USER,
}: {
  api: ChatApi
  socket: FakeChatSocket
  props?: Partial<ChatProps>
  user?: UserDTO | null
}) {
  const queryClient = new QueryClient()
  const context = makeFakeDataContext({
    api: api as unknown as ApiClient,
    chatSocket: socket,
    auth: user ? { isAuthenticated: true, user } : {},
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>{children}</ApiProvider>
    </QueryClientProvider>
  )
  const frames: RenderedFrame[] = []
  const hook = renderHook(
    (p: ChatProps) => {
      const result = useChat(p.roomId, p.roomKind, p.options)
      frames.push({ roomId: p.roomId, result })
      return result
    },
    { wrapper, initialProps: { roomId: ROOM_A, ...props } },
  )
  return { ...hook, queryClient, frames }
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(0)
  })
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
  await settle()
}

const ids = (result: UseChatResult): string[] => result.items.map((it) => it.message.id)

function cachedIds(queryClient: QueryClient, roomId = ROOM_A, roomKind: RoomKind = "cleanup"): string[][] {
  const data = queryClient.getQueryData<InfiniteData<ChatHistoryResponse>>(
    queryKeys.chatHistory(roomId, roomKind),
  )
  return (data?.pages ?? []).map((p) => p.items.map((m) => m.id))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useChat history load", () => {
  it("loads the newest cleanup page with a 30-message limit and renders it oldest first", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m2", 20), msg("m1", 10)], "cursor-1") })
    const { result } = renderChat({ api, socket: new FakeChatSocket() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.items).toEqual([])
    await settle()

    expect(api.cleanupMessages).toHaveBeenCalledTimes(1)
    expect(api.cleanupMessages).toHaveBeenCalledWith({ cleanupId: ROOM_A, limit: 30 })
    expect(result.current.isLoading).toBe(false)
    expect(ids(result.current)).toEqual(["m1", "m2"])
    expect(result.current.items.every((it) => !it.pending && !it.failed && !it.mine)).toBe(true)
    expect(result.current.hasMore).toBe(true)
  })

  it("loadOlder requests the page before the cursor and prepends it", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m1", 10)], "cursor-1") })
    const { result } = renderChat({ api, socket: new FakeChatSocket() })
    await settle()

    const older = deferred<ChatHistoryResponse>()
    api.cleanupMessages.mockReturnValueOnce(older.promise)
    act(() => result.current.loadOlder())
    await settle()
    expect(result.current.isLoadingMore).toBe(true)

    await act(async () => older.resolve(page([msg("m0", 5)])))
    await settle()

    expect(api.cleanupMessages).toHaveBeenLastCalledWith({ cleanupId: ROOM_A, before: "cursor-1", limit: 30 })
    expect(ids(result.current)).toEqual(["m0", "m1"])
    expect(result.current.hasMore).toBe(false)
    expect(result.current.isLoadingMore).toBe(false)
  })

  it.each([
    ["dm", "dmMessages", { threadId: ROOM_A, limit: 30 }],
    ["report", "reportMessages", { id: ROOM_A, limit: 30 }],
    ["group", "groupMessages", { id: ROOM_A, limit: 30 }],
  ] as const)("reads a %s room through %s", async (roomKind, method, args) => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) })
    const { result } = renderChat({ api, socket: new FakeChatSocket(), props: { roomKind } })
    await settle()

    expect(api[method]).toHaveBeenCalledWith(args)
    expect(api.cleanupMessages).not.toHaveBeenCalled()
    expect(ids(result.current)).toEqual(["m1"])
  })

  it("joins, retains and reports the socket status on mount, then leaves and releases on unmount", async () => {
    const socket = new FakeChatSocket("connecting")
    const { result, unmount } = renderChat({ api: makeChatApi({}), socket })
    await settle()

    expect(socket.log).toEqual(["join cleanup:room-a", "retain"])
    expect(result.current.connection).toBe("connecting")
    expect(result.current.liveDisabled).toBe(false)

    socket.setStatus("open")
    expect(result.current.connection).toBe("open")

    unmount()
    expect(socket.log).toEqual(["join cleanup:room-a", "retain", "leave cleanup:room-a", "release"])
  })

  it("keeps a signed-out cleanup room offline: no history, no join, live disabled", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) })
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api, socket, user: null })
    await settle()

    expect(api.cleanupMessages).not.toHaveBeenCalled()
    expect(socket.log).toEqual([])
    expect(result.current.connection).toBe("closed")
    expect(result.current.liveDisabled).toBe(true)
    expect(result.current.items).toEqual([])
  })

  it("still reads a report room's history for a signed-out viewer, without joining it", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) })
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api, socket, user: null, props: { roomKind: "report" } })
    await settle()

    expect(api.reportMessages).toHaveBeenCalledWith({ id: ROOM_A, limit: 30 })
    expect(ids(result.current)).toEqual(["m1"])
    expect(socket.log).toEqual([])
    expect(result.current.liveDisabled).toBe(true)
  })

  it("flags a NOT_FOUND history as not found", async () => {
    const api = makeChatApi({})
    api.cleanupMessages.mockRejectedValueOnce(new AppError(ErrorCode.NOT_FOUND, "gone"))
    const { result } = renderChat({ api, socket: new FakeChatSocket() })
    await settle()

    expect(result.current.isError).toBe(true)
    expect(result.current.isNotFound).toBe(true)
    expect(result.current.isForbidden).toBe(false)
    expect(result.current.roomError).toBeNull()
  })

  it("turns a FORBIDDEN DM history into a room error, but not a FORBIDDEN cleanup history", async () => {
    const dmApi = makeChatApi({})
    dmApi.dmMessages.mockRejectedValueOnce(new AppError(ErrorCode.FORBIDDEN, "no"))
    const dm = renderChat({ api: dmApi, socket: new FakeChatSocket(), props: { roomKind: "dm" } })
    await settle()
    expect(dm.result.current.isForbidden).toBe(true)
    expect(dm.result.current.roomError).toEqual({
      code: ErrorCode.FORBIDDEN,
      message: "This person isn't accepting messages.",
    })
    dm.unmount()

    const cleanupApi = makeChatApi({})
    cleanupApi.cleanupMessages.mockRejectedValueOnce(new AppError(ErrorCode.FORBIDDEN, "no"))
    const cleanup = renderChat({ api: cleanupApi, socket: new FakeChatSocket() })
    await settle()
    expect(cleanup.result.current.isForbidden).toBe(true)
    expect(cleanup.result.current.roomError).toBeNull()
  })
})

describe("useChat inbound frames", () => {
  it("buffers a message frame for 50 ms, then appends it to the cached newest page", async () => {
    const socket = new FakeChatSocket()
    const { result, queryClient } = renderChat({ api: makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) }), socket })
    await settle()

    socket.emit({ type: "message", message: msg("m2", 20) })
    await advance(49)
    expect(ids(result.current)).toEqual(["m1"])

    await advance(1)
    expect(ids(result.current)).toEqual(["m1", "m2"])
    expect(cachedIds(queryClient)).toEqual([["m1", "m2"]])
  })

  it("ignores a message frame for another room", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api: makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) }), socket })
    await settle()

    socket.emit({ type: "message", message: msg("x1", 20, { cleanupId: ROOM_B }) })
    await advance(50)

    expect(ids(result.current)).toEqual(["m1"])
  })

  it("shows a frame that lands during the history fetch at once and folds it into the cache when the fetch settles", async () => {
    const api = makeChatApi({})
    const first = deferred<ChatHistoryResponse>()
    api.cleanupMessages.mockReturnValueOnce(first.promise)
    const socket = new FakeChatSocket()
    const { result, queryClient } = renderChat({ api, socket })

    socket.emit({ type: "message", message: msg("m2", 20) })
    await advance(50)
    expect(ids(result.current)).toEqual(["m2"])
    expect(cachedIds(queryClient)).toEqual([])

    await act(async () => first.resolve(page([msg("m1", 10)])))
    await settle()

    expect(ids(result.current)).toEqual(["m1", "m2"])
    expect(cachedIds(queryClient)).toEqual([["m1", "m2"]])
  })

  it("applies a message_update to history and to an open around window", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) })
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api, socket })
    await settle()
    await act(async () => {
      await result.current.fetchAround("m1")
    })
    expect(result.current.aroundWindow?.map((it) => it.message.body)).toEqual(["body m1"])

    socket.emit({ type: "message_update", roomKind: "cleanup", roomId: ROOM_A, message: msg("m1", 10, { body: "edited" }) })
    expect(result.current.aroundWindow?.map((it) => it.message.body)).toEqual(["edited"])

    await advance(50)
    expect(result.current.items.map((it) => it.message.body)).toEqual(["edited"])
  })

  it("ignores a message_update for the same id in a different room kind", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api: makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) }), socket })
    await settle()

    socket.emit({ type: "message_update", roomKind: "group", roomId: ROOM_A, message: msg("m1", 10, { body: "edited" }) })
    await advance(50)

    expect(result.current.items.map((it) => it.message.body)).toEqual(["body m1"])
  })

  it("applies a reaction frame at once but keeps the viewer's own mine flag", async () => {
    const socket = new FakeChatSocket()
    const mine = msg("m1", 10, { reactions: [{ emoji: "like", count: 1, mine: true }] })
    const { result } = renderChat({ api: makeChatApi({ [ROOM_A]: page([mine]) }), socket })
    await settle()

    socket.emit({
      type: "reaction",
      cleanupId: ROOM_A,
      message: msg("m1", 10, { reactions: [{ emoji: "like", count: 2, mine: false }] }),
    })

    expect(result.current.items[0]?.message.reactions).toEqual([{ emoji: "like", count: 2, mine: true }])
  })

  it("ignores typing, presence and reaction frames whose roomKind does not match", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({
      api: makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) }),
      socket,
      props: { roomKind: "group" },
    })
    await settle()
    const reactionsBefore = result.current.items[0]?.message.reactions

    socket.emit({ type: "typing", cleanupId: ROOM_A, roomKind: "dm", userId: OTHER })
    socket.emit({ type: "presence_snapshot", cleanupId: ROOM_A, roomKind: "dm", userIds: [OTHER] })
    socket.emit({
      type: "reaction",
      cleanupId: ROOM_A,
      roomKind: "dm",
      message: msg("m1", 10, { reactions: [{ emoji: "heart", count: 1, mine: false }] }),
    })

    expect(result.current.typingUserIds).toEqual([])
    expect(result.current.onlineCount).toBe(0)
    expect(result.current.items[0]?.message.reactions).toEqual(reactionsBefore)
  })
})

describe("useChat send lifecycle", () => {
  it("trims the body, sends an unstamped cleanup frame and shows a pending own bubble", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api: makeChatApi({}), socket })
    await settle()

    act(() => result.current.send("  hi  "))

    const [frame] = socket.framesOf("send")
    expect(frame).toEqual({ type: "send", cleanupId: ROOM_A, clientId: expect.any(String) as string, body: "hi" })
    const item = result.current.items.at(-1)
    expect(item).toMatchObject({ pending: true, failed: false, mine: true })
    expect(item?.message).toMatchObject({
      id: frame?.clientId,
      clientId: frame?.clientId,
      cleanupId: ROOM_A,
      body: "hi",
      from: { id: ME, name: "Mia Me" },
      createdAt: new Date(NOW).toISOString(),
    })
  })

  it("stamps roomKind and forwards mentions, media ids and the reply target", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({
      api: makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) }),
      socket,
      props: { roomKind: "dm" },
    })
    await settle()

    act(() =>
      result.current.send("yo", ["u-x"], [{ uploadId: "up-1", kind: "image", localUri: "file:///a.jpg" }], "m1"),
    )

    const [frame] = socket.framesOf("send")
    expect(frame).toEqual({
      type: "send",
      cleanupId: ROOM_A,
      roomKind: "dm",
      clientId: expect.any(String) as string,
      body: "yo",
      mentionedUserIds: ["u-x"],
      mediaUploadIds: ["up-1"],
      replyToId: "m1",
    })
    const pending = result.current.items.find((it) => it.pending)
    expect(pending?.message.attachments).toEqual([
      { id: "up-1", kind: "image", url: "file:///a.jpg", thumbUrl: null, status: "validating" },
    ])
    expect(pending?.message.replyTo).toEqual({
      id: "m1",
      from: { id: OTHER, displayName: `Name ${OTHER}` },
      excerpt: "body m1",
      kind: "text",
      deleted: false,
    })
  })

  it("ignores a blank send and any send while signed out", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api: makeChatApi({}), socket })
    await settle()
    act(() => result.current.send("   "))
    expect(socket.framesOf("send")).toEqual([])

    const guestSocket = new FakeChatSocket()
    const guest = renderChat({ api: makeChatApi({}), socket: guestSocket, user: null, props: { roomKind: "report" } })
    await settle()
    act(() => guest.result.current.send("hi"))
    expect(guestSocket.sent).toEqual([])
    expect(guest.result.current.items).toEqual([])
  })

  it("replaces the pending bubble with the acked server message and disarms the send timeout", async () => {
    const socket = new FakeChatSocket()
    const { result, queryClient } = renderChat({ api: makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) }), socket })
    await settle()

    act(() => result.current.send("hi"))
    const clientId = socket.framesOf("send")[0]!.clientId
    socket.emit({
      type: "ack",
      clientId,
      message: msg("srv-1", 3600, { from: person(ME, "Mia Me"), body: "hi" }),
    })
    await advance(50)

    expect(ids(result.current)).toEqual(["m1", "srv-1"])
    expect(result.current.items[1]).toMatchObject({ pending: false, failed: false, mine: true })
    expect(result.current.items[1]?.message.clientId).toBe(clientId)
    expect(cachedIds(queryClient)).toEqual([["m1", "srv-1"]])

    await advance(QUEUED_SEND_TIMEOUT_MS)
    expect(result.current.items.some((it) => it.failed)).toBe(false)
  })

  it("fails a sent message that gets no ack within SEND_TIMEOUT_MS", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api: makeChatApi({}), socket })
    await settle()

    act(() => result.current.send("hi"))
    await advance(SEND_TIMEOUT_MS - 1)
    expect(result.current.items[0]).toMatchObject({ pending: true, failed: false })

    await advance(1)
    expect(result.current.items[0]).toMatchObject({ pending: false, failed: true })
  })

  it("gives a queued message QUEUED_SEND_TIMEOUT_MS before failing it", async () => {
    const socket = new FakeChatSocket()
    socket.outcome = "queued"
    const { result } = renderChat({ api: makeChatApi({}), socket })
    await settle()

    act(() => result.current.send("hi"))
    await advance(SEND_TIMEOUT_MS)
    expect(result.current.items[0]).toMatchObject({ pending: true, failed: false })

    await advance(QUEUED_SEND_TIMEOUT_MS - SEND_TIMEOUT_MS)
    expect(result.current.items[0]).toMatchObject({ pending: false, failed: true })
  })

  it("fails a dropped message at once and re-sends it with the same clientId when the socket reopens", async () => {
    const socket = new FakeChatSocket()
    socket.outcome = "dropped"
    const { result } = renderChat({ api: makeChatApi({}), socket })
    await settle()

    act(() => result.current.send("hi", ["u-x"]))
    expect(result.current.items[0]).toMatchObject({ pending: false, failed: true })

    socket.outcome = "sent"
    socket.setStatus("closed")
    socket.setStatus("open")
    await settle()

    const sends = socket.framesOf("send")
    expect(sends).toHaveLength(2)
    expect(sends[1]).toEqual(sends[0])
    expect(sends[1]?.mentionedUserIds).toEqual(["u-x"])
  })

  it("shows a replayed dropped message as pending until its ack lands", async () => {
    const socket = new FakeChatSocket()
    socket.outcome = "dropped"
    const { result } = renderChat({ api: makeChatApi({}), socket })
    await settle()
    act(() => result.current.send("hi"))

    socket.outcome = "sent"
    socket.setStatus("closed")
    socket.setStatus("open")
    await settle()

    expect(socket.framesOf("send")).toHaveLength(2)
    expect(result.current.items[0]).toMatchObject({ pending: true, failed: false })

    const clientId = socket.framesOf("send")[1]!.clientId
    socket.emit({ type: "ack", clientId, message: msg("srv-1", 3600, { from: person(ME, "Mia Me"), body: "hi" }) })
    await advance(50)
    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0]).toMatchObject({ pending: false, failed: false, mine: true })
    expect(result.current.items[0]?.message.id).toBe("srv-1")
  })

  it("re-sends a still-sending message on reopen", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api: makeChatApi({}), socket })
    await settle()

    act(() => result.current.send("hi"))
    socket.setStatus("closed")
    socket.setStatus("open")
    await settle()

    const sends = socket.framesOf("send")
    expect(sends).toHaveLength(2)
    expect(sends[1]?.clientId).toBe(sends[0]?.clientId)
  })

  it("leaves a core-queued message to the socket on reopen but shortens its timeout to SEND_TIMEOUT_MS", async () => {
    const socket = new FakeChatSocket()
    socket.outcome = "queued"
    const { result } = renderChat({ api: makeChatApi({}), socket })
    await settle()

    act(() => result.current.send("hi"))
    socket.outcome = "sent"
    socket.setStatus("closed")
    socket.setStatus("open")
    await settle()

    expect(socket.framesOf("send")).toHaveLength(1)
    await advance(SEND_TIMEOUT_MS - 1)
    expect(result.current.items[0]).toMatchObject({ pending: true, failed: false })
    await advance(1)
    expect(result.current.items[0]).toMatchObject({ pending: false, failed: true })
  })

  it("retry re-sends a failed message with its body, mentions and clientId", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api: makeChatApi({}), socket })
    await settle()

    act(() => result.current.send("hi", ["u-x"]))
    await advance(SEND_TIMEOUT_MS)
    const clientId = socket.framesOf("send")[0]!.clientId
    expect(result.current.items[0]?.failed).toBe(true)

    act(() => result.current.retry(clientId))

    const sends = socket.framesOf("send")
    expect(sends).toHaveLength(2)
    expect(sends[1]).toEqual({
      type: "send",
      cleanupId: ROOM_A,
      clientId,
      body: "hi",
      mentionedUserIds: ["u-x"],
    })
    expect(result.current.items[0]).toMatchObject({ pending: true, failed: false })
  })

  it("fails in-flight sends, but not core-queued ones, on a send-rejection error frame", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api: makeChatApi({}), socket })
    await settle()

    act(() => result.current.send("a"))
    await advance(1000)
    socket.outcome = "queued"
    act(() => result.current.send("b"))
    socket.emit({ type: "error", code: ErrorCode.RATE_LIMITED, message: "slow down", cleanupId: ROOM_A })

    expect(result.current.items.map((it) => [it.message.body, it.failed])).toEqual([
      ["a", true],
      ["b", false],
    ])
    expect(result.current.transientError).toEqual({ code: ErrorCode.RATE_LIMITED, message: "slow down" })
    expect(result.current.roomError).toBeNull()
  })

  it("only surfaces a transient error for other non-fatal codes, and the next send clears it", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api: makeChatApi({}), socket })
    await settle()

    act(() => result.current.send("a"))
    socket.emit({ type: "error", code: "SOMETHING_ELSE", message: "hmm", cleanupId: ROOM_A })
    expect(result.current.items[0]).toMatchObject({ pending: true, failed: false })
    expect(result.current.transientError).toEqual({ code: "SOMETHING_ELSE", message: "hmm" })

    act(() => result.current.send("b"))
    expect(result.current.transientError).toBeNull()
  })

  it("rejects the room on a fatal error frame for this room and kind only", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api: makeChatApi({}), socket })
    await settle()

    socket.emit({ type: "error", code: ErrorCode.FORBIDDEN, message: "no", cleanupId: ROOM_A, roomKind: "dm" })
    expect(result.current.roomError).toBeNull()

    socket.emit({ type: "error", code: ErrorCode.FORBIDDEN, message: "no", cleanupId: ROOM_A })
    expect(result.current.roomError).toEqual({ code: ErrorCode.FORBIDDEN, message: "no" })
    expect(socket.log).toContain("rejected cleanup:room-a")
  })
})

describe("useChat typing and presence", () => {
  it("shows another user typing for 5 s", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api: makeChatApi({}), socket })
    await settle()

    socket.emit({ type: "typing", cleanupId: ROOM_A, userId: OTHER })
    expect(result.current.typingUserIds).toEqual([OTHER])
    await advance(4999)
    expect(result.current.typingUserIds).toEqual([OTHER])
    await advance(1)
    expect(result.current.typingUserIds).toEqual([])
  })

  it("ignores the viewer's own typing and typing in another room", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api: makeChatApi({}), socket })
    await settle()

    socket.emit({ type: "typing", cleanupId: ROOM_A, userId: ME })
    socket.emit({ type: "typing", cleanupId: ROOM_B, userId: OTHER })

    expect(result.current.typingUserIds).toEqual([])
  })

  it("clears a typing indicator as soon as that user's message arrives", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api: makeChatApi({}), socket })
    await settle()

    socket.emit({ type: "typing", cleanupId: ROOM_A, userId: OTHER })
    socket.emit({ type: "message", message: msg("m1", 10) })

    expect(result.current.typingUserIds).toEqual([])
  })

  it("sends at most one typing frame per 2 s, stamped outside cleanup rooms", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api: makeChatApi({}), socket, props: { roomKind: "dm" } })
    await settle()

    act(() => result.current.sendTyping())
    act(() => result.current.sendTyping())
    expect(socket.framesOf("typing")).toEqual([{ type: "typing", cleanupId: ROOM_A, roomKind: "dm" }])

    await advance(1999)
    act(() => result.current.sendTyping())
    expect(socket.framesOf("typing")).toHaveLength(1)

    await advance(1)
    act(() => result.current.sendTyping())
    expect(socket.framesOf("typing")).toHaveLength(2)
  })

  it("counts online users from snapshots and join/leave frames, excluding the viewer", async () => {
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api: makeChatApi({}), socket })
    await settle()

    socket.emit({ type: "presence_snapshot", cleanupId: ROOM_A, userIds: [ME, OTHER, "u-3"] })
    expect(result.current.onlineCount).toBe(2)
    socket.emit({ type: "presence", cleanupId: ROOM_A, userId: "u-4", state: "join" })
    expect(result.current.onlineCount).toBe(3)
    socket.emit({ type: "presence", cleanupId: ROOM_A, userId: OTHER, state: "leave" })
    expect(result.current.onlineCount).toBe(2)
    socket.emit({ type: "presence_snapshot", cleanupId: ROOM_B, userIds: [] })
    expect(result.current.onlineCount).toBe(2)
  })
})

describe("useChat read acks", () => {
  it("acks the newest confirmed message once, 1.2 s after it settles, and refreshes the inbox", async () => {
    const socket = new FakeChatSocket()
    const { result, queryClient } = renderChat({
      api: makeChatApi({ [ROOM_A]: page([msg("m1", 10), msg("m2", 20)]) }),
      socket,
    })
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    await settle()

    await advance(1199)
    expect(socket.framesOf("ack")).toEqual([])

    await advance(1)
    expect(socket.framesOf("ack")).toEqual([{ type: "ack", upToId: "m2", cleanupId: ROOM_A }])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.threads })

    act(() => result.current.send("pending"))
    await advance(5000)
    expect(socket.framesOf("ack")).toHaveLength(1)
  })

  it("acks a newly arrived message after its own debounce", async () => {
    const socket = new FakeChatSocket()
    renderChat({ api: makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) }), socket })
    await settle()
    await advance(1200)

    socket.emit({ type: "message", message: msg("m2", 20) })
    await advance(50 + 1200)

    expect(socket.framesOf("ack").map((f) => f.upToId)).toEqual(["m1", "m2"])
  })

  it("stamps roomKind on acks outside cleanup rooms", async () => {
    const socket = new FakeChatSocket()
    renderChat({ api: makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) }), socket, props: { roomKind: "dm" } })
    await settle()
    await advance(1200)

    expect(socket.framesOf("ack")).toEqual([{ type: "ack", upToId: "m1", cleanupId: ROOM_A, roomKind: "dm" }])
  })

  it("never acks while suppressReadAcks is set", async () => {
    const socket = new FakeChatSocket()
    const { unmount } = renderChat({
      api: makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) }),
      socket,
      props: { options: { suppressReadAcks: true } },
    })
    await settle()
    await advance(5000)
    unmount()

    expect(socket.framesOf("ack")).toEqual([])
  })

  it("waits for the socket to open before acking", async () => {
    const socket = new FakeChatSocket("connecting")
    renderChat({ api: makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) }), socket })
    await settle()
    await advance(5000)
    expect(socket.framesOf("ack")).toEqual([])

    socket.setStatus("open")
    await advance(1200)
    expect(socket.framesOf("ack").map((f) => f.upToId)).toEqual(["m1"])
  })

  it("flushes a pending watermark on unmount before leaving the room", async () => {
    const socket = new FakeChatSocket()
    const { unmount } = renderChat({ api: makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) }), socket })
    await settle()
    await advance(500)

    unmount()

    expect(socket.framesOf("ack")).toEqual([{ type: "ack", upToId: "m1", cleanupId: ROOM_A }])
    expect(socket.log.slice(-3)).toEqual(["send ack", "leave cleanup:room-a", "release"])
  })
})

describe("useChat reconnect gap-fill", () => {
  it("fetches the newest page on reopen and folds missed messages into history", async () => {
    const rooms = { [ROOM_A]: page([msg("m1", 10)]) }
    const api = makeChatApi(rooms)
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api, socket })
    await settle()
    expect(api.cleanupMessages).toHaveBeenCalledTimes(1)

    socket.setStatus("closed")
    rooms[ROOM_A] = page([msg("m1", 10), msg("m2", 20)])
    socket.setStatus("open")
    await settle()

    expect(api.cleanupMessages).toHaveBeenCalledTimes(2)
    expect(api.cleanupMessages).toHaveBeenLastCalledWith({ cleanupId: ROOM_A, limit: 30 })
    expect(ids(result.current)).toEqual(["m1", "m2"])
  })

  it("replaces the cached pages when the newest page shares nothing with them and has older history", async () => {
    const rooms = { [ROOM_A]: page([msg("m1", 10)], "cursor-1") }
    const socket = new FakeChatSocket()
    const { result, queryClient } = renderChat({ api: makeChatApi(rooms), socket })
    await settle()

    socket.setStatus("closed")
    rooms[ROOM_A] = page([msg("m8", 80), msg("m9", 90)], "cursor-9")
    socket.setStatus("open")
    await settle()

    expect(cachedIds(queryClient)).toEqual([["m8", "m9"]])
    expect(
      queryClient.getQueryData<InfiniteData<ChatHistoryResponse>>(queryKeys.chatHistory(ROOM_A, "cleanup"))
        ?.pageParams,
    ).toEqual([undefined])
    expect(ids(result.current)).toEqual(["m8", "m9"])
  })

  it("refetches history instead when the last load failed", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) })
    api.cleanupMessages.mockRejectedValueOnce(new AppError(ErrorCode.INTERNAL, "boom"))
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api, socket })
    await settle()
    expect(result.current.isError).toBe(true)

    socket.setStatus("closed")
    socket.setStatus("open")
    await settle()

    expect(result.current.isError).toBe(false)
    expect(ids(result.current)).toEqual(["m1"])
  })

  it("currently keeps the stale history and schedules no follow-up when the gap-fill request fails", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) })
    const socket = new FakeChatSocket()
    const { result } = renderChat({ api, socket })
    await settle()

    api.cleanupMessages.mockRejectedValueOnce(new TypeError("network"))
    socket.setStatus("closed")
    socket.setStatus("open")
    await settle()
    await advance(60_000)

    expect(api.cleanupMessages).toHaveBeenCalledTimes(2)
    expect(ids(result.current)).toEqual(["m1"])
    expect(result.current.isError).toBe(false)
  })
})

describe("useChat around window", () => {
  it("loads a detached window around a message and clears it", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m9", 90)]) })
    const { result } = renderChat({ api, socket: new FakeChatSocket() })
    await settle()

    api.cleanupMessages.mockResolvedValueOnce(page([msg("m1", 10), msg("m2", 20), msg("x", 30, { cleanupId: ROOM_B })]))
    let found: boolean | undefined
    let pending!: Promise<boolean>
    act(() => {
      pending = result.current.fetchAround("m1")
    })
    expect(result.current.aroundLoading).toBe(true)
    await act(async () => {
      found = await pending
    })

    expect(api.cleanupMessages).toHaveBeenLastCalledWith({ cleanupId: ROOM_A, around: "m1", limit: 30 })
    expect(found).toBe(true)
    expect(result.current.aroundLoading).toBe(false)
    expect(result.current.aroundWindow?.map((it) => it.message.id)).toEqual(["m1", "m2"])
    expect(ids(result.current)).toEqual(["m9"])

    act(() => result.current.clearAround())
    expect(result.current.aroundWindow).toBeNull()
  })

  it("resolves false and keeps no window when the around request fails", async () => {
    const api = makeChatApi({})
    const { result } = renderChat({ api, socket: new FakeChatSocket() })
    await settle()

    api.cleanupMessages.mockRejectedValueOnce(new AppError(ErrorCode.NOT_FOUND, "gone"))
    let found: boolean | undefined
    await act(async () => {
      found = await result.current.fetchAround("m1")
    })

    expect(found).toBe(false)
    expect(result.current.aroundLoading).toBe(false)
    expect(result.current.aroundWindow).toBeNull()
  })

  it("ignores an older around response that resolves after a newer one", async () => {
    const api = makeChatApi({})
    const { result } = renderChat({ api, socket: new FakeChatSocket() })
    await settle()

    const older = deferred<ChatHistoryResponse>()
    api.cleanupMessages.mockReturnValueOnce(older.promise)
    api.cleanupMessages.mockResolvedValueOnce(page([msg("m2", 20)]))
    let olderResult!: Promise<boolean>
    act(() => {
      olderResult = result.current.fetchAround("m1")
    })
    await act(async () => {
      await result.current.fetchAround("m2")
    })
    await act(async () => {
      older.resolve(page([msg("m1", 10)]))
      await olderResult
    })

    expect(await olderResult).toBe(true)
    expect(result.current.aroundWindow?.map((it) => it.message.id)).toEqual(["m2"])
  })
})

describe("useChat room switch", () => {
  it("keeps the socket retained when the room changes in place, leaving room A and joining room B", async () => {
    const socket = new FakeChatSocket()
    const { rerender } = renderChat({ api: makeChatApi({}), socket })
    await settle()

    rerender({ roomId: ROOM_B })
    await settle()

    expect(socket.log).toEqual([
      "join cleanup:room-a",
      "retain",
      "leave cleanup:room-a",
      "join cleanup:room-b",
    ])
  })

  it("loads the new room and resets outbox, typing, presence, errors and the around window", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("a1", 10)]), [ROOM_B]: page([msg("b1", 10, { cleanupId: ROOM_B })]) })
    const socket = new FakeChatSocket()
    const { result, rerender } = renderChat({ api, socket })
    await settle()

    act(() => result.current.send("hi"))
    socket.emit({ type: "typing", cleanupId: ROOM_A, userId: OTHER })
    socket.emit({ type: "presence_snapshot", cleanupId: ROOM_A, userIds: [OTHER] })
    socket.emit({ type: "error", code: "SOMETHING_ELSE", message: "hmm", cleanupId: ROOM_A })
    await act(async () => {
      await result.current.fetchAround("a1")
    })

    rerender({ roomId: ROOM_B })
    await settle()

    expect(api.cleanupMessages).toHaveBeenCalledWith({ cleanupId: ROOM_B, limit: 30 })
    expect(ids(result.current)).toEqual(["b1"])
    expect(result.current.typingUserIds).toEqual([])
    expect(result.current.onlineCount).toBe(0)
    expect(result.current.transientError).toBeNull()
    expect(result.current.aroundWindow).toBeNull()
    expect(result.current.aroundLoading).toBe(false)
  })

  it("renders none of room A's pending bubbles in the first render of room B", async () => {
    const socket = new FakeChatSocket()
    const { result, rerender, frames } = renderChat({ api: makeChatApi({}), socket })
    await settle()
    act(() => result.current.send("hi"))

    rerender({ roomId: ROOM_B })
    await settle()

    const firstOfB = frames.find((f) => f.roomId === ROOM_B)
    expect(firstOfB?.result.items).toEqual([])
    expect(result.current.items).toEqual([])
  })

  it("currently discards room A's failed message when switching away and back", async () => {
    const socket = new FakeChatSocket()
    const { result, rerender } = renderChat({ api: makeChatApi({}), socket })
    await settle()
    act(() => result.current.send("hi"))
    await advance(SEND_TIMEOUT_MS)
    expect(result.current.items[0]?.failed).toBe(true)

    rerender({ roomId: ROOM_B })
    await settle()
    rerender({ roomId: ROOM_A })
    await settle()

    expect(result.current.items).toEqual([])
  })

  it("flushes a pending read watermark to its own room before leaving it", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("a1", 10)]), [ROOM_B]: page([msg("b1", 10, { cleanupId: ROOM_B })]) })
    const socket = new FakeChatSocket()
    const { rerender } = renderChat({ api, socket })
    await settle()
    await advance(500)

    rerender({ roomId: ROOM_B })
    await settle()

    expect(socket.framesOf("ack")).toEqual([{ type: "ack", upToId: "a1", cleanupId: ROOM_A }])
    const flushAt = socket.log.indexOf("send ack")
    expect(flushAt).toBeGreaterThan(-1)
    expect(flushAt).toBeLessThan(socket.log.indexOf("leave cleanup:room-a"))

    await advance(1200)
    expect(socket.framesOf("ack")).toEqual([
      { type: "ack", upToId: "a1", cleanupId: ROOM_A },
      { type: "ack", upToId: "b1", cleanupId: ROOM_B },
    ])
  })

  it("ignores an around response that belongs to the previous room", async () => {
    const api = makeChatApi({})
    const { result, rerender } = renderChat({ api, socket: new FakeChatSocket() })
    await settle()

    const stale = deferred<ChatHistoryResponse>()
    api.cleanupMessages.mockReturnValueOnce(stale.promise)
    let staleResult!: Promise<boolean>
    act(() => {
      staleResult = result.current.fetchAround("a1")
    })
    rerender({ roomId: ROOM_B })
    await settle()
    await act(async () => {
      stale.resolve(page([msg("a1", 10)]))
      await staleResult
    })

    expect(result.current.aroundWindow).toBeNull()
    expect(result.current.aroundLoading).toBe(false)
  })
})

describe("useChat message actions", () => {
  it("toggles a reaction optimistically, then adopts the server's buckets", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) })
    const server = deferred<ChatMessageDTO>()
    api.toggleCleanupMessageReaction.mockReturnValueOnce(server.promise)
    const { result } = renderChat({ api, socket: new FakeChatSocket() })
    await settle()

    act(() => result.current.toggleReaction("m1", "like"))
    expect(api.toggleCleanupMessageReaction).toHaveBeenCalledWith({ cleanupId: ROOM_A, messageId: "m1", emoji: "like" })
    expect(result.current.items[0]?.message.reactions).toEqual([{ emoji: "like", count: 1, mine: true }])

    await act(async () => server.resolve(msg("m1", 10, { reactions: [{ emoji: "like", count: 4, mine: true }] })))
    await settle()
    expect(result.current.items[0]?.message.reactions).toEqual([{ emoji: "like", count: 4, mine: true }])
  })

  it("rolls a reaction back when the server rejects it", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) })
    api.toggleCleanupMessageReaction.mockRejectedValueOnce(new AppError(ErrorCode.INTERNAL, "boom"))
    const { result } = renderChat({ api, socket: new FakeChatSocket() })
    await settle()

    act(() => result.current.toggleReaction("m1", "like"))
    await settle()

    expect(result.current.items[0]?.message.reactions).toEqual([])
  })

  it("routes a group reaction through the generic room endpoint", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) })
    api.toggleMessageReaction.mockResolvedValueOnce(msg("m1", 10))
    const { result } = renderChat({ api, socket: new FakeChatSocket(), props: { roomKind: "group" } })
    await settle()

    act(() => result.current.toggleReaction("m1", "heart"))

    expect(api.toggleMessageReaction).toHaveBeenCalledWith({
      roomKind: "group",
      roomId: ROOM_A,
      messageId: "m1",
      emoji: "heart",
    })
  })

  it("edits optimistically and restores the old body when the server rejects the edit", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) })
    const server = deferred<ChatMessageDTO>()
    api.editChatMessage.mockReturnValueOnce(server.promise)
    const { result } = renderChat({ api, socket: new FakeChatSocket() })
    await settle()

    let editing!: Promise<void>
    act(() => {
      editing = result.current.edit("m1", "  new text  ", ["u-x"])
    })
    expect(api.editChatMessage).toHaveBeenCalledWith({
      roomKind: "cleanup",
      roomId: ROOM_A,
      messageId: "m1",
      body: "new text",
      mentionedUserIds: ["u-x"],
    })
    expect(result.current.items[0]?.message).toMatchObject({ body: "new text", editedAt: new Date(NOW).toISOString() })

    const failure = new AppError(ErrorCode.FORBIDDEN, "too late")
    await act(async () => {
      server.reject(failure)
      await expect(editing).rejects.toBe(failure)
    })
    expect(result.current.items[0]?.message.body).toBe("body m1")
    expect(result.current.items[0]?.message.editedAt).toBeUndefined()
  })

  it("rejects an empty edit and an edit of an unknown message without calling the server", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) })
    const { result } = renderChat({ api, socket: new FakeChatSocket() })
    await settle()

    await expect(result.current.edit("m1", "   ")).rejects.toMatchObject({ code: ErrorCode.VALIDATION })
    await expect(result.current.edit("nope", "x")).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND })
    expect(api.editChatMessage).not.toHaveBeenCalled()
  })

  it("routes a DM edit through the DM endpoint", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) })
    api.editDmMessage.mockResolvedValueOnce(msg("m1", 10, { body: "x" }))
    const { result } = renderChat({ api, socket: new FakeChatSocket(), props: { roomKind: "dm" } })
    await settle()

    await act(async () => {
      await result.current.edit("m1", "x")
    })

    expect(api.editDmMessage).toHaveBeenCalledWith({ threadId: ROOM_A, messageId: "m1", body: "x" })
    expect(api.editChatMessage).not.toHaveBeenCalled()
  })

  it("tombstones a deleted message optimistically and restores it when the server rejects", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) })
    const server = deferred<ChatMessageDTO>()
    api.deleteCleanupMessage.mockReturnValueOnce(server.promise)
    const { result } = renderChat({ api, socket: new FakeChatSocket() })
    await settle()

    let deleting!: Promise<void>
    act(() => {
      deleting = result.current.delete("m1")
    })
    expect(api.deleteCleanupMessage).toHaveBeenCalledWith({ cleanupId: ROOM_A, messageId: "m1" })
    expect(result.current.items[0]?.message).toMatchObject({ body: "", deletedAt: new Date(NOW).toISOString() })

    await act(async () => {
      server.reject(new AppError(ErrorCode.INTERNAL, "boom"))
      await expect(deleting).rejects.toMatchObject({ code: ErrorCode.INTERNAL })
    })
    expect(result.current.items[0]?.message.body).toBe("body m1")
    expect(result.current.items[0]?.message.deletedAt).toBeUndefined()
  })

  it("pins a message optimistically and keeps the server's copy", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) })
    const pinnedAt = at(500)
    api.setMessagePinned.mockResolvedValueOnce(msg("m1", 10, { pinnedAt }))
    const { result } = renderChat({ api, socket: new FakeChatSocket() })
    await settle()

    await act(async () => {
      await result.current.setPinned("m1", true)
    })

    expect(api.setMessagePinned).toHaveBeenCalledWith({ roomKind: "cleanup", roomId: ROOM_A, messageId: "m1", pinned: true })
    expect(result.current.items[0]?.message.pinnedAt).toBe(pinnedAt)
    expect(result.current.pins.map((m) => m.id)).toEqual(["m1"])
  })

  it("refuses a poll in a DM without calling the server", async () => {
    const api = makeChatApi({})
    const { result } = renderChat({ api, socket: new FakeChatSocket(), props: { roomKind: "dm" } })
    await settle()

    await expect(
      result.current.createPoll({ question: "q", options: ["a", "b"], allowMultiple: false, anonymous: false }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION })
    expect(api.createPoll).not.toHaveBeenCalled()
  })

  it("folds a created poll into the room after the inbound buffer flushes", async () => {
    const api = makeChatApi({ [ROOM_A]: page([msg("m1", 10)]) })
    api.createPoll.mockResolvedValueOnce(msg("p1", 20, { kind: "poll" }))
    const { result } = renderChat({ api, socket: new FakeChatSocket() })
    await settle()

    await act(async () => {
      await result.current.createPoll({ question: "q", options: ["a", "b"], allowMultiple: false, anonymous: true })
    })
    expect(api.createPoll).toHaveBeenCalledWith({
      roomKind: "cleanup",
      roomId: ROOM_A,
      question: "q",
      options: ["a", "b"],
      allowMultiple: false,
      anonymous: true,
    })
    expect(ids(result.current)).toEqual(["m1"])

    await advance(50)
    expect(ids(result.current)).toEqual(["m1", "p1"])
  })
})
