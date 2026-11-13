import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
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

const flush = () => act(() => new Promise((r) => setTimeout(r, 20)))

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
])("GH#308 the profile's %s", (bar, mode) => {
  beforeEach(() => resetNav(mode))

  it("keeps Settings, which opens the settings hub, and has no Notifications button", async () => {
    renderBar(bar, unreadAnswer(false))
    const settings = await screen.findByRole("button", { name: "Settings" })
    expect(screen.queryByRole("button", { name: /^Notifications/ })).toBeNull()

    fireEvent.click(settings)
    expect(useNavStore.getState().stack.map((e) => e.kind)).toEqual(["profile", "settings"])
  })

  it("shows no unread dot and says unread nowhere while the server says hasUnread", async () => {
    const getNotificationUnread = unreadAnswer(true)
    renderBar(bar, getNotificationUnread)
    await screen.findByRole("button", { name: "Settings" })
    await flush()
    expect(screen.queryByTestId("unread-dot")).toBeNull()
    const unreadLabels = screen
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label") ?? "")
      .filter((label) => label.includes("unread"))
    expect(unreadLabels).toEqual([])
  })
})
