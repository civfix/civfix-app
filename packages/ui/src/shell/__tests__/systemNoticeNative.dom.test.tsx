/**
 * The system notice as the phone app runs it: dismissals in MMKV under their own id, cleared by the
 * Developer screen's reset, and the bar laid out in the root's flow below the status bar. react-native-web
 * renders the native variants here; the storage seams are swapped for their native files as the phone
 * bundle resolves them.
 */
import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type * as ReactNative from "react-native"
import type { EdgeInsets } from "react-native-safe-area-context"
import type { AppConfigResponse } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"

// Each id's map stands for its MMKV file.
const files = vi.hoisted(() => new Map<string, Map<string, string>>())

vi.mock("react-native-mmkv", () => ({
  MMKV: class {
    private readonly map: Map<string, string>
    constructor({ id }: { id: string }) {
      const existing = files.get(id) ?? new Map<string, string>()
      files.set(id, existing)
      this.map = existing
    }
    getString(key: string) {
      return this.map.get(key)
    }
    set(key: string, value: string) {
      this.map.set(key, value)
    }
    delete(key: string) {
      this.map.delete(key)
    }
    clearAll() {
      this.map.clear()
    }
  },
}))

vi.mock("../../storage/persistentStorage", () => import("../../storage/persistentStorage.native"))
vi.mock("../sidebarStorage", () => import("../sidebarStorage.native"))
vi.mock("../../promo/appPromoStorage", () => import("../../promo/appPromoStorage.native"))
vi.mock("../SystemNoticeBanner", () => import("../SystemNoticeBanner.native"))

// The package's CommonJS build requires the Flow-typed react-native, outside this project's alias to
// react-native-web; the frame only uses its context and hook, which this stand-in keeps as the package has them.
vi.mock("react-native-safe-area-context", async () => {
  const { createContext, useContext } = await vi.importActual<typeof React>("react")
  const SafeAreaInsetsContext = createContext<EdgeInsets | null>(null)
  return {
    SafeAreaInsetsContext,
    useSafeAreaInsets: () => {
      const insets = useContext(SafeAreaInsetsContext)
      if (!insets) throw new Error("No safe area value available.")
      return insets
    },
  }
})

vi.mock("../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})

const { Text } = await import("react-native")
const { SafeAreaInsetsContext, useSafeAreaInsets } = await import("react-native-safe-area-context")
const { PERSISTENT_STORAGE_IDS, SYSTEM_NOTICE_STORAGE_ID } = await import("../../storage/storageIds")
const { clearPersistentStorage } = await import("../../storage/persistentStorage.native")
const { resetPersistedStores } = await import("../../storage/resetPersistedStores")
const { SYSTEM_NOTICE_PERSIST_NAME, useSystemNoticeStore } = await import("../systemNoticeStore")
const { SystemNoticeFrame } = await import("../SystemNoticeFrame")
const { ApiProvider } = await import("../../data/context")
const { makeFakeDataContext } = await import("../../data/fakes")
const { queryKeys } = await import("../../data/keys")
const { I18nProvider } = await import("../../i18n")
const { ThemeProvider } = await import("../../theme")

const TEXT = "Water service paused on Main St tonight"
const BAR = "system-notice"
const DISMISS = "Dismiss announcement"
const STATUS_BAR: EdgeInsets = { top: 24, right: 0, bottom: 34, left: 0 }

function config(text: string | null): AppConfigResponse {
  return {
    minAppVersion: { ios: null, android: null },
    storeUrl: { ios: null, android: "https://play.google.com/store/apps/details?id=org.civfix.community" },
    announcement: text === null ? null : { text, level: "info" },
  }
}

function InsetProbe() {
  const insets = useSafeAreaInsets()
  return <Text testID="content-top-inset">{String(insets.top)}</Text>
}

function renderRoot(announcement: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const context = makeFakeDataContext({ api: { getAppConfig: async () => config(announcement) } as unknown as ApiClient })
  const view = render(
    <QueryClientProvider client={client}>
      <ApiProvider value={context}>
        <I18nProvider locale="en" setLocale={() => {}}>
          <ThemeProvider preference="light">
            <SafeAreaInsetsContext.Provider value={STATUS_BAR}>
              <SystemNoticeFrame>
                <InsetProbe />
              </SystemNoticeFrame>
            </SafeAreaInsetsContext.Provider>
          </ThemeProvider>
        </I18nProvider>
      </ApiProvider>
    </QueryClientProvider>,
  )
  return { ...view, client }
}

beforeEach(() => {
  for (const file of files.values()) file.clear()
  useSystemNoticeStore.setState({ dismissedHash: null, height: 0 })
})

describe("systemNoticeStore on the phone", () => {
  it("T13: dismissals live in MMKV under one new storage id, beside the three existing ones", () => {
    expect(PERSISTENT_STORAGE_IDS).toHaveLength(4)
    expect(PERSISTENT_STORAGE_IDS.slice(0, 3)).toEqual(["civfix.ui.filters", "civfix.ui.sidebar", "civfix.ui.app-promo"])
    expect(PERSISTENT_STORAGE_IDS).toContain(SYSTEM_NOTICE_STORAGE_ID)
    expect(new Set(PERSISTENT_STORAGE_IDS).size).toBe(4)

    useSystemNoticeStore.getState().dismiss(TEXT)
    const saved = files.get(SYSTEM_NOTICE_STORAGE_ID)?.get(SYSTEM_NOTICE_PERSIST_NAME)
    expect(saved).toBeDefined()
    expect(saved).not.toContain(TEXT)
  })

  it("T14: the Developer screen's reset forgets the dismissal, so the same text shows again", async () => {
    useSystemNoticeStore.getState().dismiss(TEXT)
    expect(files.get(SYSTEM_NOTICE_STORAGE_ID)?.get(SYSTEM_NOTICE_PERSIST_NAME)).toBeDefined()

    resetPersistedStores()
    clearPersistentStorage()

    expect(useSystemNoticeStore.getState().dismissedHash).toBe(useSystemNoticeStore.getInitialState().dismissedHash)
    expect(useSystemNoticeStore.getState().dismissedHash).toBeNull()
    expect(files.get(SYSTEM_NOTICE_STORAGE_ID)?.size ?? 0).toBe(0)
    renderRoot(TEXT)
    expect(await screen.findByText(TEXT)).toBeTruthy()
  })
})

describe("SystemNoticeFrame, as the phone root mounts it", () => {
  it("T23: the bar takes the status bar inset once, and the screens below it read a top inset of 0", async () => {
    renderRoot(TEXT)
    const bar = await screen.findByTestId(BAR)
    expect(screen.getByRole("button", { name: DISMISS })).toBeTruthy()
    expect(getComputedStyle(bar).paddingTop).toBe("24px")
    expect(["absolute", "fixed"]).not.toContain(getComputedStyle(bar).position)
    expect(screen.getByTestId("content-top-inset").textContent).toBe("0")

    // In the flow, not over it: the content's box is the bar's next sibling in a column.
    const content = bar.nextElementSibling as HTMLElement | null
    expect(content).not.toBeNull()
    expect(content!.contains(screen.getByTestId("content-top-inset"))).toBe(true)
    expect(getComputedStyle(bar.parentElement!).flexDirection).toBe("column")
    expect(["absolute", "fixed"]).not.toContain(getComputedStyle(content!).position)
  })

  it("T23: with no announcement the screens keep the full status bar inset", async () => {
    const { client } = renderRoot(null)
    await waitFor(() => expect(client.getQueryState(queryKeys.appConfig)?.status).toBe("success"))
    expect(screen.queryByTestId(BAR)).toBeNull()
    expect(screen.getByTestId("content-top-inset").textContent).toBe("24")
  })
})
