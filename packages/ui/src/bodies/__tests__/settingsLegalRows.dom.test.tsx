import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type * as ReactNative from "react-native"
import type { LegalDocumentType } from "@civfix/contract"
import { CapabilitiesProvider, makeFakeCapabilities } from "../../capabilities"
import { ApiProvider } from "../../data/context"
import { makeFakeDataContext } from "../../data/fakes"
import { I18nProvider } from "../../i18n"
import { setLegalDocumentPresenter } from "../../primitives/legalDocument"
import type * as LegalDocumentNav from "../../primitives/legalDocumentNav"
import { SettingsBody } from "../SettingsBody"

const platform = vi.hoisted(() => ({ current: "web" as "web" | "native" }))
const toastShow = vi.hoisted(() => vi.fn())

vi.mock("../../typography", async () => {
  const RN = await vi.importActual<typeof ReactNative>("react-native")
  return { Text: RN.Text, Icon: () => null, iconMap: new Proxy({}, { get: () => "icon" }) }
})

// The barrel reaches native-only modules; the body's own wiring is what is under test, so the rows are
// plain pressable labels and every non-UI export is the real one.
vi.mock("../../primitives", async () => {
  const RN = await vi.importActual<typeof ReactNative>("react-native")
  function SettingsRow({ label, onPress }: { label: string; onPress?: () => void }) {
    return (
      <RN.Pressable accessibilityRole="button" onPress={onPress}>
        <RN.Text>{label}</RN.Text>
      </RN.Pressable>
    )
  }
  function SettingsSection({ label, children }: { label?: string; children: React.ReactNode }) {
    return (
      <RN.View>
        {label ? <RN.Text>{label}</RN.Text> : null}
        {children}
      </RN.View>
    )
  }
  return {
    ...(await vi.importActual("../../primitives/externalUrls")),
    ...(await vi.importActual("../../primitives/legalDocument")),
    SettingsRow,
    SettingsSection,
    SignInPrompt: () => null,
    useToast: () => ({ show: toastShow }),
  }
})

// The web bundle resolves legalDocumentNav.web and the phone app's legalDocumentNav.native; each describe
// below runs the rows against the one its platform loads.
vi.mock("../../primitives/legalDocumentNav", async () => {
  const web = await vi.importActual<typeof LegalDocumentNav>("../../primitives/legalDocumentNav.web")
  const native = await vi.importActual<typeof LegalDocumentNav>("../../primitives/legalDocumentNav.native")
  return {
    openLegalDocumentInPlace: (type: LegalDocumentType) =>
      (platform.current === "native" ? native : web).openLegalDocumentInPlace(type),
  }
})

const open = vi.fn(async (_url: string) => {})
const present = vi.fn()
const assign = vi.fn()

const ROWS = [
  ["Terms of service", "terms"],
  ["Privacy policy", "privacy"],
  ["Cookies & storage", "cookies"],
  ["Sub-processors", "subprocessors"],
] as const

function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const capabilities = { ...makeFakeCapabilities(), openExternal: { open } }
  render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={makeFakeDataContext()}>
        <CapabilitiesProvider value={capabilities}>
          <I18nProvider locale="en">
            <SettingsBody />
          </I18nProvider>
        </CapabilitiesProvider>
      </ApiProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  open.mockClear()
  present.mockClear()
  assign.mockClear()
  toastShow.mockClear()
  vi.stubGlobal("location", { origin: "https://civfix.test", assign })
})

afterEach(() => {
  setLegalDocumentPresenter(null)
  vi.unstubAllGlobals()
})

describe("Settings legal rows on the phone", () => {
  beforeEach(() => {
    platform.current = "native"
  })

  afterEach(() => {
    platform.current = "web"
  })

  it("T17: lists all four documents under Privacy, each opening the in-app screen on native", () => {
    setLegalDocumentPresenter(present)
    mount()
    const rows = Array.from(document.querySelectorAll('[role="button"]')).map((row) => row.textContent)
    const privacy = rows.indexOf("Privacy policy")
    expect(rows.slice(privacy - 1, privacy + 3)).toEqual(ROWS.map(([label]) => label))
    for (const [label, type] of ROWS) {
      present.mockClear()
      fireEvent.click(screen.getByText(label))
      expect(present).toHaveBeenCalledWith(type)
    }
    expect(open).not.toHaveBeenCalled()
  })

  it("T34: each row presents its document in the app, and neither opens a browser nor leaves the page", () => {
    setLegalDocumentPresenter(present)
    mount()
    for (const [label] of ROWS) fireEvent.click(screen.getByText(label))
    expect(present.mock.calls).toEqual(ROWS.map(([, type]) => [type]))
    expect(open).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
  })
})

describe("Settings legal rows on the web", () => {
  it("T33: each row opens the site's own page in the same tab", () => {
    mount()
    for (const [label, type] of ROWS) {
      assign.mockClear()
      fireEvent.click(screen.getByText(label))
      expect(assign.mock.calls).toEqual([[`/legal/${type}/`]])
    }
    expect(open).not.toHaveBeenCalled()
    expect(toastShow).not.toHaveBeenCalled()
  })
})
