import * as React from "react"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { AppError, ErrorCode, type LegalDocumentDTO } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"

import { ApiProvider, type DataContextValue } from "../../../../../packages/ui/src/data"
import { CapabilitiesProvider, makeFakeCapabilities } from "../../../../../packages/ui/src/capabilities"
import { I18nProvider } from "../../../../../packages/ui/src/i18n"
import {
  CURRENT_DOCUMENTS,
  CURRENT_VERSION,
  legalDoc,
} from "../../../../../packages/ui/src/primitives/__tests__/legalDocumentFixtures"

vi.mock("react-native", async () => {
  // @ts-expect-error react-native-web ships no type declarations; webpack aliases it for the real build
  const rnw: unknown = await import("react-native-web")
  return rnw as Record<string, unknown>
})

vi.mock("lucide-react-native/icons", () => {
  const Glyph = () => null
  return new Proxy({}, { has: () => true, get: (_target, key) => (key === "then" ? undefined : Glyph) })
})

vi.mock("@civfix/ui", async () => ({
  LegalDocumentBody: (await import("../../../../../packages/ui/src/bodies/LegalDocumentBody")).LegalDocumentBody,
}))

const { default: TermsPage } = await import("@/app/legal/terms/page")
const { default: PrivacyPage } = await import("@/app/legal/privacy/page")
const { default: CookiesPage } = await import("@/app/legal/cookies/page")
const { default: SubprocessorsPage } = await import("@/app/legal/subprocessors/page")

const PAGES = [
  { type: "terms", Page: TermsPage, title: "Terms of Service" },
  { type: "privacy", Page: PrivacyPage, title: "Privacy Policy" },
  { type: "cookies", Page: CookiesPage, title: "Cookies & Storage" },
  { type: "subprocessors", Page: SubprocessorsPage, title: "Sub-processors" },
] as const

const assign = vi.fn()

function at(path: string) {
  const url = new URL(path, "https://civfix.test")
  vi.stubGlobal("location", {
    origin: url.origin,
    href: url.href,
    pathname: url.pathname,
    search: url.search,
    hash: "",
    assign,
  })
}

function mount(
  Page: React.ComponentType,
  api: { getLegalDocuments?: () => Promise<unknown>; getLegalDocument?: (body: unknown) => Promise<unknown> },
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const context = {
    api: api as unknown as ApiClient,
    useAuthState: () => ({ isAuthenticated: false, isPending: false, user: null }),
    requireAuth: (action: () => void) => action(),
    logout: async () => {},
  } as unknown as DataContextValue
  render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>
        <CapabilitiesProvider value={makeFakeCapabilities()}>
          <I18nProvider locale="en">
            <Page />
          </I18nProvider>
        </CapabilitiesProvider>
      </ApiProvider>
    </QueryClientProvider>,
  )
}

const current = async () => ({ documents: CURRENT_DOCUMENTS })
const withCurrentPrivacy = (privacy: LegalDocumentDTO) => async () => ({
  documents: CURRENT_DOCUMENTS.map((document) => (document.type === "privacy" ? privacy : document)),
})

// The page loads the document view on demand; loading its module graph once up front keeps that first
// load out of each test's wait for the page to settle.
beforeAll(async () => {
  await import("./legal-document")
}, 60_000)

afterEach(() => {
  cleanup()
  assign.mockClear()
  vi.unstubAllGlobals()
})

describe("/legal/terms", () => {
  it("T21: shows a loading state and no document text while the documents load", async () => {
    at("/legal/terms/")
    mount(TermsPage, { getLegalDocuments: () => new Promise(() => {}) })
    expect(await screen.findByRole("progressbar")).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "Terms of Service" })).toBeNull()
    expect(screen.queryByText("1. About the Terms of Service")).toBeNull()
  })

  it("T22: shows the error and a Retry that fetches again and then renders the document", async () => {
    at("/legal/terms/")
    const getLegalDocuments = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue({ documents: CURRENT_DOCUMENTS })
    mount(TermsPage, { getLegalDocuments })
    expect(await screen.findByText("Couldn't load this document")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByRole("heading", { name: "Terms of Service" })).toBeTruthy()
    expect(getLegalDocuments).toHaveBeenCalledTimes(2)
  })

  it("T28: a current document with no text is the same error state", async () => {
    at("/legal/terms/")
    mount(TermsPage, {
      getLegalDocuments: async () => ({
        documents: CURRENT_DOCUMENTS.map((document) =>
          document.type === "terms" ? { ...document, blocks: null } : document,
        ),
      }),
    })
    expect(await screen.findByText("Couldn't load this document")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy()
  })
})

describe("/legal/<type>", () => {
  it.each(PAGES)("T23: /legal/$type renders its current version and marks itself in the nav", async ({ type, Page, title }) => {
    at(`/legal/${type}/`)
    mount(Page, { getLegalDocuments: current })
    expect(await screen.findByRole("heading", { name: title })).toBeTruthy()
    expect(screen.getByText(`1. About the ${title}`)).toBeTruthy()
    expect(screen.queryByText(/This is an earlier version/)).toBeNull()
    const nav = screen.getAllByRole("navigation", { name: "Legal documents" })[0]!
    const links = within(nav).getAllByRole("link")
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/legal/terms",
      "/legal/privacy",
      "/legal/cookies",
      "/legal/subprocessors",
    ])
    expect(links.filter((link) => link.getAttribute("aria-current") === "page").map((link) => link.getAttribute("href"))).toEqual([
      `/legal/${type}`,
    ])
  })
})

describe("/legal/privacy?version=", () => {
  it("T24: renders the earlier version it names, saying so", async () => {
    at("/legal/privacy/?version=2026-10-01")
    const getLegalDocument = vi.fn(async () => ({ document: legalDoc("privacy", "2026-10-01") }))
    mount(PrivacyPage, { getLegalDocuments: current, getLegalDocument })
    expect(await screen.findByText("This is an earlier version, from October 1, 2026.")).toBeTruthy()
    expect(screen.getByText("Version 2026-10-01 · effective October 1, 2026")).toBeTruthy()
    expect(getLegalDocument).toHaveBeenCalledWith({ type: "privacy", version: "2026-10-01" })
  })

  it("T25: an earlier version with no text links to the current one", async () => {
    at("/legal/privacy/?version=2026-09-21")
    mount(PrivacyPage, {
      getLegalDocuments: current,
      getLegalDocument: async () => ({ document: legalDoc("privacy", "2026-09-21", { title: null, blocks: null }) }),
    })
    expect(await screen.findByText("This earlier version isn't available here.")).toBeTruthy()
    fireEvent.click(screen.getByRole("link", { name: "Read the current version" }))
    expect(assign).toHaveBeenCalledWith("/legal/privacy/")
  })

  it("T26: the current version named explicitly has no earlier-version line", async () => {
    at(`/legal/privacy/?version=${CURRENT_VERSION}`)
    mount(PrivacyPage, {
      getLegalDocuments: withCurrentPrivacy(legalDoc("privacy", CURRENT_VERSION)),
      getLegalDocument: async () => ({ document: legalDoc("privacy", CURRENT_VERSION) }),
    })
    expect(await screen.findByRole("heading", { name: "Privacy Policy" })).toBeTruthy()
    expect(screen.getByText("Version 2026-10-30 · effective October 30, 2026")).toBeTruthy()
    expect(screen.queryByText(/This is an earlier version/)).toBeNull()
  })

  it.each([
    ["1999-01-01", true],
    ["abc", false],
  ])("T27: ?version=%s the server doesn't have shows the unavailable line, not an error", async (version, asks) => {
    at(`/legal/privacy/?version=${version}`)
    const getLegalDocument = vi.fn(async () => {
      throw new AppError(ErrorCode.NOT_FOUND, "No such version")
    })
    mount(PrivacyPage, { getLegalDocuments: current, getLegalDocument })
    expect(await screen.findByText("This earlier version isn't available here.")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Read the current version" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
    expect(screen.queryByText("Couldn't load this document")).toBeNull()
    await waitFor(() => expect(getLegalDocument).toHaveBeenCalledTimes(asks ? 1 : 0))
  })
})
