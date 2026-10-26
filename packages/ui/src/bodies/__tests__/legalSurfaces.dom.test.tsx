import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type * as ReactNative from "react-native"
import type { ApiClient } from "@civfix/contract/client"
import { CapabilitiesProvider, makeFakeCapabilities } from "../../capabilities"
import { ApiProvider } from "../../data/context"
import { makeFakeDataContext } from "../../data/fakes"
import { I18nProvider } from "../../i18n"
import { setLegalDocumentPresenter } from "../../primitives/legalDocument"
import { setWebOrigin, WEB_ORIGIN } from "../../primitives/externalUrls"
import { BrandAboutCard } from "../../primitives/BrandAboutCard"
import { TermsConfirmation } from "../../primitives/TermsConfirmation"
import { ConsentChecks } from "../host/registration/ConsentChecks"

vi.mock("../../typography", async () => {
  const RN = await vi.importActual<typeof ReactNative>("react-native")
  function TextLink({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
    return (
      <RN.Text accessibilityRole="link" onPress={onPress}>
        {children}
      </RN.Text>
    )
  }
  return { Text: RN.Text, TextLink, Icon: () => null, iconMap: new Proxy({}, { get: () => "icon" }) }
})

vi.mock("react-native-safe-area-context", async () => {
  const { createContext } = await import("react")
  const insets = { top: 0, right: 0, bottom: 0, left: 0 }
  return { SafeAreaInsetsContext: createContext(insets), useSafeAreaInsets: () => insets }
})

const open = vi.fn(async (_url: string) => {})
const present = vi.fn()

function mount(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const context = makeFakeDataContext({
    api: { getLegalDocuments: () => new Promise(() => {}) } as unknown as ApiClient,
  })
  const capabilities = { ...makeFakeCapabilities(), openExternal: { open } }
  render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>
        <CapabilitiesProvider value={capabilities}>
          <I18nProvider locale="en">{children}</I18nProvider>
        </CapabilitiesProvider>
      </ApiProvider>
    </QueryClientProvider>,
  )
}

const CONSENT = { terms: false, hostContactOptIn: false, smsOptIn: false }

const SURFACES: { name: string; element: () => React.ReactElement; terms: string; privacy: string }[] = [
  {
    name: "the About card",
    element: () => <BrandAboutCard onClose={() => {}} />,
    terms: "Terms of Service",
    privacy: "Privacy Policy",
  },
  {
    name: "TermsConfirmation",
    element: () => <TermsConfirmation confirmed={false} onConfirmedChange={() => {}} />,
    terms: "Terms of Service",
    privacy: "Privacy Policy",
  },
  {
    name: "ConsentChecks",
    element: () => <ConsentChecks value={CONSENT} onChange={() => {}} termsVersion={null} />,
    terms: "Terms",
    privacy: "Privacy Policy",
  },
]

beforeEach(() => {
  open.mockClear()
  present.mockClear()
})

afterEach(() => {
  setLegalDocumentPresenter(null)
})

describe("legal links in the phone app", () => {
  beforeEach(() => {
    setLegalDocumentPresenter(present)
  })

  it.each(SURFACES)("T18: $name opens Terms and Privacy in the app", ({ element, terms, privacy }) => {
    mount(element())
    fireEvent.click(screen.getByRole("link", { name: terms }))
    expect(present).toHaveBeenLastCalledWith("terms")
    fireEvent.click(screen.getByRole("link", { name: privacy }))
    expect(present).toHaveBeenLastCalledWith("privacy")
    expect(open).not.toHaveBeenCalled()
  })
})

describe("legal links on the web", () => {
  it.each(SURFACES)("T19: $name opens the same Terms page as before", ({ element, terms }) => {
    mount(element())
    fireEvent.click(screen.getByRole("link", { name: terms }))
    expect(open).toHaveBeenCalledWith("https://civfix.org/legal/terms")
    expect(present).not.toHaveBeenCalled()
  })

  describe("on a site other than civfix.org", () => {
    const assign = vi.fn()

    beforeEach(() => {
      assign.mockClear()
      vi.stubGlobal("location", { origin: "http://localhost:3101", assign })
      setWebOrigin("http://localhost:3101")
    })

    afterEach(() => {
      setWebOrigin(WEB_ORIGIN)
      vi.unstubAllGlobals()
    })

    it.each(SURFACES)("T36: $name opens that site's Terms page in a new tab", ({ element, terms }) => {
      mount(element())
      fireEvent.click(screen.getByRole("link", { name: terms }))
      expect(open).toHaveBeenCalledWith("http://localhost:3101/legal/terms")
      expect(assign).not.toHaveBeenCalled()
    })
  })
})
