/**
 * The two fixed bars at the top of the web app: the system notice on top, the app download banner under it.
 * The shared notice renders for real (react-native-web); the promo decision is stubbed to "show the banner".
 */
import * as React from "react"
import { act, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AppConfigResponse } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"

vi.mock("react-native", async () => {
  // @ts-expect-error react-native-web ships no type declarations; webpack aliases it for the real build
  const rnw: unknown = await import("react-native-web")
  return rnw as Record<string, unknown>
})

vi.mock("../../../../../packages/ui/src/typography", async () => {
  // @ts-expect-error react-native-web ships no type declarations
  const { Text } = (await import("react-native-web")) as { Text: React.ComponentType }
  return { Text, Icon: () => null, iconMap: {} }
})

vi.mock("@civfix/ui", async () => {
  const [banner, notice, promo] = await Promise.all([
    import("../../../../../packages/ui/src/shell/SystemNoticeBanner"),
    import("../../../../../packages/ui/src/shell/systemNoticeStore"),
    import("../../../../../packages/ui/src/promo/appPromoStore"),
  ])
  return {
    SystemNoticeBanner: banner.SystemNoticeBanner,
    useSystemNoticeStore: notice.useSystemNoticeStore,
    useAppPromoStore: promo.useAppPromoStore,
    useAppPromo: () => ({
      surface: "banner",
      links: [
        {
          store: "google-play",
          href: "https://play.google.com/store",
          labelKey: "app_promo.google_play",
          badgeSrc: "/badge.svg",
        },
      ],
      dismiss: () => promo.useAppPromoStore.getState().dismiss(),
    }),
  }
})

const { ApiProvider } = await import("../../../../../packages/ui/src/data/context")
const { makeFakeDataContext } = await import("../../../../../packages/ui/src/data/fakes")
const { I18nProvider } = await import("../../../../../packages/ui/src/i18n")
const { ThemeProvider } = await import("../../../../../packages/ui/src/theme")
const { useSystemNoticeStore } =
  await import("../../../../../packages/ui/src/shell/systemNoticeStore")
const { useAppPromoStore } = await import("../../../../../packages/ui/src/promo/appPromoStore")
const { AppDownloadBanner } = await import("@/components/promo/app-download-banner")
const { WebSystemNoticeBanner } = await import("./system-notice-banner")
const { Z_APP_BANNER } = await import("@/styles/z-layers")

const TEXT = "Water service paused on Main St tonight"

function config(text: string | null): AppConfigResponse {
  return {
    minAppVersion: { ios: null, android: null },
    storeUrl: {
      ios: null,
      android: "https://play.google.com/store/apps/details?id=org.civfix.community",
    },
    announcement: text === null ? null : { text, level: "info" },
  }
}

function downloadBanner(): HTMLElement {
  return screen.getByRole("complementary")
}

function renderBars() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const context = makeFakeDataContext({
    api: { getAppConfig: async () => config(TEXT) } as unknown as ApiClient,
  })
  return render(
    <QueryClientProvider client={client}>
      <ApiProvider value={context}>
        <I18nProvider locale="en" setLocale={() => {}}>
          <ThemeProvider preference="light">
            <WebSystemNoticeBanner />
            <AppDownloadBanner />
          </ThemeProvider>
        </I18nProvider>
      </ApiProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  useSystemNoticeStore.setState({ dismissedHash: null, height: 0 })
  useAppPromoStore.setState({ dismissed: false, bannerHeight: 0, cardHeight: 0 })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("AppDownloadBanner under the system notice", () => {
  it("T17: sits below a 36px notice, which owns the safe-area inset; alone it is at the top as before", () => {
    act(() => {
      useSystemNoticeStore.setState({ height: 36 })
    })
    const { unmount } = render(
      <I18nProvider locale="en" setLocale={() => {}}>
        <AppDownloadBanner />
      </I18nProvider>,
    )
    let style = getComputedStyle(downloadBanner())
    expect(style.top).toBe("36px")
    expect(style.paddingTop).toBe("8px")

    act(() => {
      useSystemNoticeStore.setState({ height: 0 })
    })
    style = getComputedStyle(downloadBanner())
    expect(style.top).toBe("0px")
    expect(style.paddingTop).toBe("calc(8px + env(safe-area-inset-top, 0px))")
    unmount()
  })
})

describe("the system notice on web", () => {
  it("T18: is the topmost fixed bar, padded for the notch, at the download banner's layer or above", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 390,
      bottom: 36,
      width: 390,
      height: 36,
      toJSON: () => ({}),
    })
    renderBars()
    const bar = await screen.findByTestId("system-notice")
    const style = getComputedStyle(bar)
    expect(style.position).toBe("fixed")
    expect(style.top).toBe("0px")
    expect(style.paddingTop).toContain("env(safe-area-inset-top, 0px)")
    expect(Number(style.zIndex)).toBeGreaterThanOrEqual(Z_APP_BANNER)

    // Above the download banner: first in the page, and the banner starts where the notice ends.
    const banner = downloadBanner()
    expect(bar.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(getComputedStyle(banner).top).toBe("36px")
  })
})
