import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type * as ReactNative from "react-native"
import { CapabilitiesProvider, makeFakeCapabilities } from "../../capabilities"
import { ApiProvider } from "../../data/context"
import { makeFakeDataContext } from "../../data/fakes"
import { I18nProvider } from "../../i18n"
import { setLegalDocumentPresenter } from "../../primitives/legalDocument"
import { SettingsBody } from "../SettingsBody"

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
    useToast: () => ({ show: () => {} }),
  }
})

const open = vi.fn(async (_url: string) => {})
const present = vi.fn()

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
})

afterEach(() => {
  setLegalDocumentPresenter(null)
})

describe("Settings legal rows", () => {
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

  it("T19: on web the Terms row opens the same page as before", () => {
    mount()
    fireEvent.click(screen.getByText("Terms of service"))
    expect(open).toHaveBeenCalledWith("https://civfix.org/legal/terms")
    expect(present).not.toHaveBeenCalled()
  })
})
