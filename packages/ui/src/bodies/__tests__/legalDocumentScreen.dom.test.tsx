import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type * as ReactNative from "react-native"
import type { ApiClient } from "@civfix/contract/client"
import { CapabilitiesProvider, makeFakeCapabilities } from "../../capabilities"
import { ApiProvider } from "../../data/context"
import { makeFakeDataContext } from "../../data/fakes"
import { I18nProvider } from "../../i18n"
import { legalDocumentTypeOf } from "../../primitives/legalDocument"
import { CURRENT_DOCUMENTS } from "../../primitives/__tests__/legalDocumentFixtures"
import { LegalDocumentScreen } from "../LegalDocumentScreen"

vi.mock("../../typography", async () => {
  const RN = await vi.importActual<typeof ReactNative>("react-native")
  return { Text: RN.Text, Icon: () => null, iconMap: new Proxy({}, { get: () => "icon" }) }
})

vi.mock("react-native-safe-area-context", async () => {
  const { createContext } = await import("react")
  const insets = { top: 0, right: 0, bottom: 0, left: 0 }
  return { SafeAreaInsetsContext: createContext(insets), useSafeAreaInsets: () => insets }
})

function showTerms(getLegalDocuments: () => Promise<unknown>) {
  const onBack = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const context = makeFakeDataContext({ api: { getLegalDocuments } as unknown as ApiClient })
  render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>
        <CapabilitiesProvider value={makeFakeCapabilities()}>
          <I18nProvider locale="en">
            <LegalDocumentScreen type="terms" onBack={onBack} />
          </I18nProvider>
        </CapabilitiesProvider>
      </ApiProvider>
    </QueryClientProvider>,
  )
  return { onBack }
}

describe("the phone app's legal screen", () => {
  it("T15: renders the Terms with a back control", async () => {
    const { onBack } = showTerms(async () => ({ documents: CURRENT_DOCUMENTS }))
    expect(await screen.findByText("Terms of Service")).toBeTruthy()
    expect(screen.getByText("1. About the Terms of Service")).toBeTruthy()
    expect(screen.queryByText("Privacy Policy")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("T15: shows a spinner while the documents load", () => {
    showTerms(() => new Promise(() => {}))
    expect(screen.getByRole("progressbar")).toBeTruthy()
    expect(screen.queryByText("Terms of Service")).toBeNull()
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy()
  })

  it("T15: shows the error and a retry that fetches again", async () => {
    const getLegalDocuments = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue({ documents: CURRENT_DOCUMENTS })
    showTerms(getLegalDocuments)
    expect(await screen.findByText("Couldn't load this document")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("Terms of Service")).toBeTruthy()
    await waitFor(() => expect(getLegalDocuments).toHaveBeenCalledTimes(2))
  })

  it("T16: a route segment that names no document has no type, so the route shows its not-found screen", () => {
    expect(legalDocumentTypeOf("nope")).toBeNull()
    expect(legalDocumentTypeOf(undefined)).toBeNull()
    expect(legalDocumentTypeOf(["terms"])).toBeNull()
    expect(legalDocumentTypeOf("terms")).toBe("terms")
    expect(legalDocumentTypeOf("subprocessors")).toBe("subprocessors")
  })
})
