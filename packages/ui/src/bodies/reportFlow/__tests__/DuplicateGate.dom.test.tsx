import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type * as ReactNative from "react-native"
import { AppError, ErrorCode, type ReportConfirmResponse, type ReportDTO, type UserDTO } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import { ApiProvider } from "../../../data/context"
import { makeFakeDataContext } from "../../../data/fakes"
import { queryKeys } from "../../../data/keys"
import { I18nProvider } from "../../../i18n"
import { useNavStore } from "../../../nav"
import { ToastContext } from "../../../primitives/toastContext"
import type * as ToastContextModule from "../../../primitives/toastContext"
import { useDraftReportStore } from "../../../report/draftStore"
import type { NearbyReportRow } from "../../linkReportsModel"
import { DuplicateGate } from "../DuplicateGate"

// The icon set pulls in native-only modules; the screen is read by its text.
vi.mock("../../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})
vi.mock("../../../primitives", async () => {
  const { useToast } = await vi.importActual<typeof ToastContextModule>("../../../primitives/toastContext")
  return { CATEGORY_ICONS: {}, MetaDot: () => null, useToast }
})

const ME = { id: "u-me", displayName: "Mia Me" } as unknown as UserDTO
const ME_TOO = "Me too, I saw this problem too"
const ME_TOO_ERROR = "Couldn't save your Me too. Try again."

function match(id: string, title: string): NearbyReportRow {
  return {
    pin: { id, category: "trash", status: "published", lat: 34.1, lng: -118.3, confirmCount: 0, fixedCount: 0, title },
    distanceM: 8,
  }
}

const r1 = match("r1", "Overflowing bin")
const r2 = match("r2", "Bin knocked over")

function held<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function renderGate({
  signedIn = true,
  api = {},
  rows = [r1, r2],
}: {
  signedIn?: boolean
  api?: Record<string, unknown>
  rows?: NearbyReportRow[]
} = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const context = makeFakeDataContext({
    api: api as unknown as ApiClient,
    auth: signedIn ? { isAuthenticated: true, user: ME } : {},
  })
  const toast = { show: vi.fn() }
  const onOpen = vi.fn()
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>
        <I18nProvider locale="en">
          <ToastContext.Provider value={toast}>
            <DuplicateGate rows={rows} onOpen={onOpen} onBack={vi.fn()} />
          </ToastContext.Provider>
        </I18nProvider>
      </ApiProvider>
    </QueryClientProvider>,
  )
  return { ...view, queryClient, toast, onOpen }
}

const meTooButtons = () => screen.queryAllByRole("button", { name: ME_TOO })
const draft = () => useDraftReportStore.getState().draft

beforeEach(() => {
  useNavStore.getState().reset()
  useNavStore.getState().selectView("report")
  useDraftReportStore.getState().reset()
  useDraftReportStore.getState().setTitle("Overflowing bin")
  useDraftReportStore.getState().setLocation(34.1, -118.3, "manual")
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("DuplicateGate", () => {
  it("shows on web without logging a console error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    renderGate({ rows: [r1] })
    expect(screen.getByText("Overflowing bin")).toBeTruthy()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it("T10: gives a signed-in reporter Me too on each row, and the cards still open", () => {
    const { onOpen } = renderGate()
    expect(meTooButtons()).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: /^Overflowing bin/ }))
    fireEvent.click(screen.getByRole("button", { name: /^Bin knocked over/ }))
    expect(onOpen).toHaveBeenNthCalledWith(1, r1)
    expect(onOpen).toHaveBeenNthCalledWith(2, r2)
  })

  it("T11: gives a guest no Me too, and still shows both cards", () => {
    renderGate({ signedIn: false })
    expect(meTooButtons()).toHaveLength(0)
    expect(screen.getByText("Overflowing bin")).toBeTruthy()
    expect(screen.getByText("Bin knocked over")).toBeTruthy()
  })

  it("T12: sends one Me too while it waits, and does not open the report yet", async () => {
    const call = held<ReportConfirmResponse>()
    const api = { confirmReport: vi.fn(() => call.promise) }
    const { onOpen } = renderGate({ api })
    fireEvent.click(meTooButtons()[0]!)
    fireEvent.click(meTooButtons()[0]!)
    await waitFor(() => expect(api.confirmReport).toHaveBeenCalled())
    fireEvent.click(meTooButtons()[0]!)
    await act(async () => {})
    expect(api.confirmReport).toHaveBeenCalledTimes(1)
    expect(api.confirmReport).toHaveBeenCalledWith({ id: "r1" })
    expect(onOpen).not.toHaveBeenCalled()
  })

  it("T13: opens the report pressed once the API answers, and keeps the draft", async () => {
    const call = held<ReportConfirmResponse>()
    const api = { confirmReport: vi.fn(() => call.promise) }
    const { onOpen, queryClient, toast } = renderGate({ api })
    const cached = { id: "r1", status: "published", confirmCount: 4, confirmedByMe: false } as unknown as ReportDTO
    queryClient.setQueryData(queryKeys.report("r1"), cached)
    const map = queryKeys.mapReports({ west: -118.4, south: 34, east: -118.2, north: 34.2 }, [])
    queryClient.setQueryData(map, { pins: [] })
    const draftBefore = draft()

    fireEvent.click(meTooButtons()[0]!)
    fireEvent.click(meTooButtons()[0]!)
    await waitFor(() => expect(api.confirmReport).toHaveBeenCalledTimes(1))
    await act(async () => call.resolve({ confirmCount: 5, confirmedByMe: true, fixedCount: 0, fixedByMe: false }))

    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1))
    expect(onOpen).toHaveBeenCalledWith(r1)
    expect(queryClient.getQueryData<ReportDTO>(queryKeys.report("r1"))).toMatchObject({
      confirmCount: 5,
      confirmedByMe: true,
    })
    expect(queryClient.getQueryState(map)?.isInvalidated).toBe(true)
    expect(toast.show).not.toHaveBeenCalled()
    expect(draft()).toBe(draftBefore)
  })

  it("T14: shows an error and keeps the draft when the API fails, and lets the reporter try again", async () => {
    const api = { confirmReport: vi.fn(async () => Promise.reject(new AppError(ErrorCode.INTERNAL, "boom"))) }
    const { onOpen, toast } = renderGate({ api })
    const draftBefore = draft()

    fireEvent.click(meTooButtons()[0]!)
    await waitFor(() => expect(toast.show).toHaveBeenCalledTimes(1))
    expect(toast.show).toHaveBeenCalledWith(ME_TOO_ERROR, { variant: "error" })
    expect(onOpen).not.toHaveBeenCalled()
    expect(draft()).toBe(draftBefore)

    await waitFor(() => expect(meTooButtons()[0]!.getAttribute("aria-disabled")).not.toBe("true"))
    fireEvent.click(meTooButtons()[0]!)
    await waitFor(() => expect(api.confirmReport).toHaveBeenCalledTimes(2))
  })

  it("T15: opens the report like a card tap when the reporter filed it", async () => {
    const api = { confirmReport: vi.fn(async () => Promise.reject(new AppError(ErrorCode.FORBIDDEN, "yours"))) }
    const { onOpen, toast } = renderGate({ api })
    fireEvent.click(meTooButtons()[0]!)
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1))
    expect(onOpen).toHaveBeenCalledWith(r1)
    expect(toast.show).not.toHaveBeenCalled()
  })

  it.each([
    ["CONFLICT", ErrorCode.CONFLICT],
    ["NOT_FOUND", ErrorCode.NOT_FOUND],
  ] as const)("T16: shows the error and opens nothing on %s", async (_name, code) => {
    const api = { confirmReport: vi.fn(async () => Promise.reject(new AppError(code, "refused"))) }
    const { onOpen, toast } = renderGate({ api })
    fireEvent.click(meTooButtons()[0]!)
    await waitFor(() => expect(toast.show).toHaveBeenCalledTimes(1))
    expect(toast.show).toHaveBeenCalledWith(ME_TOO_ERROR, { variant: "error" })
    expect(onOpen).not.toHaveBeenCalled()
  })
})

describe("GH#203 DuplicateGate", () => {
  it("T25: a failed I see this too shows the vote error once, keeps the draft and stays on the screen", async () => {
    const api = { confirmReport: vi.fn(async () => Promise.reject(new AppError(ErrorCode.INTERNAL, "boom"))) }
    const { onOpen, toast } = renderGate({ api })
    const draftBefore = draft()
    fireEvent.click(screen.getAllByRole("button", { name: "I see this problem too" })[0]!)
    await waitFor(() => expect(toast.show).toHaveBeenCalledTimes(1))
    expect(toast.show).toHaveBeenCalledWith("Couldn't save your vote. Try again.", { variant: "error" })
    await act(async () => {})
    expect(toast.show).toHaveBeenCalledTimes(1)
    expect(draft()).toBe(draftBefore)
    expect(onOpen).not.toHaveBeenCalled()
  })
})
