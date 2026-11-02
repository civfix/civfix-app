import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type * as ReactNative from "react-native"
import type { ApiClient } from "@civfix/contract/client"
import { CapabilitiesProvider, makeFakeCapabilities } from "../../capabilities"
import { ApiProvider } from "../../data/context"
import { makeFakeDataContext } from "../../data/fakes"
import { I18nProvider } from "../../i18n"
import { DOCUMENTS, PRIVACY_0921, TERMS_0921 } from "../../data/__tests__/legalFixtures"
import { TermsConfirmation, type AcceptedLegalDocument } from "../TermsConfirmation"

vi.mock("../../typography", async () => {
  const RN = await vi.importActual<typeof ReactNative>("react-native")
  return { Text: RN.Text, Icon: () => null, iconMap: new Proxy({}, { get: () => "icon" }) }
})

const ACCEPTED = [
  { type: "terms", version: "2026-09-21", sha256: TERMS_0921.sha256 },
  { type: "privacy", version: "2026-09-21", sha256: PRIVACY_0921.sha256 },
]

function held<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

// A parent that owns the box's state, the way the first-run gates do.
function Gate({
  onConfirmedChange,
  onAccept,
}: {
  onConfirmedChange: (next: boolean) => void
  onAccept: (documents: readonly AcceptedLegalDocument[]) => void
}) {
  const [confirmed, setConfirmed] = React.useState(false)
  return (
    <TermsConfirmation
      confirmed={confirmed}
      onConfirmedChange={(next) => {
        setConfirmed(next)
        onConfirmedChange(next)
      }}
      onAccept={onAccept}
    />
  )
}

function renderGate(getLegalDocuments: () => Promise<unknown>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const context = makeFakeDataContext({ api: { getLegalDocuments } as unknown as ApiClient })
  const onConfirmedChange = vi.fn()
  const onAccept = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>
        <CapabilitiesProvider value={makeFakeCapabilities()}>
          <I18nProvider locale="en">
            <Gate onConfirmedChange={onConfirmedChange} onAccept={onAccept} />
          </I18nProvider>
        </CapabilitiesProvider>
      </ApiProvider>
    </QueryClientProvider>,
  )
  return { onConfirmedChange, onAccept }
}

const box = () => screen.getByRole("checkbox")

describe("TermsConfirmation onAccept", () => {
  it("T32: gives the fetched type, version and hash of each document on a confirming tick", async () => {
    const getLegalDocuments = vi.fn(async () => ({ documents: DOCUMENTS }))
    const { onConfirmedChange, onAccept } = renderGate(getLegalDocuments)
    await waitFor(() => expect(getLegalDocuments).toHaveBeenCalledTimes(1))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    fireEvent.click(box())
    expect(onConfirmedChange).toHaveBeenCalledWith(true)
    await waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1))
    expect(onAccept.mock.calls[0]?.[0]).toEqual(ACCEPTED)
  })

  it("T33: a tick before the documents arrive confirms at once and accepts once they do", async () => {
    const pending = held<unknown>()
    const { onConfirmedChange, onAccept } = renderGate(() => pending.promise)
    fireEvent.click(box())
    expect(onConfirmedChange).toHaveBeenCalledWith(true)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(onAccept).not.toHaveBeenCalled()
    await act(async () => {
      pending.resolve({ documents: DOCUMENTS })
    })
    await waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1))
    expect(onAccept.mock.calls[0]?.[0]).toEqual(ACCEPTED)
  })

  it("T34: a tick taken back before the documents arrive accepts nothing", async () => {
    const pending = held<unknown>()
    const { onAccept } = renderGate(() => pending.promise)
    fireEvent.click(box())
    fireEvent.click(box())
    await act(async () => {
      pending.resolve({ documents: DOCUMENTS })
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(onAccept).not.toHaveBeenCalled()
  })
})
