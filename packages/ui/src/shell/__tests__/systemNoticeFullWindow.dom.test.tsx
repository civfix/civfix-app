/**
 * Below the phone's notice the screens read a top inset of 0. Two kinds of layout must not take that at face
 * value: a surface that covers the whole window (an RN Modal) reads the device's real insets again, and a
 * layout sized from the window height (the sheet detents) budgets the window less what the notice took.
 */
import * as React from "react"
import { act, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type * as ReactNative from "react-native"
import type { EdgeInsets } from "react-native-safe-area-context"
import type { AppConfigResponse } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"

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

// react-native-web reports onLayout through a ResizeObserver that measures the node; this one reports every
// observed node at once, and the bar measures as BAR_HEIGHT.
const BAR_HEIGHT = 60
class ReportingResizeObserver {
  constructor(private readonly callback: (entries: { target: Element }[]) => void) {}
  observe(target: Element) {
    queueMicrotask(() => this.callback([{ target }]))
  }
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", ReportingResizeObserver)
})

afterEach(() => {
  vi.restoreAllMocks()
})

const { Dimensions, Text, View } = await import("react-native")
const { SafeAreaInsetsContext, useSafeAreaInsets } = await import("react-native-safe-area-context")
const { SystemNoticeFrame } = await import("../SystemNoticeFrame")
const { useShellWindowHeight } = await import("../systemNoticeFrameContext")
const { FullWindowModal } = await import("../../primitives/FullWindowModal")
const { MediaLightboxBase } = await import("../../lightbox/MediaLightboxBase")
const { lightboxControlOffsets } = await import("../../lightbox/lightboxStage")
const { sheetSnapPoints } = await import("../tabBarLogic")
const { ApiProvider } = await import("../../data/context")
const { makeFakeDataContext } = await import("../../data/fakes")
const { I18nProvider } = await import("../../i18n")
const { ThemeProvider, space } = await import("../../theme")
const { useSystemNoticeStore } = await import("../systemNoticeStore")

const TEXT = "Water service paused on Main St tonight"
const STATUS_BAR: EdgeInsets = { top: 24, right: 0, bottom: 34, left: 0 }

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

function Probe({ id }: { id: string }) {
  const insets = useSafeAreaInsets()
  const height = useShellWindowHeight()
  return (
    <View>
      <Text testID={`${id}-top`}>{String(insets.top)}</Text>
      <Text testID={`${id}-height`}>{String(height)}</Text>
    </View>
  )
}

function renderRoot(announcement: string | null, children: React.ReactNode) {
  useSystemNoticeStore.setState({ dismissedHash: null, height: 0 })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const context = makeFakeDataContext({
    api: { getAppConfig: async () => config(announcement) } as unknown as ApiClient,
  })
  return render(
    <QueryClientProvider client={client}>
      <ApiProvider value={context}>
        <I18nProvider locale="en" setLocale={() => {}}>
          <ThemeProvider preference="light">
            <SafeAreaInsetsContext.Provider value={STATUS_BAR}>
              <SystemNoticeFrame>{children}</SystemNoticeFrame>
            </SafeAreaInsetsContext.Provider>
          </ThemeProvider>
        </I18nProvider>
      </ApiProvider>
    </QueryClientProvider>,
  )
}

// react-native-web's onLayout measures the node's offset box.
function measureBar() {
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.getAttribute("data-testid") === "system-notice" ? BAR_HEIGHT : 0
  })
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

describe("a full-window surface opened below the notice", () => {
  it("reads the device's status bar inset inside an RN Modal, while the screens beside it read 0", async () => {
    renderRoot(
      TEXT,
      <>
        <Probe id="screen" />
        <FullWindowModal visible transparent statusBarTranslucent>
          <Probe id="modal" />
        </FullWindowModal>
      </>,
    )
    await screen.findByText(TEXT)
    expect(screen.getByTestId("screen-top").textContent).toBe("0")
    expect(screen.getByTestId("modal-top").textContent).toBe("24")
  })

  it("places the lightbox's close button below the status bar, as without a notice", async () => {
    renderRoot(
      TEXT,
      <MediaLightboxBase
        visible
        items={[]}
        index={0}
        onIndexChange={() => {}}
        onClose={() => {}}
      />,
    )
    await screen.findByText(TEXT)
    const close = screen.getByRole("button", { name: "Close" })
    expect(getComputedStyle(close).top).toBe(`${lightboxControlOffsets(STATUS_BAR).close.top}px`)
  })
})

describe("a layout sized from the window, below the notice", () => {
  it("budgets the window less the bar's measured height, and a modal gets the full window back", async () => {
    measureBar()
    const windowHeight = Dimensions.get("window").height
    renderRoot(
      TEXT,
      <>
        <Probe id="screen" />
        <FullWindowModal visible transparent>
          <Probe id="modal" />
        </FullWindowModal>
      </>,
    )
    await screen.findByText(TEXT)
    await settle()
    expect(screen.getByTestId("screen-height").textContent).toBe(String(windowHeight - BAR_HEIGHT))
    expect(screen.getByTestId("modal-height").textContent).toBe(String(windowHeight))
  })

  it("uses the full window when no notice shows", async () => {
    measureBar()
    renderRoot(null, <Probe id="screen" />)
    await settle()
    expect(screen.getByTestId("screen-height").textContent).toBe(
      String(Dimensions.get("window").height),
    )
    expect(screen.getByTestId("screen-top").textContent).toBe("24")
  })

  it("keeps the full sheet detent's headroom below the notice, as it keeps it below the status bar without one", () => {
    const reserve = space["8"]
    const window = 844
    const without = sheetSnapPoints(window, STATUS_BAR.top + reserve)
    expect(window - without[2] - STATUS_BAR.top).toBeGreaterThanOrEqual(reserve)

    const container = window - BAR_HEIGHT
    const under = sheetSnapPoints(container, 0 + reserve)
    expect(container - under[2]).toBeGreaterThanOrEqual(reserve)
  })
})
