import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type * as ReactNative from "react-native"
import {
  NOTIFICATION_CATEGORY_DEFAULTS,
  type NotificationCategory,
  type NotificationCategorySetting,
  type NotificationSettingsDTO,
  type UserDTO,
} from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import {
  CapabilitiesProvider,
  makeFakeCapabilities,
  type FakePushPermission,
  type PushPermissionCapability,
  type PushPermissionStatus,
} from "../../capabilities"
import { ApiProvider } from "../../data/context"
import { makeFakeDataContext } from "../../data/fakes"
import { I18nProvider } from "../../i18n"
import { ToastContext } from "../../primitives/toastContext"
import type * as ToastContextModule from "../../primitives/toastContext"
import { NotificationSettingsBody } from "../NotificationSettingsBody"

// The icon set and the primitives barrel pull in native-only modules; the page is read by its text and roles.
vi.mock("../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})
vi.mock("../../primitives", async () => {
  const { Pressable, Text, View } = await vi.importActual<typeof ReactNative>("react-native")
  const { useToast } = await vi.importActual<typeof ToastContextModule>("../../primitives/toastContext")
  const Copy = ({ title, body }: { title: string; body: string }) => (
    <View>
      <Text>{title}</Text>
      <Text>{body}</Text>
    </View>
  )
  return {
    EmptyState: Copy,
    SignInPrompt: Copy,
    SecondaryButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
    SkeletonGroup: ({ children }: { children: React.ReactNode }) => <View testID="skeleton">{children}</View>,
    SkeletonList: () => null,
    SkeletonText: () => null,
    useToast,
  }
})

const ME = { id: "u-me", displayName: "Mia Me" } as unknown as UserDTO

const LABELS: Record<NotificationCategory, string> = {
  reportUpdates: "Updates on your reports",
  reportDiscussions: "Report discussions",
  directMessages: "Direct messages",
  mentions: "Mentions and replies",
  groupChats: "Group chats",
  events: "Events you're going to",
  hostAnnouncements: "Announcements from hosts",
  eventTeam: "Event team and hours",
  followers: "New followers",
  likesAndReposts: "Likes and reposts",
  organizations: "Organizations",
}

const HELPERS: Partial<Record<NotificationCategory, string>> = {
  reportUpdates: "Status changes, replies from the city and messages from civfix staff",
  reportDiscussions: "New messages in report chats you're part of",
  directMessages: "Messages sent just to you",
  mentions: "When someone @mentions you, replies to you or quotes your post",
  groupChats: "New messages in group chats you're in",
  events: "Reminders, changes, cancellations and your spot on the list",
  hostAnnouncements: "Updates and thank-yous from the people running events you joined",
  eventTeam: "Team invites, role changes and volunteer hours",
  organizations: "Invites and verification decisions",
}

const IN_ORDER: NotificationCategory[] = [
  "reportUpdates",
  "reportDiscussions",
  "directMessages",
  "mentions",
  "groupChats",
  "events",
  "hostAnnouncements",
  "eventTeam",
  "followers",
  "likesAndReposts",
  "organizations",
]

const EVENTS_OFF_WARNING = "You won't hear if an event you joined is cancelled or changes time."
const PUSH_OFF = "Push notifications are off on this device"

function settingsWith(
  over: Partial<Record<NotificationCategory, NotificationCategorySetting>> = {},
  emailAvailable = true,
): NotificationSettingsDTO {
  return { categories: { ...NOTIFICATION_CATEGORY_DEFAULTS, ...over }, emailAvailable }
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

function renderBody({
  signedIn = true,
  getNotificationSettings = vi.fn(async () => settingsWith()),
  updateNotificationSettings = vi.fn(async () => settingsWith()),
  status = "granted",
  openSettings = true,
}: {
  signedIn?: boolean
  getNotificationSettings?: ReturnType<typeof vi.fn>
  updateNotificationSettings?: ReturnType<typeof vi.fn>
  status?: PushPermissionStatus
  openSettings?: boolean
} = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const api = { getNotificationSettings, updateNotificationSettings }
  const context = makeFakeDataContext({
    api: api as unknown as ApiClient,
    auth: signedIn ? { isAuthenticated: true, user: ME, isPending: false } : {},
  })
  const capabilities = makeFakeCapabilities()
  const fake = capabilities.pushPermission as FakePushPermission
  fake.setStatus(status)
  const pushPermission: PushPermissionCapability = openSettings
    ? fake
    : { status: () => fake.status(), request: () => fake.request() }
  capabilities.pushPermission = pushPermission
  const request = vi.spyOn(fake, "request")
  const openSettingsSpy = vi.spyOn(fake, "openSettings")
  const toast = { show: vi.fn() }
  render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>
        <CapabilitiesProvider value={capabilities}>
          <I18nProvider locale="en">
            <ToastContext.Provider value={toast}>
              <NotificationSettingsBody />
            </ToastContext.Provider>
          </I18nProvider>
        </CapabilitiesProvider>
      </ApiProvider>
    </QueryClientProvider>,
  )
  return { api, request, openSettings: openSettingsSpy, toast, queryClient }
}

const categorySwitch = (category: NotificationCategory) => screen.getByRole("switch", { name: LABELS[category] })
const box = (channel: "Push" | "Email", category: NotificationCategory) =>
  screen.queryByRole("checkbox", { name: `${channel}, ${LABELS[category]}` })
// "Organizations" is both a section and a category, so a label is looked up outside the headings.
const label = (category: NotificationCategory) => screen.getByText(LABELS[category], { ignore: '[role="heading"]' })
const checked = (el: HTMLElement | null) => el?.getAttribute("aria-checked") === "true"
const disabled = (el: HTMLElement | null) => el?.getAttribute("aria-disabled") === "true"

// Lets every cache write a settled save made reach the screen before a test reads it.
const flush = () => act(() => new Promise((r) => setTimeout(r, 20)))

// The page has loaded once every category switch is on screen.
const loaded = () => screen.findAllByRole("switch")
// usePushPermission reads the capability after mount; a Push box is enabled only once it has said granted.
const pushSettled = () => waitFor(() => expect(disabled(box("Push", "reportUpdates"))).toBe(false))

afterEach(() => {
  focusManager.setFocused(undefined)
  vi.restoreAllMocks()
})

describe("GH#223 NotificationSettingsBody", () => {
  it("T1: renders the five sections and the eleven categories in order, each with its D1 helper", async () => {
    renderBody()
    await loaded()
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual([
      "Your reports",
      "Messages",
      "Events",
      "Social",
      "Organizations",
    ])
    expect(screen.getAllByRole("switch").map((s) => s.getAttribute("aria-label"))).toEqual(
      IN_ORDER.map((c) => LABELS[c]),
    )
    for (const category of IN_ORDER) {
      const column = label(category).parentElement!
      expect(column.textContent, category).toBe(LABELS[category] + (HELPERS[category] ?? ""))
    }
    expect(label("followers").parentElement!.textContent).toBe("New followers")
    expect(label("likesAndReposts").parentElement!.textContent).toBe("Likes and reposts")
  })

  it("T2: shows the D1 defaults as switches and checkboxes", async () => {
    renderBody()
    await loaded()
    const pushOn = new Set<NotificationCategory>([
      "reportUpdates",
      "directMessages",
      "mentions",
      "events",
      "hostAnnouncements",
      "eventTeam",
    ])
    const emailOn = new Set<NotificationCategory>(["events", "organizations"])
    for (const category of IN_ORDER) {
      expect(checked(categorySwitch(category)), category).toBe(true)
      expect(checked(box("Push", category)), `Push ${category}`).toBe(pushOn.has(category))
      expect(checked(box("Email", category)), `Email ${category}`).toBe(emailOn.has(category))
    }
  })

  it("T3: an Off category shows its switch off and no Push or Email checkbox", async () => {
    renderBody({
      getNotificationSettings: vi.fn(async () =>
        settingsWith({ groupChats: { enabled: false, push: true, email: false } }),
      ),
    })
    await loaded()
    expect(checked(categorySwitch("groupChats"))).toBe(false)
    expect(box("Push", "groupChats")).toBeNull()
    expect(box("Email", "groupChats")).toBeNull()
    for (const category of IN_ORDER.filter((c) => c !== "groupChats")) {
      expect(box("Push", category), category).not.toBeNull()
      expect(box("Email", category), category).not.toBeNull()
    }
  })

  it("T4: a Push press saves that one field and shows it checked before the server answers", async () => {
    const pending = held<NotificationSettingsDTO>()
    const updateNotificationSettings = vi.fn(() => pending.promise)
    renderBody({ updateNotificationSettings })
    await loaded()
    await pushSettled()
    fireEvent.click(box("Push", "reportDiscussions")!)
    await waitFor(() => expect(checked(box("Push", "reportDiscussions"))).toBe(true))
    expect(updateNotificationSettings).toHaveBeenCalledTimes(1)
    expect(updateNotificationSettings).toHaveBeenCalledWith({ categories: { reportDiscussions: { push: true } } })
    pending.resolve(settingsWith({ reportDiscussions: { enabled: true, push: true, email: false } }))
  })

  it("T5: turning a category off saves enabled:false and hides its checkboxes before the server answers", async () => {
    const pending = held<NotificationSettingsDTO>()
    const updateNotificationSettings = vi.fn(() => pending.promise)
    renderBody({ updateNotificationSettings })
    await loaded()
    fireEvent.click(categorySwitch("groupChats"))
    await waitFor(() => expect(box("Push", "groupChats")).toBeNull())
    expect(box("Email", "groupChats")).toBeNull()
    expect(updateNotificationSettings).toHaveBeenCalledTimes(1)
    expect(updateNotificationSettings).toHaveBeenCalledWith({ categories: { groupChats: { enabled: false } } })
    pending.resolve(settingsWith({ groupChats: { enabled: false, push: false, email: false } }))
  })

  it("T6: a failed save rolls the box back and toasts the error", async () => {
    const updateNotificationSettings = vi.fn(async () => {
      throw new Error("503")
    })
    const { toast } = renderBody({ updateNotificationSettings })
    await loaded()
    fireEvent.click(box("Email", "reportUpdates")!)
    await waitFor(() => expect(toast.show).toHaveBeenCalledWith("Couldn't save that change. Try again.", { variant: "error" }))
    expect(checked(box("Email", "reportUpdates"))).toBe(false)
  })

  it("T7: Events you're going to warns while it is Off, and only then", async () => {
    renderBody({
      getNotificationSettings: vi.fn(async () => settingsWith({ events: { enabled: false, push: true, email: true } })),
    })
    await loaded()
    expect(screen.getByText(EVENTS_OFF_WARNING)).toBeTruthy()
  })

  it("T7: no Events warning while Events you're going to is On", async () => {
    renderBody({
      getNotificationSettings: vi.fn(async () => settingsWith({ events: { enabled: true, push: true, email: true } })),
    })
    await loaded()
    expect(screen.queryByText(EVENTS_OFF_WARNING)).toBeNull()
  })

  it("T8: undetermined shows the banner, disables Push keeping its value, and Turn on asks", async () => {
    const { request } = renderBody({ status: "undetermined" })
    await loaded()
    expect(await screen.findByText(PUSH_OFF)).toBeTruthy()
    for (const category of IN_ORDER) expect(disabled(box("Push", category)), category).toBe(true)
    expect(checked(box("Push", "reportUpdates"))).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Turn on" }))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
  })

  it("T9: denied with openSettings sends Turn on to the system settings, never the prompt", async () => {
    const { request, openSettings } = renderBody({ status: "denied", openSettings: true })
    await loaded()
    fireEvent.click(await screen.findByRole("button", { name: "Turn on" }))
    await waitFor(() => expect(openSettings).toHaveBeenCalledTimes(1))
    expect(request).not.toHaveBeenCalled()
  })

  it("T10: denied without openSettings explains the browser's site settings", async () => {
    const { request } = renderBody({ status: "denied", openSettings: false })
    await loaded()
    fireEvent.click(await screen.findByRole("button", { name: "Turn on" }))
    expect(await screen.findByText("Allow notifications for civfix in your browser's site settings.")).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it("T11: unsupported says so with no Turn on button and every Push box disabled", async () => {
    renderBody({ status: "unsupported" })
    await loaded()
    expect(await screen.findByText("This browser can't show notifications")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Turn on" })).toBeNull()
    for (const category of IN_ORDER) expect(disabled(box("Push", category)), category).toBe(true)
  })

  it("T12: granted shows no banner and enables the Push boxes", async () => {
    renderBody({ status: "granted" })
    await loaded()
    await pushSettled()
    expect(screen.queryByText(PUSH_OFF)).toBeNull()
    for (const category of IN_ORDER) expect(disabled(box("Push", category)), category).toBe(false)
  })

  it("T13: without a verified email every Email box is disabled and keeps its value", async () => {
    renderBody({ getNotificationSettings: vi.fn(async () => settingsWith({}, false)) })
    await loaded()
    for (const category of IN_ORDER) expect(disabled(box("Email", category)), category).toBe(true)
    expect(screen.getByText("Add a verified email to get emails.")).toBeTruthy()
    expect(checked(box("Email", "events"))).toBe(true)
  })

  it("T14: pressing a disabled Push box saves nothing", async () => {
    const { api } = renderBody({ status: "denied" })
    await loaded()
    await screen.findByText(PUSH_OFF)
    fireEvent.click(box("Push", "reportDiscussions")!)
    await flush()
    expect(api.updateNotificationSettings).not.toHaveBeenCalled()
  })

  it("T15: shows the loading state while the settings load", async () => {
    const getNotificationSettings = vi.fn(() => new Promise<NotificationSettingsDTO>(() => {}))
    renderBody({ getNotificationSettings })
    await waitFor(() => expect(getNotificationSettings).toHaveBeenCalled())
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0)
    for (const category of IN_ORDER) expect(screen.queryByText(LABELS[category], { ignore: '[role="heading"]' })).toBeNull()
  })

  it("T16: shows the error state when the settings fail to load", async () => {
    renderBody({
      getNotificationSettings: vi.fn(async () => {
        throw new Error("offline")
      }),
    })
    expect(await screen.findByText("Could not load preferences")).toBeTruthy()
    expect(screen.getByText("We could not reach civfix. Check your connection and try again.")).toBeTruthy()
    for (const category of IN_ORDER) expect(screen.queryByText(LABELS[category], { ignore: '[role="heading"]' })).toBeNull()
  })

  it("T17: signed out asks to sign in and never reads the settings", () => {
    const { api } = renderBody({ signedIn: false })
    expect(screen.getByText("Sign in to manage notifications")).toBeTruthy()
    expect(api.getNotificationSettings).not.toHaveBeenCalled()
  })

  it("rolls back only the failed change when two saves overlap", async () => {
    const first = held<NotificationSettingsDTO>()
    const second = held<NotificationSettingsDTO>()
    const updateNotificationSettings = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const { toast, queryClient } = renderBody({ updateNotificationSettings })
    await loaded()
    await pushSettled()
    fireEvent.click(box("Push", "reportDiscussions")!)
    await waitFor(() => expect(checked(box("Push", "reportDiscussions"))).toBe(true))
    fireEvent.click(box("Email", "groupChats")!)
    await waitFor(() => expect(checked(box("Email", "groupChats"))).toBe(true))

    first.reject(new Error("503"))
    await waitFor(() => expect(checked(box("Push", "reportDiscussions"))).toBe(false))
    expect(toast.show).toHaveBeenCalledWith("Couldn't save that change. Try again.", { variant: "error" })
    expect(checked(box("Email", "groupChats"))).toBe(true)

    second.resolve(settingsWith({ groupChats: { enabled: true, push: false, email: true } }))
    await waitFor(() => expect(queryClient.isMutating()).toBe(0))
    await flush()
    expect(checked(box("Email", "groupChats"))).toBe(true)
    expect(checked(box("Push", "reportDiscussions"))).toBe(false)
  })

  it("keeps a newer pending change when an older save answers first", async () => {
    const first = held<NotificationSettingsDTO>()
    const second = held<NotificationSettingsDTO>()
    const updateNotificationSettings = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const { queryClient } = renderBody({ updateNotificationSettings })
    await loaded()
    await pushSettled()
    fireEvent.click(box("Push", "reportDiscussions")!)
    await waitFor(() => expect(checked(box("Push", "reportDiscussions"))).toBe(true))
    fireEvent.click(box("Email", "groupChats")!)
    await waitFor(() => expect(checked(box("Email", "groupChats"))).toBe(true))

    // The server applied only the first change when it answered it.
    first.resolve(settingsWith({ reportDiscussions: { enabled: true, push: true, email: false } }))
    await waitFor(() => expect(queryClient.isMutating()).toBe(1))
    await flush()
    expect(checked(box("Email", "groupChats"))).toBe(true)
    expect(checked(box("Push", "reportDiscussions"))).toBe(true)

    second.resolve(
      settingsWith({
        reportDiscussions: { enabled: true, push: true, email: false },
        groupChats: { enabled: true, push: false, email: true },
      }),
    )
    await waitFor(() => expect(queryClient.isMutating()).toBe(0))
    await flush()
    expect(checked(box("Email", "groupChats"))).toBe(true)
    expect(checked(box("Push", "reportDiscussions"))).toBe(true)
  })
})
