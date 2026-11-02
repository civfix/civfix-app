import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type * as ReactNative from "react-native"
import type { NotificationUnreadResponse, UserDTO } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import { ApiProvider } from "../../data/context"
import { makeFakeDataContext } from "../../data/fakes"
import { I18nProvider } from "../../i18n"
import { useNavStore } from "../../nav"
import { DetailHeader } from "../SheetHeader.shared"
import { ExpandedShell } from "../ExpandedShell"

// The icon set pulls in native-only modules; the bars are read by their roles and labels.
vi.mock("../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})
vi.mock("lucide-react-native/icons", () => ({ ArrowLeft: () => null }))
vi.mock("../../primitives/UnreadDot", async () => {
  const { View } = await vi.importActual<typeof ReactNative>("react-native")
  return { UnreadDot: () => <View testID="unread-dot" /> }
})
// The panel's body, rail and promo card are other screens; only its header is under test.
vi.mock("../BodyRouter", () => ({ defaultRenderBody: () => null }))
vi.mock("../Rail", () => ({ Rail: () => null }))
vi.mock("../../promo", () => ({ AppPromoCard: () => null }))

const ME = { id: "u-me", displayName: "Mia Me" } as unknown as UserDTO

type Bar = "DetailHeader" | "ExpandedShell"

function renderBar(bar: Bar, getNotificationUnread: ReturnType<typeof vi.fn>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const context = makeFakeDataContext({
    api: { getNotificationUnread } as unknown as ApiClient,
    auth: { isAuthenticated: true, user: ME, isPending: false },
  })
  useNavStore.getState().push({ kind: "profile" })
  render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>
        <I18nProvider locale="en">
          {bar === "DetailHeader" ? (
            <DetailHeader active={{ kind: "profile" }} />
          ) : (
            <ExpandedShell renderBody={() => null} />
          )}
        </I18nProvider>
      </ApiProvider>
    </QueryClientProvider>,
  )
  return { queryClient }
}

const unreadAnswer = (hasUnread: boolean) =>
  vi.fn(async (): Promise<NotificationUnreadResponse> => ({ hasUnread }))

const dotsIn = (el: Element) => el.querySelectorAll('[data-testid="unread-dot"]').length

function resetNav(mode: "compact" | "expanded"): void {
  useNavStore.setState({
    view: "home",
    stack: [],
    active: null,
    snap: 2,
    query: "",
    mode,
    originView: null,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe.each<[Bar, "compact" | "expanded"]>([
  ["DetailHeader", "compact"],
  ["ExpandedShell", "expanded"],
])("GH#226 the profile's %s", (bar, mode) => {
  beforeEach(() => resetNav(mode))

  it("T6: puts the Notifications button immediately before Settings, and it opens the notifications page", async () => {
    renderBar(bar, unreadAnswer(false))
    const bell = await screen.findByRole("button", { name: "Notifications" })
    const settings = screen.getByRole("button", { name: "Settings" })
    const buttons = screen.getAllByRole("button")
    expect(buttons.indexOf(settings)).toBe(buttons.indexOf(bell) + 1)
    // Each chip sits in its own slot (the slot also holds its dot); the bell's slot is the gear's neighbour.
    expect(bell.parentElement!.nextElementSibling).toBe(settings.parentElement)

    fireEvent.click(bell)
    expect(useNavStore.getState().active).toEqual({ kind: "activity" })
    expect(useNavStore.getState().stack.map((e) => e.kind)).toEqual(["profile", "activity"])
  })

  it("T7: marks the bell, and only the bell, unread while the server says hasUnread", async () => {
    const getNotificationUnread = unreadAnswer(true)
    const { queryClient } = renderBar(bar, getNotificationUnread)
    const bell = await screen.findByRole("button", { name: "Notifications, unread" })
    expect(dotsIn(bell.parentElement!)).toBe(1)
    expect(dotsIn(screen.getByRole("button", { name: "Settings" }).parentElement!)).toBe(0)
    expect(screen.getAllByTestId("unread-dot")).toHaveLength(1)

    getNotificationUnread.mockImplementation(async () => ({ hasUnread: false }))
    await act(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy())
    expect(screen.queryByTestId("unread-dot")).toBeNull()
  })
})
