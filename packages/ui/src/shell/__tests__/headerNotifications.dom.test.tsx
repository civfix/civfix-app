import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type * as ReactNative from "react-native"
import type { NotificationUnreadResponse, UserDTO } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import type * as ThemeModule from "../../theme"
import { ApiProvider } from "../../data/context"
import { makeFakeDataContext } from "../../data/fakes"
import { I18nProvider } from "../../i18n"
import { HeaderProfileButton } from "../../bodies/HeaderProfileButton"
import { SearchHeader as WebSearchHeader } from "../SearchHeader.web"
import { SearchHeader as NativeSearchHeader } from "../SearchHeader.native"
import { MapControls } from "../../map/MapControls"
import { MapHeaderActions } from "../../map/MapHeaderActions"
import { NotificationsButton } from "../../bodies/NotificationsButton"
import { useNavStore } from "../../nav"

const layout = vi.hoisted(() => ({ mode: "compact" }))

vi.mock("../../theme", async () => {
  const actual = await vi.importActual<typeof ThemeModule>("../../theme")
  return { ...actual, useLayoutMode: () => layout.mode }
})
// The icon set and the primitives barrel pull in native-only modules; the avatars are read by their labels.
vi.mock("../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})
vi.mock("../../primitives/UnreadDot", async () => {
  const { View } = await vi.importActual<typeof ReactNative>("react-native")
  return { UnreadDot: () => <View testID="unread-dot" /> }
})
vi.mock("../../primitives", async () => {
  const { View } = await vi.importActual<typeof ReactNative>("react-native")
  // The mocked dot above, so a dot drawn through the barrel and one drawn by GlassButton look alike.
  const { UnreadDot } = await import("../../primitives/UnreadDot")
  const { GlassButton } = await vi.importActual<{ GlassButton: React.ComponentType }>(
    "../../primitives/GlassButton",
  )
  return {
    Avatar: () => <View testID="avatar" />,
    Brand: () => null,
    GlassButton,
    UnreadDot,
    openBrandAbout: () => {},
  }
})
vi.mock("../../surface", () => ({ BlurSurface: () => null }))
vi.mock("../TabBar.shared", () => ({ BarGlass: () => null }))
vi.mock("@gorhom/bottom-sheet", async () => {
  const { TextInput } = await vi.importActual<typeof ReactNative>("react-native")
  return { BottomSheetTextInput: TextInput }
})
vi.mock("react-native-reanimated", () => ({
  ReduceMotion: { System: "system" },
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}))
vi.mock("../motionConfigs.native", () => ({ dockFocusConfig: () => ({}) }))
vi.mock("../useKeyboardAnchor.native", () => ({
  useKeyboardAnchor: () => ({ liftStyle: null, reserved: 0 }),
}))
// The expanded map's other controls are their own screens; the bell and the profile entry are under test.
vi.mock("../../map/LayersPopover", () => ({
  LayersPopover: () => null,
  useLayersPopoverPresence: () => ({ mounted: false, isClosing: false, onClosed: () => {} }),
}))

const ME = { id: "u-me", displayName: "Mia Me" } as unknown as UserDTO

type Avatar = "HeaderProfileButton" | "SearchHeader.web" | "SearchHeader.native" | "ProfileEntry"
type MapBar = "MapHeaderActions" | "MapControls"

const LABEL: Record<Avatar, string> = {
  HeaderProfileButton: "Open profile",
  "SearchHeader.web": "Open profile",
  "SearchHeader.native": "Open profile",
  ProfileEntry: "Open your profile",
}

function surface(target: Avatar | MapBar, signedIn: boolean) {
  const searchProps = {
    value: "",
    placeholder: "Search",
    mode: "reports" as const,
    onChangeText: () => {},
    onFocus: () => {},
    onOpenProfile: () => {},
    ...(signedIn ? { userName: "Mia Me" } : { onSignIn: () => {} }),
  }
  switch (target) {
    case "HeaderProfileButton":
      layout.mode = "compact"
      return <HeaderProfileButton />
    case "SearchHeader.web":
      return <WebSearchHeader {...searchProps} />
    case "SearchHeader.native":
      return <NativeSearchHeader {...searchProps} />
    case "MapHeaderActions":
      layout.mode = "compact"
      return <MapHeaderActions />
    case "ProfileEntry":
    case "MapControls":
      layout.mode = "expanded"
      return <MapControls onLocate={() => {}} />
  }
}

function renderSurface(
  target: Avatar | MapBar,
  getNotificationUnread: ReturnType<typeof vi.fn>,
  signedIn = true,
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const context = makeFakeDataContext({
    api: { getNotificationUnread } as unknown as ApiClient,
    auth: signedIn ? { isAuthenticated: true, user: ME, isPending: false } : {},
  })
  render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>
        <I18nProvider locale="en">
          {/* A bell beside a lone avatar proves the server's answer has arrived before the avatar is read. */}
          {target === "ProfileEntry" ||
          target === "MapControls" ||
          target === "MapHeaderActions" ? null : (
            <NotificationsButton variant="solid" />
          )}
          {surface(target, signedIn)}
        </I18nProvider>
      </ApiProvider>
    </QueryClientProvider>,
  )
  return { queryClient }
}

const unreadAnswer = (hasUnread: boolean) =>
  vi.fn(async (): Promise<NotificationUnreadResponse> => ({ hasUnread }))

const flush = () => act(() => new Promise((r) => setTimeout(r, 20)))

const dotsIn = (el: Element) => el.querySelectorAll('[data-testid="unread-dot"]').length

beforeEach(() => {
  useNavStore.setState({
    view: "home",
    stack: [],
    active: null,
    snap: 2,
    query: "",
    mode: "compact",
    originView: null,
  })
})

afterEach(() => {
  layout.mode = "compact"
  vi.restoreAllMocks()
})

const AVATARS: Avatar[] = [
  "HeaderProfileButton",
  "SearchHeader.web",
  "SearchHeader.native",
  "ProfileEntry",
]

describe.each(AVATARS)("GH#308 the %s avatar", (avatar) => {
  it("is just the profile picture: no dot and no unread in its name while the server says hasUnread", async () => {
    renderSurface(avatar, unreadAnswer(true))
    await screen.findByRole("button", { name: "Notifications, unread" })
    const button = screen.getByRole("button", { name: LABEL[avatar] })
    expect(button.contains(screen.getByTestId("avatar"))).toBe(true)
    expect(dotsIn(button.parentElement!)).toBe(0)
  })
})

describe.each<MapBar>(["MapHeaderActions", "MapControls"])("GH#308 the %s bell", (bar) => {
  it("replaces the appearance button and opens the notification center", async () => {
    renderSurface(bar, unreadAnswer(false))
    const bell = await screen.findByRole("button", { name: "Notifications" })
    expect(screen.queryByRole("button", { name: /appearance/i })).toBeNull()
    const buttons = screen.getAllByRole("button")
    const avatar = screen.getByRole("button", { name: /^Open (your )?profile$/ })
    expect(buttons.indexOf(avatar)).toBe(buttons.indexOf(bell) + 1)

    fireEvent.click(bell)
    expect(useNavStore.getState().active).toEqual({ kind: "activity" })
  })

  it("wears the only unread dot, and says unread, exactly while the server says hasUnread", async () => {
    const getNotificationUnread = unreadAnswer(true)
    const { queryClient } = renderSurface(bar, getNotificationUnread)
    const bell = await screen.findByRole("button", { name: "Notifications, unread" })
    expect(dotsIn(bell.parentElement!)).toBe(1)
    expect(screen.getAllByTestId("unread-dot")).toHaveLength(1)
    const unreadLabels = screen
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label") ?? "")
      .filter((label) => label.includes("unread"))
    expect(unreadLabels).toEqual(["Notifications, unread"])

    getNotificationUnread.mockImplementation(async () => ({ hasUnread: false }))
    await act(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy())
    expect(screen.queryByTestId("unread-dot")).toBeNull()
  })

  it("shows no dot to a signed-out visitor and never asks the server", async () => {
    const getNotificationUnread = unreadAnswer(true)
    renderSurface(bar, getNotificationUnread, false)
    await flush()
    expect(screen.queryByTestId("unread-dot")).toBeNull()
    expect(getNotificationUnread).not.toHaveBeenCalled()
  })
})
