import * as React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import type * as ReactNative from "react-native"
import { AppError, ErrorCode, type LegalDocumentMetaDTO, type MyLegalStatusResponse } from "@civfix/contract"
import { LegalNoticeBanner } from "../LegalNoticeBanner"
import {
  COOKIES,
  EN_LEGAL as en,
  PRIVACY,
  SETTLED,
  SUBPROCESSORS,
  TERMS,
  deferred,
  legalApi,
  mountLegal,
  settle,
  status,
} from "./legalUpdateHarness"

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

const { openInPlace } = vi.hoisted(() => ({ openInPlace: vi.fn((_type: string) => true) }))
vi.mock("../../primitives/legalDocumentNav", () => ({
  openLegalDocumentInPlace: (type: string) => openInPlace(type),
}))

const open = vi.fn(async (_url: string) => {})

function showBanner(initial: MyLegalStatusResponse) {
  const legal = legalApi(initial)
  return { ...legal, ...mountLegal(<LegalNoticeBanner />, { api: legal.api, open }) }
}

const gotIt = () => screen.getByRole("button", { name: "Got it" })

beforeEach(() => {
  openInPlace.mockClear()
  open.mockClear()
})

describe("LegalNoticeBanner", () => {
  it("T19: Read and Got it are buttons labelled from legal.json", async () => {
    showBanner(status({ notices: [COOKIES] }))
    const read = await screen.findByRole("button", { name: en.notice.read })
    const dismiss = screen.getByRole("button", { name: en.notice.dismiss })
    expect(read.getAttribute("aria-label")).toBe(en.notice.read)
    expect(dismiss.getAttribute("aria-label")).toBe(en.notice.dismiss)
    expect(en.notice.read).toBe("Read")
    expect(en.notice.dismiss).toBe("Got it")
  })

  it("T20: names the document and shows its summary, with Read and Got it", async () => {
    showBanner(status({ notices: [COOKIES] }))
    expect(await screen.findByText("We've updated our Cookies notice. Adds two providers")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Read" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Got it" })).toBeTruthy()
  })

  it.each<[string, LegalDocumentMetaDTO, string]>([
    ["terms", TERMS, "We've updated our Terms. Adds a section on city filing"],
    ["privacy", PRIVACY, "We've updated our Privacy notice. Explains how long reports are kept"],
    ["cookies", COOKIES, "We've updated our Cookies notice. Adds two providers"],
    ["subprocessors", SUBPROCESSORS, "We've updated our Subprocessors list. Adds a mail provider"],
  ])("T20: names the %s document", async (_type, notice, sentence) => {
    showBanner(status({ notices: [notice] }))
    expect(await screen.findByText(sentence)).toBeTruthy()
  })

  it("T21: Got it acknowledges the notice and the banner goes", async () => {
    const { api } = showBanner(status({ notices: [COOKIES] }))
    await screen.findByText(/Cookies notice/)
    fireEvent.click(gotIt())
    await waitFor(() => expect(screen.queryByText(/Cookies notice/)).toBeNull())
    expect(api.acceptLegal).toHaveBeenCalledTimes(1)
    expect(api.acceptLegal.mock.calls[0]?.[0]).toStrictEqual({
      items: [{ type: "cookies", version: COOKIES.version, sha256: COOKIES.sha256, action: "acknowledged" }],
      surface: "notice",
    })
    await settle()
    expect(screen.queryByRole("button", { name: "Got it" })).toBeNull()
  })

  it("T22: shows one notice at a time, in order", async () => {
    const { api, setStatus } = showBanner(status({ notices: [COOKIES, SUBPROCESSORS] }))
    expect(await screen.findByText("We've updated our Cookies notice. Adds two providers")).toBeTruthy()
    expect(screen.getAllByRole("button", { name: "Got it" })).toHaveLength(1)
    expect(screen.queryByText(/Subprocessors list/)).toBeNull()

    const next = status({ notices: [SUBPROCESSORS] })
    api.acceptLegal.mockImplementationOnce(async () => {
      setStatus(next)
      return next
    })
    fireEvent.click(gotIt())
    expect(await screen.findByText("We've updated our Subprocessors list. Adds a mail provider")).toBeTruthy()
    expect(screen.getAllByRole("button", { name: "Got it" })).toHaveLength(1)
    expect(screen.queryByText(/Cookies notice/)).toBeNull()
  })

  it("T23: Read opens the document in place and leaves the banner up", async () => {
    const { api } = showBanner(status({ notices: [COOKIES] }))
    fireEvent.click(await screen.findByRole("button", { name: "Read" }))
    expect(openInPlace).toHaveBeenCalledTimes(1)
    expect(openInPlace).toHaveBeenCalledWith("cookies")
    expect(open).not.toHaveBeenCalled()
    expect(api.acceptLegal).not.toHaveBeenCalled()
    expect(screen.getByText("We've updated our Cookies notice. Adds two providers")).toBeTruthy()
  })

  it("T24: a failed Got it keeps the banner, says so, and can be pressed again", async () => {
    const { api } = showBanner(status({ notices: [COOKIES] }))
    api.acceptLegal.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    await screen.findByText(/Cookies notice/)
    fireEvent.click(gotIt())
    expect((await screen.findByRole("alert")).textContent).toBe("Something went wrong. Please try again.")
    expect(screen.getByText("We've updated our Cookies notice. Adds two providers")).toBeTruthy()
    await waitFor(() => expect(gotIt().getAttribute("aria-disabled")).not.toBe("true"))
  })

  it("an outdated notice refetches the status and the next Got it acknowledges the new version", async () => {
    const NEXT = { ...COOKIES, version: "2026-11-02", sha256: "d".repeat(64), summary: "Second change" }
    const { api, setStatus } = showBanner(status({ notices: [COOKIES] }))
    api.acceptLegal.mockImplementationOnce(async () => {
      setStatus(status({ notices: [NEXT] }))
      throw new AppError(ErrorCode.CONFLICT, "outdated", {
        details: {
          reason: "legal_version_outdated",
          current: [{ type: "cookies", version: NEXT.version, sha256: NEXT.sha256 }],
        },
      })
    })
    await screen.findByText(/Cookies notice/)
    fireEvent.click(gotIt())
    await waitFor(() => expect(api.getMyLegalStatus).toHaveBeenCalledTimes(2))
    expect(await screen.findByText("We've updated our Cookies notice. Second change")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()

    fireEvent.click(gotIt())
    await waitFor(() => expect(api.acceptLegal).toHaveBeenCalledTimes(2))
    expect(api.acceptLegal.mock.calls[1]?.[0]).toStrictEqual({
      items: [{ type: "cookies", version: NEXT.version, sha256: NEXT.sha256, action: "acknowledged" }],
      surface: "notice",
    })
  })

  it("T25: stays out of the way while something is owed", async () => {
    const { api, container } = showBanner(status({ required: [TERMS], notices: [COOKIES] }))
    await waitFor(() => expect(api.getMyLegalStatus).toHaveBeenCalledTimes(1))
    await settle()
    expect(container.innerHTML).toBe("")
  })

  it("T26: renders nothing while the status loads, or when it fails", async () => {
    const pending = legalApi(SETTLED)
    pending.api.getMyLegalStatus.mockImplementation(() => new Promise(() => {}))
    const first = mountLegal(<LegalNoticeBanner />, { api: pending.api })
    await settle()
    expect(first.container.innerHTML).toBe("")
    first.unmount()

    const failing = legalApi(SETTLED)
    const failure = deferred<MyLegalStatusResponse>()
    failing.api.getMyLegalStatus.mockImplementation(() => failure.promise)
    const second = mountLegal(<LegalNoticeBanner />, { api: failing.api })
    await act(async () => failure.reject(new TypeError("Failed to fetch")))
    await settle()
    expect(second.container.innerHTML).toBe("")
  })
})
