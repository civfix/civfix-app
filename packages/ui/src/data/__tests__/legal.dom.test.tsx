import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AppError, ErrorCode, type LegalDocumentDTO, type MyLegalStatusResponse } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import { ApiProvider } from "../context"
import { makeFakeDataContext } from "../fakes"
import {
  outdatedLegalVersions,
  useAcceptLegal,
  useLegalDocument,
  useLegalDocuments,
  useMyLegalStatus,
} from "../index"
import { queryKeys } from "../keys"
import { DOCUMENTS, OUTDATED_DETAILS, TERMS_0916, TERMS_0921, outdatedConflict } from "./legalFixtures"

const STALE_MS = 300_000
const STATUS: MyLegalStatusResponse = { required: [], notices: [], accepted: {} }

function harness(api: Record<string, unknown>, signedIn = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const context = makeFakeDataContext({
    api: api as unknown as ApiClient,
    auth: signedIn ? { isAuthenticated: true } : {},
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>{children}</ApiProvider>
    </QueryClientProvider>
  )
  return { queryClient, wrapper }
}

function staleTimeOf(queryClient: QueryClient, queryKey: QueryKey): unknown {
  return queryClient.getQueryCache().find({ queryKey, exact: true })?.observers[0]?.options.staleTime
}

afterEach(() => {
  vi.useRealTimers()
})

describe("legal query keys", () => {
  it("T2: nests every legal key under the legal root", () => {
    expect(queryKeys.legalRoot).toEqual(["legal"])
    expect(queryKeys.legalDocuments).toEqual(["legal", "documents"])
    expect(queryKeys.legalDocument("terms", "2026-09-16")).toEqual(["legal", "documents", "terms", "2026-09-16"])
    expect(queryKeys.myLegalStatus).toEqual(["legal", "me"])
    for (const key of [queryKeys.legalDocuments, queryKeys.legalDocument("terms", "2026-09-16"), queryKeys.myLegalStatus]) {
      expect(key.slice(0, queryKeys.legalRoot.length)).toEqual([...queryKeys.legalRoot])
    }
  })
})

describe("useLegalDocuments", () => {
  it("T3: returns the documents of one GET /legal/documents", async () => {
    const getLegalDocuments = vi.fn(async () => ({ documents: DOCUMENTS }))
    const { wrapper } = harness({ getLegalDocuments })
    const { result } = renderHook(() => useLegalDocuments(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(DOCUMENTS)
    expect(getLegalDocuments).toHaveBeenCalledTimes(1)
  })

  it("T4: serves a new consumer from the cache for five minutes, then refetches", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const start = new Date("2026-10-26T12:00:00.000Z").getTime()
    vi.setSystemTime(start)
    const getLegalDocuments = vi.fn(async () => ({ documents: DOCUMENTS }))
    const { wrapper } = harness({ getLegalDocuments })
    const first = renderHook(() => useLegalDocuments(), { wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))

    vi.setSystemTime(start + 299_000)
    const second = renderHook(() => useLegalDocuments(), { wrapper })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(getLegalDocuments).toHaveBeenCalledTimes(1)

    vi.setSystemTime(start + 301_000)
    renderHook(() => useLegalDocuments(), { wrapper })
    await waitFor(() => expect(getLegalDocuments).toHaveBeenCalledTimes(2))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(getLegalDocuments).toHaveBeenCalledTimes(2)
  })
})

describe("useLegalDocument", () => {
  it("T5: picks the type's current entry from the documents query, with no request of its own", async () => {
    const getLegalDocuments = vi.fn(async () => ({ documents: DOCUMENTS }))
    const getLegalDocument = vi.fn()
    const { wrapper } = harness({ getLegalDocuments, getLegalDocument })
    const { result } = renderHook(() => useLegalDocument("terms"), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(TERMS_0921)
    expect(getLegalDocument).not.toHaveBeenCalled()
    expect(getLegalDocuments).toHaveBeenCalledTimes(1)
  })

  it("T6: fetches a named version once, cached under its own key for five minutes", async () => {
    const getLegalDocument = vi.fn(async () => ({ document: TERMS_0916 }))
    const { wrapper, queryClient } = harness({ getLegalDocument })
    const { result } = renderHook(() => useLegalDocument("terms", "2026-09-16"), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getLegalDocument).toHaveBeenCalledTimes(1)
    expect(getLegalDocument).toHaveBeenCalledWith({ type: "terms", version: "2026-09-16" })
    expect(result.current.data).toEqual(TERMS_0916)
    const key = queryKeys.legalDocument("terms", "2026-09-16")
    expect(queryClient.getQueryData(key)).toBeDefined()
    expect(staleTimeOf(queryClient, key)).toBe(STALE_MS)
  })
})

describe("useMyLegalStatus", () => {
  it("T7: never asks while signed out", async () => {
    const getMyLegalStatus = vi.fn(async () => STATUS)
    const { wrapper } = harness({ getMyLegalStatus })
    const { result } = renderHook(() => useMyLegalStatus(), { wrapper })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(getMyLegalStatus).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe("idle")
  })

  it("T8: reads the signed-in person's status once, fresh for five minutes", async () => {
    const getMyLegalStatus = vi.fn(async () => STATUS)
    const { wrapper, queryClient } = harness({ getMyLegalStatus }, true)
    const { result } = renderHook(() => useMyLegalStatus(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getMyLegalStatus).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual(STATUS)
    expect(staleTimeOf(queryClient, queryKeys.myLegalStatus)).toBe(STALE_MS)
  })
})

describe("useAcceptLegal", () => {
  function renderAccept(acceptLegal: (...args: unknown[]) => Promise<unknown>) {
    const getMyLegalStatus = vi.fn(async () => STATUS)
    const { wrapper } = harness({ getMyLegalStatus, acceptLegal }, true)
    const { result } = renderHook(() => ({ status: useMyLegalStatus(), accept: useAcceptLegal() }), { wrapper })
    return { result, getMyLegalStatus }
  }

  it("T9: sends the body as given, then refetches the status", async () => {
    const acceptLegal = vi.fn(async () => STATUS)
    const { result, getMyLegalStatus } = renderAccept(acceptLegal)
    await waitFor(() => expect(result.current.status.isSuccess).toBe(true))
    const body = { items: [{ ...pick(TERMS_0921), action: "accepted" as const }], surface: "prompt" as const }
    act(() => result.current.accept.mutate(body))
    await waitFor(() => expect(result.current.accept.isSuccess).toBe(true))
    expect(acceptLegal).toHaveBeenCalledTimes(1)
    expect(acceptLegal.mock.calls[0]).toEqual([body])
    await waitFor(() => expect(getMyLegalStatus).toHaveBeenCalledTimes(2))
  })

  it("T10: leaves the status alone when the server refuses an outdated version", async () => {
    const acceptLegal = vi.fn(async () => {
      throw outdatedConflict()
    })
    const { result, getMyLegalStatus } = renderAccept(acceptLegal)
    await waitFor(() => expect(result.current.status.isSuccess).toBe(true))
    act(() =>
      result.current.accept.mutate({ items: [{ ...pick(TERMS_0921), action: "accepted" }], surface: "prompt" }),
    )
    await waitFor(() => expect(result.current.accept.isError).toBe(true))
    expect((result.current.accept.error as { code?: unknown }).code).toBe("CONFLICT")
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(getMyLegalStatus).toHaveBeenCalledTimes(1)
  })
})

describe("outdatedLegalVersions", () => {
  it("T11: reads the current versions off an outdated CONFLICT", () => {
    expect(outdatedLegalVersions(outdatedConflict())).toEqual(OUTDATED_DETAILS.current)
  })

  it("T12: reads them structurally, from a plain object too", () => {
    expect(outdatedLegalVersions({ code: "CONFLICT", message: "x", details: OUTDATED_DETAILS })).toEqual(
      OUTDATED_DETAILS.current,
    )
  })

  it("T13: is null for anything else", () => {
    const badSha = {
      ...OUTDATED_DETAILS,
      current: [{ ...OUTDATED_DETAILS.current[0], sha256: "xyz" }, OUTDATED_DETAILS.current[1]],
    }
    expect(outdatedLegalVersions(new AppError(ErrorCode.CONFLICT, "x"))).toBeNull()
    expect(
      outdatedLegalVersions(new AppError(ErrorCode.CONFLICT, "x", { details: { ...OUTDATED_DETAILS, reason: "other" } })),
    ).toBeNull()
    expect(outdatedLegalVersions(new AppError(ErrorCode.VALIDATION, "x", { details: { ...OUTDATED_DETAILS } }))).toBeNull()
    expect(outdatedLegalVersions(new AppError(ErrorCode.CONFLICT, "x", { details: badSha }))).toBeNull()
    expect(outdatedLegalVersions(null)).toBeNull()
  })
})

function pick({ type, version, sha256 }: LegalDocumentDTO) {
  return { type, version, sha256 }
}
