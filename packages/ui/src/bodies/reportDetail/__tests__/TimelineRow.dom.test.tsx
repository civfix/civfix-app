import { describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import type * as ReactNative from "react-native"
import {
  CapabilitiesProvider,
  makeFakeCapabilities,
  type PlatformCapabilities,
} from "../../../capabilities"
import { I18nProvider } from "../../../i18n"
import { ToastContext } from "../../../primitives/toastContext"
import { TimelineRow } from "../TimelineRow"
import type { TimelineNode } from "../timelineModel"

// The icon set pulls in native-only modules; the row is read by its text and roles.
vi.mock("../../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})

const CHECK_STATUS = "Check status on the city site"
const CHECK_STATUS_A11Y = "Open this request on the city site"
const OPEN_ERROR = "Couldn't open the city site. Try again."
const CASE_URL = "https://myla311.lacity.gov/s/"

const FILED_WITH_CASE: TimelineNode = {
  key: "intake",
  kind: "forwarded",
  when: "Oct 2",
  text: "Filed with City of Los Angeles",
  caseId: "1-2345678901",
}

function renderRow(
  node: TimelineNode,
  capabilities: PlatformCapabilities = makeFakeCapabilities(),
) {
  const toast = { show: vi.fn() }
  render(
    <CapabilitiesProvider value={capabilities}>
      <I18nProvider locale="en">
        <ToastContext.Provider value={toast}>
          <TimelineRow node={node} last />
        </ToastContext.Provider>
      </I18nProvider>
    </CapabilitiesProvider>,
  )
  return { toast }
}

function withOpen(open: (url: string) => Promise<void>): PlatformCapabilities {
  return { ...makeFakeCapabilities(), openExternal: { open: vi.fn(open) } }
}

async function press(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

describe("TimelineRow filed node on web", () => {
  it("T15: shows the request number without a link or a pending button", () => {
    renderRow(FILED_WITH_CASE)
    expect(screen.getByText("Filed with City of Los Angeles")).toBeTruthy()
    expect(screen.getByText("Request 1-2345678901")).toBeTruthy()
    expect(screen.queryByText(CHECK_STATUS)).toBeNull()
    expect(screen.queryByRole("link", { name: CHECK_STATUS_A11Y })).toBeNull()
    expect(screen.queryByRole("button", { name: "Why is this pending?" })).toBeNull()
  })

  it("T16: opens the case link through openExternal", async () => {
    const capabilities = withOpen(() => Promise.resolve())
    const { toast } = renderRow({ ...FILED_WITH_CASE, caseUrl: CASE_URL }, capabilities)
    const link = screen.getByRole("link", { name: CHECK_STATUS_A11Y })
    expect(link.textContent).toBe(CHECK_STATUS)
    await press(link)
    expect(capabilities.openExternal!.open).toHaveBeenCalledTimes(1)
    expect(capabilities.openExternal!.open).toHaveBeenCalledWith(CASE_URL)
    expect(toast.show).not.toHaveBeenCalled()
  })

  it("T17: shows an error toast when the open fails", async () => {
    const capabilities = withOpen(() => Promise.reject(new Error("no browser")))
    const { toast } = renderRow({ ...FILED_WITH_CASE, caseUrl: CASE_URL }, capabilities)
    await press(screen.getByRole("link", { name: CHECK_STATUS_A11Y }))
    expect(toast.show).toHaveBeenCalledWith(OPEN_ERROR, { variant: "error" })
  })

  it("T18: shows an error toast when the host has no openExternal", async () => {
    const { openExternal: _omitted, ...capabilities } = makeFakeCapabilities()
    const { toast } = renderRow({ ...FILED_WITH_CASE, caseUrl: CASE_URL }, capabilities)
    await press(screen.getByRole("link", { name: CHECK_STATUS_A11Y }))
    expect(toast.show).toHaveBeenCalledWith(OPEN_ERROR, { variant: "error" })
  })

  it("T19: shows neither a request line nor a link without a case", () => {
    renderRow({ key: "intake", kind: "forwarded", when: "Oct 2", text: "Filed with the city" })
    expect(screen.getByText("Filed with the city")).toBeTruthy()
    expect(screen.queryByText(/^Request/)).toBeNull()
    expect(screen.queryByText(CHECK_STATUS)).toBeNull()
    expect(screen.queryByRole("link", { name: CHECK_STATUS_A11Y })).toBeNull()
  })
})
