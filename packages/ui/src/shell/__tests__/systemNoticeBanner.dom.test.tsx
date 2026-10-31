/**
 * The system notice (D8): the bar founders set from the console's flags, shown to everyone on web and
 * phone, dismissed per device until its text changes. These run the web build (react-native-web) against a
 * fake `getAppConfig`, the same seam the apps' data providers fill.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type * as ReactNative from "react-native"
import { AppError, ErrorCode, type AppConfigResponse } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import type { ColorSchemeName } from "@civfix/tokens"
import { chipHuePairs, type ChipHueName } from "@civfix/tokens/chip-contrast"
import { ApiProvider } from "../../data/context"
import { makeFakeDataContext } from "../../data/fakes"
import { queryKeys } from "../../data/keys"
import { I18nProvider } from "../../i18n"
import { useAppPromoStore } from "../../promo/appPromoStore"
import { ThemeProvider } from "../../theme"
import { SystemNoticeBanner } from "../SystemNoticeBanner"
import { SYSTEM_NOTICE_PERSIST_NAME, useSystemNoticeStore } from "../systemNoticeStore"

// The icon set pulls in native-only modules; the stand-in keeps the colour it was given readable.
vi.mock("../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return {
    Text,
    Icon: ({ color }: { color?: string }) => <span data-testid="notice-icon" data-color={color} />,
    iconMap: {},
  }
})

const TEXT = "Water service paused on Main St tonight"
const TEXT_B = "The map is back to normal"
const BAR = "system-notice"
const DISMISS = "Dismiss announcement"

type Announcement = NonNullable<AppConfigResponse["announcement"]>

function config(announcement: Announcement | null): AppConfigResponse {
  return {
    minAppVersion: { ios: null, android: null },
    storeUrl: {
      ios: null,
      android: "https://play.google.com/store/apps/details?id=org.civfix.community",
    },
    announcement,
  }
}

function newClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

interface Harness {
  SystemNoticeBanner: typeof SystemNoticeBanner
  ApiProvider: typeof ApiProvider
  makeFakeDataContext: typeof makeFakeDataContext
  I18nProvider: typeof I18nProvider
  ThemeProvider: typeof ThemeProvider
}

const STATIC: Harness = {
  SystemNoticeBanner,
  ApiProvider,
  makeFakeDataContext,
  I18nProvider,
  ThemeProvider,
}

/** A fresh module graph, as a restart sees it: the store hydrates from whatever storage already holds. */
async function freshModules() {
  vi.resetModules()
  const [banner, context, fakes, i18n, theme, store] = await Promise.all([
    import("../SystemNoticeBanner"),
    import("../../data/context"),
    import("../../data/fakes"),
    import("../../i18n"),
    import("../../theme"),
    import("../systemNoticeStore"),
  ])
  const harness: Harness = {
    SystemNoticeBanner: banner.SystemNoticeBanner,
    ApiProvider: context.ApiProvider,
    makeFakeDataContext: fakes.makeFakeDataContext,
    I18nProvider: i18n.I18nProvider,
    ThemeProvider: theme.ThemeProvider,
  }
  return { harness, store: store.useSystemNoticeStore }
}

function renderBanner(
  getAppConfig: () => Promise<AppConfigResponse>,
  {
    scheme = "light",
    client = newClient(),
    harness = STATIC,
  }: { scheme?: ColorSchemeName; client?: QueryClient; harness?: Harness } = {},
) {
  const h = harness
  const context = h.makeFakeDataContext({ api: { getAppConfig } as unknown as ApiClient })
  const view = render(
    <QueryClientProvider client={client}>
      <h.ApiProvider value={context}>
        <h.I18nProvider locale="en" setLocale={() => {}}>
          <h.ThemeProvider preference={scheme}>
            <h.SystemNoticeBanner />
          </h.ThemeProvider>
        </h.I18nProvider>
      </h.ApiProvider>
    </QueryClientProvider>,
  )
  return { ...view, client }
}

async function settled(client: QueryClient) {
  await waitFor(() => expect(client.getQueryState(queryKeys.appConfig)?.fetchStatus).toBe("idle"))
  await act(async () => {
    await Promise.resolve()
  })
}

function persisted(): string | null {
  return window.localStorage.getItem(SYSTEM_NOTICE_PERSIST_NAME)
}

// jsdom reports computed colours as rgb(); the tokens hold hex.
function rgb(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

function pair(scheme: ColorSchemeName, name: ChipHueName) {
  const found = chipHuePairs(scheme).find((p) => p.name === name)
  if (!found) throw new Error(`no ${name} chip pair`)
  return found
}

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", NoopResizeObserver)
  window.localStorage.clear()
  useSystemNoticeStore.setState({ dismissedHash: null, height: 0 })
  useAppPromoStore.setState({ dismissed: false, bannerHeight: 0, cardHeight: 0 })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("SystemNoticeBanner: showing the notice", () => {
  it("T1: shows a guest the text and exactly one close button named Dismiss announcement", async () => {
    renderBanner(async () => config({ text: TEXT, level: "info" }))
    expect(await screen.findByText(TEXT)).toBeTruthy()
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.getAttribute("aria-label")).toBe(DISMISS)
    expect(screen.getByRole("button", { name: DISMISS })).toBe(buttons[0])
  })

  it("T2: renders markup and links as plain text, with nothing pressable but the close button", async () => {
    const raw = "<b>Outage</b> see [status](https://example.org) https://example.org"
    renderBanner(async () => config({ text: raw, level: "info" }))
    const bar = await screen.findByTestId(BAR)
    expect(bar.textContent).toBe(raw)
    expect(bar.querySelectorAll("a")).toHaveLength(0)
    expect(bar.querySelectorAll("b")).toHaveLength(0)
    const pressable = bar.querySelectorAll('a, button, [role="button"], [role="link"], [tabindex]')
    expect(Array.from(pressable)).toEqual([screen.getByRole("button", { name: DISMISS })])
  })

  it.each<ColorSchemeName>(["light", "dark"])(
    "T3: info wears the sky chip pair (%s)",
    async (scheme) => {
      renderBanner(async () => config({ text: TEXT, level: "info" }), { scheme })
      const bar = await screen.findByTestId(BAR)
      const sky = pair(scheme, "sky")
      expect(getComputedStyle(bar).backgroundColor).toBe(rgb(sky.bg))
      expect(getComputedStyle(screen.getByText(TEXT)).color).toBe(rgb(sky.text))
      expect(screen.getByTestId("notice-icon").getAttribute("data-color")).toBe(sky.text)
    },
  )

  it.each<ColorSchemeName>(["light", "dark"])(
    "T4: warning wears the sun chip pair (%s)",
    async (scheme) => {
      renderBanner(async () => config({ text: TEXT, level: "warning" }), { scheme })
      const bar = await screen.findByTestId(BAR)
      const sun = pair(scheme, "sun")
      expect(getComputedStyle(bar).backgroundColor).toBe(rgb(sun.bg))
      expect(getComputedStyle(screen.getByText(TEXT)).color).toBe(rgb(sun.text))
      expect(screen.getByTestId("notice-icon").getAttribute("data-color")).toBe(sun.text)
    },
  )
})

describe("SystemNoticeBanner: nothing to show", () => {
  it("T5: no announcement renders nothing and publishes no height", async () => {
    const { client, container } = renderBanner(async () => config(null))
    await settled(client)
    expect(screen.queryByRole("button", { name: DISMISS })).toBeNull()
    expect(container.innerHTML).toBe("")
    expect(useSystemNoticeStore.getState().height).toBe(0)
  })

  it.each([
    ["a network TypeError", () => new TypeError("Network request failed")],
    [
      "an AppError with status 503",
      () => new AppError(ErrorCode.INTERNAL, "unavailable", { httpStatus: 503 }),
    ],
  ])("T6: a failed request (%s) renders nothing and no error", async (_name, failure) => {
    const getAppConfig = vi.fn(async (): Promise<AppConfigResponse> => {
      throw failure()
    })
    const { client, container } = renderBanner(getAppConfig)
    await settled(client)
    expect(client.getQueryState(queryKeys.appConfig)?.status).toBe("error")
    expect(container.innerHTML).toBe("")
    expect(container.textContent).toBe("")
    expect(useSystemNoticeStore.getState().height).toBe(0)
  })

  it("T7: with the API off (the request never settles) nothing renders", async () => {
    const getAppConfig = vi.fn(() => new Promise<AppConfigResponse>(() => {}))
    const { container } = renderBanner(getAppConfig)
    await waitFor(() => expect(getAppConfig).toHaveBeenCalled())
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(container.innerHTML).toBe("")
    expect(useSystemNoticeStore.getState().height).toBe(0)
  })
})

describe("SystemNoticeBanner: dismissing", () => {
  it("T8: closing hides it and stores a hash of the text, the same one each time", async () => {
    const shown = renderBanner(async () => config({ text: TEXT, level: "info" }))
    fireEvent.click(await screen.findByRole("button", { name: DISMISS }))
    expect(screen.queryByTestId(BAR)).toBeNull()
    expect(useSystemNoticeStore.getState().height).toBe(0)
    const first = persisted()
    expect(first).not.toBeNull()
    expect(first).not.toContain(TEXT)

    shown.unmount()
    window.localStorage.clear()
    useSystemNoticeStore.setState({ dismissedHash: null })
    renderBanner(async () => config({ text: TEXT, level: "info" }))
    fireEvent.click(await screen.findByRole("button", { name: DISMISS }))
    expect(persisted()).toBe(first)
  })

  it("T9: after a restart the dismissed text never renders, not even on the first render", async () => {
    useSystemNoticeStore.getState().dismiss(TEXT)
    const stored = persisted()
    expect(stored).not.toBeNull()

    const seededRestart = await freshModules()
    expect(persisted()).toBe(stored)
    const seeded = newClient()
    seeded.setQueryData(queryKeys.appConfig, config({ text: TEXT, level: "info" }))
    const first = renderBanner(async () => config({ text: TEXT, level: "info" }), {
      client: seeded,
      harness: seededRestart.harness,
    })
    expect(first.container.innerHTML).toBe("")
    first.unmount()

    const fetchedRestart = await freshModules()
    const seen: boolean[] = []
    const observer = new MutationObserver(() =>
      seen.push(document.querySelector(`[data-testid="${BAR}"]`) !== null),
    )
    observer.observe(document.body, { childList: true, subtree: true })
    const fetched = renderBanner(async () => config({ text: TEXT, level: "info" }), {
      harness: fetchedRestart.harness,
    })
    seen.push(fetched.container.innerHTML !== "")
    await settled(fetched.client)
    observer.disconnect()
    expect(fetched.client.getQueryState(queryKeys.appConfig)?.status).toBe("success")
    expect(seen.every((shown) => !shown)).toBe(true)
    expect(fetched.container.innerHTML).toBe("")
  })

  it("T10: a new text shows again, on mount", async () => {
    useSystemNoticeStore.getState().dismiss(TEXT)
    renderBanner(async () => config({ text: TEXT_B, level: "info" }))
    expect(await screen.findByText(TEXT_B)).toBeTruthy()
  })

  it("T10: a new text shows again, on a refetch while mounted", async () => {
    useSystemNoticeStore.getState().dismiss(TEXT)
    let current = config({ text: TEXT, level: "info" })
    const { client, container } = renderBanner(async () => current)
    await settled(client)
    expect(container.innerHTML).toBe("")
    current = config({ text: TEXT_B, level: "info" })
    await act(async () => {
      await client.refetchQueries({ queryKey: queryKeys.appConfig })
    })
    expect(await screen.findByText(TEXT_B)).toBeTruthy()
  })

  it("T11: the same text at a different level stays hidden", async () => {
    useSystemNoticeStore.getState().dismiss(TEXT)
    const { client, container } = renderBanner(async () => config({ text: TEXT, level: "warning" }))
    await settled(client)
    expect(client.getQueryState(queryKeys.appConfig)?.status).toBe("success")
    expect(container.innerHTML).toBe("")
  })

  it("T12: blocked web storage still shows the bar and lets it close, without throwing", async () => {
    const blocked = () => {
      throw new DOMException("The operation is insecure.", "SecurityError")
    }
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked)
    const restart = await freshModules()
    renderBanner(async () => config({ text: TEXT, level: "info" }), { harness: restart.harness })
    const close = await screen.findByRole("button", { name: DISMISS })
    expect(() => fireEvent.click(close)).not.toThrow()
    expect(screen.queryByTestId(BAR)).toBeNull()
    expect(restart.store.getState().dismissedHash).not.toBeNull()
  })
})

describe("systemNoticeStore: the published height", () => {
  function measureAs(height: number) {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: height,
      width: 320,
      height,
      toJSON: () => ({}),
    })
  }

  it("T15: 36 while shown, 0 once dismissed, and never persisted", async () => {
    measureAs(36)
    renderBanner(async () => config({ text: TEXT, level: "info" }))
    await screen.findByTestId(BAR)
    expect(useSystemNoticeStore.getState().height).toBe(36)
    fireEvent.click(screen.getByRole("button", { name: DISMISS }))
    expect(useSystemNoticeStore.getState().height).toBe(0)
    const saved = JSON.parse(persisted() ?? "{}") as { state?: Record<string, unknown> }
    expect(Object.keys(saved.state ?? {})).toEqual(["dismissedHash"])
  })

  it("T15: 36 while shown, 0 once the announcement is cleared", async () => {
    measureAs(36)
    let current = config({ text: TEXT, level: "info" })
    const { client } = renderBanner(async () => current)
    await screen.findByTestId(BAR)
    expect(useSystemNoticeStore.getState().height).toBe(36)
    current = config(null)
    await act(async () => {
      await client.refetchQueries({ queryKey: queryKeys.appConfig })
    })
    await waitFor(() => expect(screen.queryByTestId(BAR)).toBeNull())
    expect(useSystemNoticeStore.getState().height).toBe(0)
    const saved = persisted()
    if (saved !== null)
      expect(Object.keys((JSON.parse(saved) as { state: object }).state)).not.toContain("height")
  })

  it("T16: the download banner's dismiss leaves the notice height alone", () => {
    useSystemNoticeStore.getState().setHeight(36)
    useAppPromoStore.getState().setBannerHeight(64)
    useAppPromoStore.getState().dismiss()
    expect(useSystemNoticeStore.getState().height).toBe(36)
  })

  it("T16: the notice's dismiss leaves the download banner alone", () => {
    useSystemNoticeStore.getState().setHeight(36)
    useAppPromoStore.getState().setBannerHeight(64)
    useSystemNoticeStore.getState().dismiss(TEXT)
    expect(useAppPromoStore.getState().bannerHeight).toBe(64)
    expect(useAppPromoStore.getState().dismissed).toBe(false)
  })
})
