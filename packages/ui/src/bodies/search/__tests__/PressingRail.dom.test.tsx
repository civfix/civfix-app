import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type * as ReactNative from "react-native"
import type { ReportPinDTO } from "@civfix/contract"
import { I18nProvider } from "../../../i18n"
import { useNavStore } from "../../../nav"
import { PressingRail } from "../PressingRail"

// The icon set pulls in native-only modules; the cards are read by their text.
vi.mock("../../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})
vi.mock("../../../primitives", () => ({ CATEGORY_ICONS: {}, MetaDot: () => null }))
// RN-web's Image paints its source only once the bytes load, which jsdom never does.
vi.mock("react-native", async () => {
  const actual = await vi.importActual<typeof ReactNative>("react-native")
  return { ...actual, Image: ({ source }: { source: { uri: string } }) => <img src={source.uri} alt="" /> }
})

const THUMB = "https://media.example/thumb-r1.webp"

const reports: ReportPinDTO[] = [
  {
    id: "r1",
    category: "trash",
    status: "published",
    lat: 34.05,
    lng: -118.24,
    confirmCount: 3,
    title: "Overflowing bin",
    thumbUrl: THUMB,
  },
  { id: "r2", category: "graffiti", status: "published", lat: 34.06, lng: -118.25, confirmCount: 1, title: "Tagged wall" },
]

// The rail sizes its cards from its measured width, which jsdom never lays out: report a phone-wide rail.
class LaidOutResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element) {
    queueMicrotask(() => this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver))
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", LaidOutResizeObserver)
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(390)
  useNavStore.getState().reset()
  useNavStore.getState().selectView("search")
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderRail() {
  return render(
    <I18nProvider locale="en">
      <PressingRail reports={reports} viewer={null} />
    </I18nProvider>,
  )
}

describe("PressingRail", () => {
  it("shows each report's title, category, thumbnail and Me too count, in the order given", async () => {
    const { container } = renderRail()
    await waitFor(() => expect(screen.getByText("Overflowing bin")).toBeTruthy())
    const text = container.textContent ?? ""
    expect(text.indexOf("Overflowing bin")).toBeLessThan(text.indexOf("Tagged wall"))
    expect(screen.getByText("3 neighbors saw this too")).toBeTruthy()
    expect(screen.getByText("1 neighbor saw this too")).toBeTruthy()
    expect(screen.getByText("Trash")).toBeTruthy()
    expect(screen.getByText("Graffiti")).toBeTruthy()
    expect(Array.from(container.querySelectorAll("img"), (img) => img.getAttribute("src"))).toEqual([THUMB])
  })

  it("opens the tapped report's page", async () => {
    renderRail()
    const card = await screen.findByRole("button", { name: "Tagged wall, 1 neighbor saw this too" })
    fireEvent.click(card)
    const { stack } = useNavStore.getState()
    expect(stack[stack.length - 1]).toEqual({ kind: "pin", id: "r2", lat: 34.06, lng: -118.25 })
  })
})
