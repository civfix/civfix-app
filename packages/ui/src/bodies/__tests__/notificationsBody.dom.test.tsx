import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import * as ReactNative from "react-native"
import {
  AppError,
  type NotificationActorDTO,
  type NotificationDTO,
  type NotificationType,
  type PersonDTO,
  type UserDTO,
} from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import { CapabilitiesProvider, makeFakeCapabilities } from "../../capabilities"
import { ApiProvider } from "../../data/context"
import { makeFakeDataContext } from "../../data/fakes"
import { useHasUnreadNotifications } from "../../data/hooks/notifications"
import { I18nProvider } from "../../i18n"
import { useNavStore } from "../../nav"
import { themes } from "../../theme"
import { ToastContext } from "../../primitives/toastContext"
import type * as ToastContextModule from "../../primitives/toastContext"
import type * as FollowButtonModule from "../../primitives/FollowButton"
import { NotificationsBody } from "../NotificationsBody"

// The icon set pulls in native-only modules; a glyph is read by the name the row asked for.
vi.mock("../../typography", async () => {
  const { Text, View } = await vi.importActual<typeof ReactNative>("react-native")
  const iconMap = new Proxy({}, { get: (_target, name) => name })
  return { Text, Icon: ({ icon }: { icon: string }) => <View testID={`icon-${icon}`} />, iconMap }
})
vi.mock("../../primitives", async () => {
  const { Text, View } = await vi.importActual<typeof ReactNative>("react-native")
  const { useToast } = await vi.importActual<typeof ToastContextModule>(
    "../../primitives/toastContext",
  )
  const Copy = ({ title, body }: { title: string; body: string }) => (
    <View>
      <Text>{title}</Text>
      <Text>{body}</Text>
    </View>
  )
  const { FollowButton } = await vi.importActual<typeof FollowButtonModule>(
    "../../primitives/FollowButton",
  )
  // The photo itself is the Avatar primitive's business; a row shows whose photo it asked for.
  const Avatar = ({ seed, photoUrl }: { seed: string; photoUrl: string | null }) => (
    <View testID={`avatar-${seed}-${photoUrl ?? "none"}`} />
  )
  return {
    Avatar,
    FollowButton,
    EmptyState: Copy,
    SignInPrompt: Copy,
    LoadingState: ({ skeleton }: { skeleton: string }) => <View testID={`skeleton-${skeleton}`} />,
    useToast,
  }
})

const ME = { id: "u-me", displayName: "Mia Me" } as unknown as UserDTO
const UNREAD_FILL = rgb(themes.light.colors.bloom["50"])
const RATE_LIMITED_COPY = "Too many requests. Wait a moment and try again."

// jsdom reports computed colours as rgb(); the theme holds hex.
function rgb(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

function note(
  id: string,
  read: boolean,
  over: Partial<NotificationDTO> & { type?: NotificationType } = {},
): NotificationDTO {
  return {
    id,
    type: "report_update",
    title: id.toUpperCase(),
    body: null,
    read,
    createdAt: "2026-10-24T10:00:00.000Z",
    link: null,
    ...over,
  }
}

function held<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// Server state the fake API answers from; a test moves it between visits or refetches.
interface Server {
  items: NotificationDTO[]
  hasUnread: boolean
}

function makeApi(server: Server, over: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  return {
    listNotifications: vi.fn(async () => ({ items: server.items.map((n) => ({ ...n })) })),
    getNotificationUnread: vi.fn(async () => ({ hasUnread: server.hasUnread })),
    markAllNotificationsRead: vi.fn(async () => {
      server.items = server.items.map((n) => ({ ...n, read: true }))
      server.hasUnread = false
      return { ok: true as const }
    }),
    markNotificationsRead: vi.fn(async ({ ids }: { ids: string[] }) => {
      server.items = server.items.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
      server.hasUnread = server.items.some((n) => !n.read)
      return { ok: true as const }
    }),
    dismissNotification: vi.fn(async () => ({ ok: true as const })),
    followSuggestions: vi.fn(async () => ({ results: [] as PersonDTO[] })),
    followPerson: vi.fn(async () => ({ isFollowing: true, followers: 1 })),
    unfollowPerson: vi.fn(async () => ({ isFollowing: false, followers: 0 })),
    openDm: vi.fn(async ({ userId }: { userId: string }) => ({
      thread: { id: `dm-${userId}`, refId: null, peer: null },
    })),
    ...over,
  }
}

type Api = ReturnType<typeof makeApi>

function UnreadProbe() {
  return (
    <ReactNative.Text testID="probe">
      {useHasUnreadNotifications() ? "dot:on" : "dot:off"}
    </ReactNative.Text>
  )
}

function renderBody(
  api: Api,
  { signedIn = true, queryClient }: { signedIn?: boolean; queryClient?: QueryClient } = {},
) {
  const client = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const context = makeFakeDataContext({
    api: api as unknown as ApiClient,
    auth: signedIn ? { isAuthenticated: true, user: ME, isPending: false } : {},
  })
  const capabilities = makeFakeCapabilities()
  const toast = { show: vi.fn() }
  const tree = (show: boolean) => (
    <QueryClientProvider client={client}>
      <ApiProvider value={context}>
        <CapabilitiesProvider value={capabilities}>
          <I18nProvider locale="en">
            <ToastContext.Provider value={toast}>
              <UnreadProbe />
              {show ? <NotificationsBody /> : null}
            </ToastContext.Provider>
          </I18nProvider>
        </CapabilitiesProvider>
      </ApiProvider>
    </QueryClientProvider>
  )
  const view = render(tree(true))
  return {
    queryClient: client,
    toast,
    unmountPage: () => view.rerender(tree(false)),
    mountPage: () => view.rerender(tree(true)),
  }
}

const row = (title: string) =>
  screen.getByRole("button", { name: (name) => name === title || name.startsWith(`${title},`) })
// The row's fill sits on the container that holds its tap target and, for a new follower, its action.
const looksUnread = (title: string) => {
  const el = row(title)
  return {
    label: (el.getAttribute("aria-label") ?? "").startsWith(`${title}, unread`),
    fill: getComputedStyle(el.parentElement!).backgroundColor === UNREAD_FILL,
  }
}
const UNREAD = { label: true, fill: true }
const READ = { label: false, fill: false }
const probe = () => screen.getByTestId("probe").textContent
const listCache = (qc: QueryClient) => qc.getQueryData<NotificationDTO[]>(["notifications", 50])
const flush = () => act(() => new Promise((r) => setTimeout(r, 30)))

function resetNav(): void {
  useNavStore.setState({
    view: "home",
    stack: [],
    active: null,
    snap: 2,
    query: "",
    mode: "compact",
    originView: null,
  })
}

afterEach(() => {
  resetNav()
  vi.restoreAllMocks()
})

describe("GH#226 NotificationsBody: viewing marks read", () => {
  it("T11: marks everything read once the list shows, clears the dot at once, and keeps the rows' unread look", async () => {
    const server: Server = {
      items: [note("n1", false), note("n2", false), note("n3", true)],
      hasUnread: true,
    }
    const call = held<{ ok: true }>()
    const api = makeApi(server, { markAllNotificationsRead: vi.fn(() => call.promise) })
    renderBody(api)

    await screen.findByRole("button", { name: /^N1, unread/ })
    await waitFor(() => expect(api.markAllNotificationsRead).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(probe()).toBe("dot:off"))
    expect(api.markNotificationsRead).not.toHaveBeenCalled()

    server.items = server.items.map((n) => ({ ...n, read: true }))
    server.hasUnread = false
    await act(async () => call.resolve({ ok: true }))
    await flush()

    expect(api.markAllNotificationsRead).toHaveBeenCalledTimes(1)
    expect(api.markNotificationsRead).not.toHaveBeenCalled()
    expect(looksUnread("N1")).toEqual(UNREAD)
    expect(looksUnread("N2")).toEqual(UNREAD)
    expect(looksUnread("N3")).toEqual(READ)
    expect(probe()).toBe("dot:off")
  })

  it("T12: never marks anything when nothing is unread", async () => {
    const api = makeApi({ items: [note("n1", true), note("n2", true)], hasUnread: false })
    renderBody(api)
    await screen.findByRole("button", { name: /^N1/ })
    await flush()
    expect(api.markAllNotificationsRead).not.toHaveBeenCalled()
  })

  it("T13: never marks anything while the list loads, after it fails, or signed out", async () => {
    const loading = makeApi(
      { items: [], hasUnread: true },
      { listNotifications: vi.fn(() => new Promise(() => {})) },
    )
    const first = renderBody(loading)
    await waitFor(() => expect(loading.getNotificationUnread).toHaveBeenCalled())
    await flush()
    expect(screen.getByTestId("skeleton-notification")).toBeTruthy()
    expect(loading.markAllNotificationsRead).not.toHaveBeenCalled()
    first.unmountPage()

    const failing = makeApi(
      { items: [], hasUnread: true },
      { listNotifications: vi.fn(async () => Promise.reject(new Error("offline"))) },
    )
    renderBody(failing)
    await screen.findAllByText("Could not load notifications")
    await flush()
    expect(failing.markAllNotificationsRead).not.toHaveBeenCalled()

    const signedOut = makeApi({ items: [note("n1", false)], hasUnread: true })
    renderBody(signedOut, { signedIn: false })
    await screen.findByText("Sign in for notifications")
    await flush()
    expect(signedOut.markAllNotificationsRead).not.toHaveBeenCalled()
  })

  it("T14: on a refused call, brings the dot and the rows back, says why, and does not try again that visit", async () => {
    const server: Server = {
      items: [note("n1", false), note("n2", false), note("n3", true)],
      hasUnread: true,
    }
    const api = makeApi(server, {
      markAllNotificationsRead: vi.fn(async () => Promise.reject(AppError.rateLimited())),
    })
    const { queryClient, toast } = renderBody(api)

    await waitFor(() => expect(api.markAllNotificationsRead).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(RATE_LIMITED_COPY, { variant: "error" }),
    )
    await waitFor(() => expect(probe()).toBe("dot:on"))
    const cached = listCache(queryClient)!
    expect(cached.find((n) => n.id === "n1")?.read).toBe(false)
    expect(cached.find((n) => n.id === "n2")?.read).toBe(false)

    // The settled call refetches the unread answer (still true); the page stays mounted and holds off.
    await waitFor(() =>
      expect(api.getNotificationUnread.mock.calls.length).toBeGreaterThanOrEqual(2),
    )
    await act(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }))
    await flush()
    expect(probe()).toBe("dot:on")
    expect(api.markAllNotificationsRead).toHaveBeenCalledTimes(1)
  })

  it("T15: marks again when a new unread notification arrives while the page is open", async () => {
    const server: Server = {
      items: [note("n1", false), note("n2", false), note("n3", true)],
      hasUnread: true,
    }
    const api = makeApi(server)
    const { queryClient } = renderBody(api)
    await waitFor(() => expect(api.markAllNotificationsRead).toHaveBeenCalledTimes(1))
    await flush()

    server.items = [note("n4", false), ...server.items]
    server.hasUnread = true
    await act(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }))
    await waitFor(() => expect(api.markAllNotificationsRead).toHaveBeenCalledTimes(2))
    await flush()
    expect(looksUnread("N4")).toEqual(UNREAD)
    expect(probe()).toBe("dot:off")
  })

  it("T16: a later visit shows the rows as read and marks nothing", async () => {
    const server: Server = {
      items: [note("n1", false), note("n2", false), note("n3", true)],
      hasUnread: true,
    }
    const api = makeApi(server)
    const page = renderBody(api)
    await waitFor(() => expect(api.markAllNotificationsRead).toHaveBeenCalledTimes(1))
    await flush()
    expect(server.hasUnread).toBe(false)

    page.unmountPage()
    page.mountPage()
    await screen.findByRole("button", { name: /^N1/ })
    await flush()
    for (const title of ["N1", "N2", "N3"]) expect(looksUnread(title)).toEqual(READ)
    expect(api.markAllNotificationsRead).toHaveBeenCalledTimes(1)
  })
})

describe("GH#226 NotificationsBody rows", () => {
  it("T17: a press marks only an unread row read, then opens its link", async () => {
    const server: Server = {
      items: [
        note("n1", false, { link: "/reports/r1" }),
        note("n2", true, { link: "/reports/r2" }),
        note("n3", true, { link: "/" }),
      ],
      hasUnread: true,
    }
    const api = makeApi(server, {
      markAllNotificationsRead: vi.fn(async () => Promise.reject(AppError.rateLimited())),
    })
    const { queryClient } = renderBody(api)
    await waitFor(() => expect(api.markAllNotificationsRead).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(listCache(queryClient)?.find((n) => n.id === "n1")?.read).toBe(false),
    )

    fireEvent.click(row("N1"))
    expect(useNavStore.getState().active).toEqual({ kind: "pin", id: "r1" })
    await waitFor(() => expect(api.markNotificationsRead).toHaveBeenCalledTimes(1))
    expect(api.markNotificationsRead).toHaveBeenCalledWith({ ids: ["n1"] })
    await flush()

    resetNav()
    fireEvent.click(row("N2"))
    expect(useNavStore.getState().active).toEqual({ kind: "pin", id: "r2" })
    await flush()
    expect(api.markNotificationsRead).toHaveBeenCalledTimes(1)

    useNavStore.setState({ view: "messaging" })
    const selectView = vi.spyOn(useNavStore.getState(), "selectView")
    fireEvent.click(row("N3"))
    expect(selectView).toHaveBeenCalledWith("home")
    await flush()
    expect(api.markNotificationsRead).toHaveBeenCalledTimes(1)
  })

  it("T18: a chat_mention row shows the mention glyph, a report_update row still the pin", async () => {
    const api = makeApi({
      items: [
        note("n1", true, { type: "chat_mention" }),
        note("n2", true, { type: "report_update" }),
      ],
      hasUnread: false,
    })
    renderBody(api)
    await screen.findByRole("button", { name: /^N1/ })
    expect(row("N1").querySelector('[data-testid="icon-AtSign"]')).not.toBeNull()
    expect(row("N2").querySelector('[data-testid="icon-MapPin"]')).not.toBeNull()
    expect(row("N2").querySelector('[data-testid="icon-AtSign"]')).toBeNull()
  })

  it.each(["web", "android"] as const)(
    "T19: offers no Mark all read and no dismiss (%s)",
    async (os) => {
      const platform = ReactNative.Platform as { OS: string }
      const realOS = platform.OS
      platform.OS = os
      try {
        const api = makeApi({ items: [note("n1", false), note("n2", false)], hasUnread: true })
        renderBody(api)
        await screen.findByRole("button", { name: /^N1/ })
        await flush()
        expect(screen.queryByRole("button", { name: /mark all read/i })).toBeNull()
        expect(screen.queryByText(/mark all read/i)).toBeNull()
        expect(screen.queryByRole("button", { name: /dismiss notification/i })).toBeNull()
        expect(screen.queryByLabelText(/dismiss notification/i)).toBeNull()
        expect(api.dismissNotification).not.toHaveBeenCalled()
      } finally {
        platform.OS = realOS
      }
    },
  )

  it("T20: keeps its signed-out, loading, error and empty states", async () => {
    const signedOut = renderBody(makeApi({ items: [], hasUnread: false }), { signedIn: false })
    expect(await screen.findByText("Sign in for notifications")).toBeTruthy()
    signedOut.unmountPage()

    const loading = renderBody(
      makeApi(
        { items: [], hasUnread: false },
        { listNotifications: vi.fn(() => new Promise(() => {})) },
      ),
    )
    expect(await screen.findByTestId("skeleton-notification")).toBeTruthy()
    loading.unmountPage()

    const failing = renderBody(
      makeApi(
        { items: [], hasUnread: false },
        { listNotifications: vi.fn(async () => Promise.reject(new Error("x"))) },
      ),
    )
    expect(await screen.findByText("Could not load notifications")).toBeTruthy()
    failing.unmountPage()

    renderBody(makeApi({ items: [], hasUnread: false }))
    expect(await screen.findByText("You are all caught up")).toBeTruthy()
  })
})

function person(id: string, name: string): PersonDTO {
  return { id, name, handle: id, avatar: null, avatarUrl: null, isFollowing: false } as PersonDTO
}

function actor(id: string, over: Partial<NotificationActorDTO> = {}): NotificationActorDTO {
  return {
    id,
    name: `Name ${id}`,
    handle: id,
    avatar: null,
    avatarUrl: null,
    isFollowing: false,
    ...over,
  }
}

const SUGGESTIONS_TITLE = "Suggested for you"
const DOT_FILL = rgb(themes.light.colors.brand.bloom)
const hasDot = (title: string) =>
  [...row(title).querySelectorAll("div")].some(
    (el) => getComputedStyle(el).backgroundColor === DOT_FILL,
  )
const follows = (follower: string) =>
  note(follower, true, { type: "new_follower", link: `/people/${follower}` })

describe("GH#308 notification center: people", () => {
  it("opens with the suggestion strip above the notifications, and keeps it in the empty state", async () => {
    const people = [person("p1", "Pat One"), person("p2", "Sam Two")]
    const api = makeApi(
      { items: [note("n1", true)], hasUnread: false },
      { followSuggestions: vi.fn(async () => ({ results: people })) },
    )
    const page = renderBody(api)
    const title = await screen.findByRole("heading", { name: SUGGESTIONS_TITLE })
    expect(screen.getByRole("button", { name: /Pat One/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Sam Two/ })).toBeTruthy()
    expect(title.compareDocumentPosition(row("N1")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(api.followSuggestions).toHaveBeenCalledWith({ limit: 10 })
    page.unmountPage()

    renderBody(
      makeApi(
        { items: [], hasUnread: false },
        { followSuggestions: vi.fn(async () => ({ results: people })) },
      ),
    )
    expect(await screen.findByText("You are all caught up")).toBeTruthy()
    expect(await screen.findByRole("heading", { name: SUGGESTIONS_TITLE })).toBeTruthy()
  })

  it("leaves the strip out when there are no suggestions or they fail, and still shows the notifications", async () => {
    const none = renderBody(makeApi({ items: [note("n1", true)], hasUnread: false }))
    await screen.findByRole("button", { name: /^N1/ })
    await flush()
    expect(screen.queryByRole("heading", { name: SUGGESTIONS_TITLE })).toBeNull()
    none.unmountPage()

    const failing = makeApi(
      { items: [note("n2", true)], hasUnread: false },
      { followSuggestions: vi.fn(async () => Promise.reject(new Error("offline"))) },
    )
    renderBody(failing)
    await screen.findByRole("button", { name: /^N2/ })
    await waitFor(() => expect(failing.followSuggestions).toHaveBeenCalled())
    await flush()
    expect(screen.queryByRole("heading", { name: SUGGESTIONS_TITLE })).toBeNull()
    expect(row("N2")).toBeTruthy()
  })

  it("shows the person's photo with the type badge on a row about a person, and the type icon otherwise", async () => {
    const api = makeApi({
      items: [
        note("n1", true, {
          type: "chat_mention",
          actor: actor("a1", { avatarUrl: "https://img.test/a1.jpg" }),
        }),
        note("n2", true, { type: "new_follower", actor: actor("a2") }),
        note("n3", true, { type: "report_update", actor: null }),
        note("n4", true, { type: "cleanup_reminder" }),
      ],
      hasUnread: false,
    })
    renderBody(api)
    await screen.findByRole("button", { name: /^N1/ })
    expect(
      row("N1").querySelector('[data-testid="avatar-a1-https://img.test/a1.jpg"]'),
    ).not.toBeNull()
    expect(row("N1").querySelector('[data-testid="icon-AtSign"]')).not.toBeNull()
    expect(row("N2").querySelector('[data-testid="avatar-a2-none"]')).not.toBeNull()
    expect(row("N2").querySelector('[data-testid="icon-UserPlus"]')).not.toBeNull()
    expect(row("N3").querySelector('[data-testid^="avatar-"]')).toBeNull()
    expect(row("N3").querySelector('[data-testid="icon-MapPin"]')).not.toBeNull()
    expect(row("N4").querySelector('[data-testid^="avatar-"]')).toBeNull()
    expect(row("N4").querySelector('[data-testid="icon-Calendar"]')).not.toBeNull()
  })

  it("offers Follow back to a new follower, reads Following once followed, and unfollows on a second tap", async () => {
    const api = makeApi({
      items: [{ ...follows("n1"), actor: actor("a1") }],
      hasUnread: false,
    })
    renderBody(api)
    const followBack = await screen.findByRole("button", { name: "Follow back" })
    fireEvent.click(followBack)
    await waitFor(() => expect(api.followPerson).toHaveBeenCalledWith({ id: "a1" }))
    const following = await screen.findByRole("button", { name: "Following" })
    expect(useNavStore.getState().active).toBeNull()
    expect(screen.queryByRole("button", { name: /^Message/ })).toBeNull()

    fireEvent.click(following)
    await waitFor(() => expect(api.unfollowPerson).toHaveBeenCalledWith({ id: "a1" }))
    expect(await screen.findByRole("button", { name: "Follow back" })).toBeTruthy()
    expect(useNavStore.getState().active).toBeNull()
  })

  it("offers Message to a new follower the viewer follows, which opens the conversation, not the row's link", async () => {
    const api = makeApi({
      items: [{ ...follows("n1"), actor: actor("a1", { name: "Ada Actor", isFollowing: true }) }],
      hasUnread: false,
    })
    renderBody(api)
    const message = await screen.findByRole("button", { name: "Message Ada Actor" })
    expect(screen.queryByRole("button", { name: "Follow back" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Following" })).toBeNull()
    const push = vi.spyOn(useNavStore.getState(), "push")
    fireEvent.click(message)
    await waitFor(() => expect(api.openDm).toHaveBeenCalledWith({ userId: "a1" }))
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith({
        kind: "thread",
        id: "dm-a1",
        roomKind: "dm",
        peer: undefined,
      }),
    )
    expect(push).toHaveBeenCalledTimes(1)
  })

  it("the row's own tap still opens its link on a row with a follower action", async () => {
    const api = makeApi({
      items: [note("n1", true, { type: "new_follower", link: "/reports/r1", actor: actor("a1") })],
      hasUnread: false,
    })
    renderBody(api)
    await screen.findByRole("button", { name: "Follow back" })
    fireEvent.click(row("N1"))
    expect(useNavStore.getState().active).toEqual({ kind: "pin", id: "r1" })
    expect(api.followPerson).not.toHaveBeenCalled()
  })

  it("gives no follower action to a row about a person that is not a new follower, or a follower with no actor", async () => {
    const api = makeApi({
      items: [
        note("n1", true, { type: "chat_mention", actor: actor("a1") }),
        note("n2", true, { type: "new_follower", actor: null }),
      ],
      hasUnread: false,
    })
    renderBody(api)
    await screen.findByRole("button", { name: /^N1/ })
    await flush()
    expect(screen.queryByRole("button", { name: "Follow back" })).toBeNull()
    expect(screen.queryByRole("button", { name: /^Message/ })).toBeNull()
  })

  it("clears a new row's unread look 3 seconds after it is first shown, while marking read stays as it was", async () => {
    const server: Server = { items: [note("n1", false), note("n2", true)], hasUnread: true }
    const api = makeApi(server)
    renderBody(api)
    await screen.findByRole("button", { name: /^N1, unread/ })
    const shownAt = Date.now()
    await waitFor(() => expect(api.markAllNotificationsRead).toHaveBeenCalledTimes(1))
    await flush()
    expect(looksUnread("N1")).toEqual(UNREAD)
    expect(hasDot("N1")).toBe(true)
    await waitFor(() => expect(looksUnread("N1")).toEqual(READ), { timeout: 4000 })
    expect(Date.now() - shownAt).toBeGreaterThanOrEqual(2900)
    expect(hasDot("N1")).toBe(false)
    expect(looksUnread("N2")).toEqual(READ)
    expect(api.markAllNotificationsRead).toHaveBeenCalledTimes(1)
  }, 10_000)
})
