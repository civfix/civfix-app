import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as React from "react"
import { act, render } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi } from "vitest"
import type {
  AcceptLegalRequest,
  GetLegalDocumentRequest,
  LegalDocumentDTO,
  LegalDocumentMetaDTO,
  MyLegalStatusResponse,
  UserDTO,
} from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import { CapabilitiesProvider, makeFakeCapabilities } from "../../capabilities"
import { ApiProvider } from "../../data/context"
import { makeFakeDataContext } from "../../data/fakes"
import type { AuthState, DataContextValue } from "../../data/types"
import { I18nProvider } from "../../i18n"
import { CURRENT_VERSION, legalDoc } from "../../primitives/__tests__/legalDocumentFixtures"

interface LegalCatalog {
  update: { accept: string; sign_out: string }
  notice: { read: string; dismiss: string }
}

/** The en catalog, read as data so the labels a test expects come from the same file the app loads. */
export const EN_LEGAL = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "i18n", "locales", "en", "legal.json"), "utf8"),
) as LegalCatalog

export const TERMS_DOC = legalDoc("terms", CURRENT_VERSION, {
  sha256: "1".repeat(64),
  summary: "Adds a section on city filing",
})
export const PRIVACY_DOC = legalDoc("privacy", CURRENT_VERSION, {
  sha256: "2".repeat(64),
  summary: "Explains how long reports are kept",
})
export const COOKIES_DOC = legalDoc("cookies", CURRENT_VERSION, {
  sha256: "3".repeat(64),
  summary: "Adds two providers",
  material: false,
})
export const SUBPROCESSORS_DOC = legalDoc("subprocessors", CURRENT_VERSION, {
  sha256: "4".repeat(64),
  summary: "Adds a mail provider",
  material: false,
})
const CURRENT_DOCS: LegalDocumentDTO[] = [TERMS_DOC, PRIVACY_DOC, COOKIES_DOC, SUBPROCESSORS_DOC]

/** A status item: the document without its text, as GET /me/legal sends it. */
function meta(document: LegalDocumentDTO): LegalDocumentMetaDTO {
  const { blocks: _blocks, ...rest } = document
  return rest
}

export const TERMS = meta(TERMS_DOC)
export const PRIVACY = meta(PRIVACY_DOC)
export const COOKIES = meta(COOKIES_DOC)
export const SUBPROCESSORS = meta(SUBPROCESSORS_DOC)

const AT = `${CURRENT_VERSION}T12:00:00.000Z`

export const SETTLED: MyLegalStatusResponse = {
  required: [],
  notices: [],
  accepted: {
    terms: { version: CURRENT_VERSION, action: "accepted", at: AT },
    privacy: { version: CURRENT_VERSION, action: "accepted", at: AT },
    cookies: { version: CURRENT_VERSION, action: "acknowledged", at: AT },
    subprocessors: { version: CURRENT_VERSION, action: "acknowledged", at: AT },
  },
}

export function status(partial: Partial<MyLegalStatusResponse>): MyLegalStatusResponse {
  return { required: [], notices: [], accepted: {}, ...partial }
}

export const USER: UserDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Ada Lovelace",
  handle: "ada",
  role: "citizen",
  locale: "en",
  profileComplete: true,
  createdAt: "2026-01-01T00:00:00.000Z",
}

const SIGNED_IN: AuthState = { isAuthenticated: true, user: USER, isPending: false }
export const FIRST_RUN: AuthState = { isAuthenticated: true, user: { ...USER, profileComplete: false }, isPending: false }
export const GUEST: AuthState = { isAuthenticated: false, user: null, isPending: false }

/** A reactive auth state, so a test can sign the person out or finish first run mid-render. */
function authStore(initial: AuthState) {
  let state = initial
  const listeners = new Set<() => void>()
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  return {
    useAuthState: () => React.useSyncExternalStore(subscribe, () => state),
    get: () => state,
    set(next: AuthState) {
      state = next
      act(() => {
        listeners.forEach((listener) => listener())
      })
    },
  }
}

/**
 * The legal endpoints as the server answers them: the status is what was last recorded, and an
 * acceptance settles everything unless a test replaces `acceptLegal`.
 */
export function legalApi(initial: MyLegalStatusResponse) {
  let current = initial
  const api = {
    getMyLegalStatus: vi.fn(async (): Promise<MyLegalStatusResponse> => current),
    acceptLegal: vi.fn(async (_body: AcceptLegalRequest): Promise<MyLegalStatusResponse> => {
      current = SETTLED
      return SETTLED
    }),
    getLegalDocuments: vi.fn(async () => ({ documents: CURRENT_DOCS })),
    getLegalDocument: vi.fn(async ({ type, version }: GetLegalDocumentRequest) => {
      const document = CURRENT_DOCS.find((candidate) => candidate.type === type)
      if (!document) throw new Error(`no ${type} fixture`)
      return { document: { ...document, version } }
    }),
  }
  return {
    api,
    setStatus(next: MyLegalStatusResponse) {
      current = next
    },
  }
}

export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Lets the query client run its pending fetches and notify their observers. */
export async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

export interface MountOptions {
  api: Record<string, unknown>
  auth?: AuthState
  open?: (url: string) => Promise<void>
}

export function mountLegal(ui: React.ReactElement, { api, auth = SIGNED_IN, open }: MountOptions) {
  const store = authStore(auth)
  const logout = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const context: DataContextValue = {
    ...makeFakeDataContext({ api: api as unknown as ApiClient }),
    useAuthState: store.useAuthState,
    logout,
    onUserUpdated: (user) => store.set({ isAuthenticated: true, user, isPending: false }),
  }
  const capabilities = { ...makeFakeCapabilities(), openExternal: { open: open ?? vi.fn(async () => {}) } }
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>
        <CapabilitiesProvider value={capabilities}>
          <I18nProvider locale="en">{ui}</I18nProvider>
        </CapabilitiesProvider>
      </ApiProvider>
    </QueryClientProvider>,
  )
  return { ...view, store, logout, queryClient }
}
