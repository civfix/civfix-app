import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
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
// The expanded map's other controls are their own screens; the profile entry and the bar's buttons are under test.
vi.mock("../../map/LayersPopover", () => ({
  LayersPopover: () => null,
  useLayersPopoverPresence: () => ({ mounted: false, isClosing: false, onClosed: () => {} }),
}))
vi.mock("../../map/MapHeaderActions", () => ({ MapHeaderActions: () => null }))
vi.mock("../../map/MapThemeToggle", () => ({ MapThemeToggle: () => null }))

const ME = { id: "u-me", displayName: "Mia Me" } as unknown as UserDTO

type Avatar = "HeaderProfileButton" | "SearchHeader.web" | "SearchHeader.native" | "ProfileEntry"

const LABEL: Record<Avatar, string> = {
  HeaderProfileButton: "Open profile",
  "SearchHeader.web": "Open profile",
  "SearchHeader.native": "Open profile",
  ProfileEntry: "Open your profile",
}

function surface(avatar: Avatar, signedIn: boolean) {
  const searchProps = {
    value: "",
    placeholder: "Search",
    mode: "reports" as const,
    onChangeText: () => {},
    onFocus: () => {},
    onOpenProfile: () => {},
    ...(signedIn ? { userName: "Mia Me" } : { onSignIn: () => {} }),
  }
  switch (avatar) {
    case "HeaderProfileButton":
      layout.mode = "compact"
      return <HeaderProfileButton />
    case "SearchHeader.web":
      return <WebSearchHeader {...searchProps} />
    case "SearchHeader.native":
      return <NativeSearchHeader {...searchProps} />
    case "ProfileEntry":
      layout.mode = "expanded"
      return <MapControls onLocate={() => {}} />
  }
}

function renderAvatar(
  avatar: Avatar,
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
        <I18nProvider locale="en">{surface(avatar, signedIn)}</I18nProvider>
      </ApiProvider>
    </QueryClientProvider>,
  )
  return { queryClient }
}

const unreadAnswer = (hasUnread: boolean) =>
  vi.fn(async (): Promise<NotificationUnreadResponse> => ({ hasUnread }))

const flush = () => act(() => new Promise((r) => setTimeout(r, 20)))

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

describe.each(AVATARS)("GH#226 the %s avatar", (avatar) => {
  it("T8: says unread and wears the dot exactly while the server says hasUnread", async () => {
    const getNotificationUnread = unreadAnswer(true)
    const { queryClient } = renderAvatar(avatar, getNotificationUnread)
    const button = await screen.findByRole("button", { name: `${LABEL[avatar]}, unread` })
    const slot = button.parentElement!
    expect(slot.contains(screen.getByTestId("unread-dot"))).toBe(true)
    expect(slot.contains(screen.getByTestId("avatar"))).toBe(true)
    expect(screen.getAllByTestId("unread-dot")).toHaveLength(1)

    getNotificationUnread.mockImplementation(async () => ({ hasUnread: false }))
    await act(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }))
    await waitFor(() => expect(screen.getByRole("button", { name: LABEL[avatar] })).toBeTruthy())
    expect(screen.queryByTestId("unread-dot")).toBeNull()
  })

  it("T9: shows no dot to a signed-out visitor and never asks the server", async () => {
    const getNotificationUnread = unreadAnswer(true)
    renderAvatar(avatar, getNotificationUnread, false)
    await flush()
    expect(screen.queryByTestId("unread-dot")).toBeNull()
    expect(getNotificationUnread).not.toHaveBeenCalled()
  })
})

describe("GH#226 the expanded map's top bar", () => {
  it("T10: has no Notifications bell; the profile entry is the only thing that says unread", async () => {
    renderAvatar("ProfileEntry", unreadAnswer(true))
    await screen.findByRole("button", { name: "Open your profile, unread" })
    expect(screen.queryByRole("button", { name: /^Notifications/ })).toBeNull()
    const unreadLabels = screen
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label") ?? "")
      .filter((label) => label.includes("unread"))
    expect(unreadLabels).toEqual(["Open your profile, unread"])
  })
})
