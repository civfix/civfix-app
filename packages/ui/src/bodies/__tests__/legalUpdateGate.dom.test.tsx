import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import type * as ReactNative from "react-native"
import { AppError, ErrorCode, type MyLegalStatusResponse } from "@civfix/contract"
import { useNavStore } from "../../nav"
import { setLegalDocumentPresenter } from "../../primitives/legalDocument"
import { useShellKeys } from "../../shell/useShellKeys"
import { LegalNoticeBanner } from "../LegalNoticeBanner"
import { LegalUpdateGate } from "../LegalUpdateGate"
import {
  COOKIES,
  FIRST_RUN,
  GUEST,
  PRIVACY,
  SETTLED,
  TERMS,
  TERMS_DOC,
  EN_LEGAL as en,
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

const present = vi.fn()
const open = vi.fn(async (_url: string) => {})

const GENERIC_ERROR = "Something went wrong. Please try again."
const PRIVACY_LINK = "https://civfix.org/legal/privacy"

function resetNav(): void {
  useNavStore.setState({
    view: "map",
    stack: [],
    active: null,
    snap: 0,
    query: "",
    mode: "expanded",
    originView: null,
    seededDetailPage: false,
    reportReturn: null,
    navSeq: 0,
    lastTransition: null,
  })
}

/** A panel open beneath the gate, so a navigation the gate lets through would show. */
function openPanel(): { view: unknown; active: unknown } {
  useNavStore.getState().selectView("events")
  useNavStore.getState().push({ kind: "event-dashboard" })
  const { view, active } = useNavStore.getState()
  return { view, active }
}

function navNow(): { view: unknown; active: unknown } {
  const { view, active } = useNavStore.getState()
  return { view, active }
}

function showGate(initial: MyLegalStatusResponse, auth = undefined as Parameters<typeof mountLegal>[1]["auth"]) {
  const legal = legalApi(initial)
  const mounted = mountLegal(
    <>
      <LegalUpdateGate />
      <LegalNoticeBanner />
    </>,
    { api: legal.api, open, ...(auth ? { auth } : {}) },
  )
  return { ...legal, ...mounted }
}

const accept = () => screen.getByRole("button", { name: "Accept and continue" })

beforeEach(() => {
  resetNav()
  openInPlace.mockClear()
  present.mockClear()
  open.mockClear()
  setLegalDocumentPresenter(present)
})

afterEach(() => {
  setLegalDocumentPresenter(null)
})

describe("LegalUpdateGate", () => {
  it("T1: shows one full-screen dialog for owed Terms, with its summary, Read the Terms and both actions", async () => {
    showGate(status({ required: [TERMS] }))
    const dialog = await screen.findByRole("dialog", { name: "We've updated our Terms" })
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(within(dialog).getByRole("heading", { name: "We've updated our Terms" })).toBeTruthy()
    expect(within(dialog).getByText("Adds a section on city filing")).toBeTruthy()
    expect(within(dialog).getByText("Read the Terms")).toBeTruthy()
    expect(within(dialog).getByRole("button", { name: "Accept and continue" })).toBeTruthy()
    expect(within(dialog).getByRole("button", { name: "Sign out" })).toBeTruthy()
  })

  it("T2: names the Privacy notice when only privacy is owed", async () => {
    showGate(status({ required: [PRIVACY] }))
    expect(await screen.findByRole("heading", { name: "We've updated our Privacy notice" })).toBeTruthy()
    expect(screen.getByText("Read the Privacy notice")).toBeTruthy()
    expect(screen.queryByText("Read the Terms")).toBeNull()
  })

  it("T3: names both, shows both summaries, and offers the Terms before the Privacy notice", async () => {
    showGate(status({ required: [TERMS, PRIVACY] }))
    expect(await screen.findByRole("heading", { name: "We've updated our Terms and Privacy notice" })).toBeTruthy()
    expect(screen.getByText("Adds a section on city filing")).toBeTruthy()
    expect(screen.getByText("Explains how long reports are kept")).toBeTruthy()
    const terms = screen.getByText("Read the Terms")
    const privacy = screen.getByText("Read the Privacy notice")
    expect(terms.compareDocumentPosition(privacy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("T4: leaves the summary out when the version has none", async () => {
    showGate(status({ required: [{ ...TERMS, summary: null }] }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("heading", { name: "We've updated our Terms" })).toBeTruthy()
    expect(within(dialog).getByText("Read the Terms")).toBeTruthy()
    expect(within(dialog).queryByText("Adds a section on city filing")).toBeNull()
    expect(document.body.textContent).not.toContain("null")
  })

  it("T5: Accept and continue accepts what is owed, acknowledges the notices, and closes", async () => {
    const { api } = showGate(status({ required: [TERMS, PRIVACY], notices: [COOKIES] }))
    await screen.findByRole("dialog")
    fireEvent.click(accept())
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(api.acceptLegal).toHaveBeenCalledTimes(1)
    expect(api.acceptLegal.mock.calls[0]?.[0]).toStrictEqual({
      items: [
        { type: "terms", version: TERMS.version, sha256: TERMS.sha256, action: "accepted" },
        { type: "privacy", version: PRIVACY.version, sha256: PRIVACY.sha256, action: "accepted" },
        { type: "cookies", version: COOKIES.version, sha256: COOKIES.sha256, action: "acknowledged" },
      ],
      surface: "prompt",
    })
    await settle()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByText(/We've updated our/)).toBeNull()
  })

  it("T6: sends one acceptance however often it is pressed, and is disabled while it is pending", async () => {
    const { api } = showGate(status({ required: [TERMS, PRIVACY], notices: [COOKIES] }))
    const pending = deferred<MyLegalStatusResponse>()
    api.acceptLegal.mockImplementation(() => pending.promise)
    await screen.findByRole("dialog")
    fireEvent.click(accept())
    fireEvent.click(accept())
    expect(api.acceptLegal).toHaveBeenCalledTimes(1)
    expect(accept().getAttribute("aria-disabled")).toBe("true")
    fireEvent.click(accept())
    expect(api.acceptLegal).toHaveBeenCalledTimes(1)
    await act(async () => pending.resolve(SETTLED))
  })

  it("T7: a failed acceptance keeps the dialog, says so, and can be sent again", async () => {
    const { api } = showGate(status({ required: [TERMS] }))
    api.acceptLegal
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new AppError(ErrorCode.INTERNAL, "boom"))
      .mockRejectedValueOnce(new AppError(ErrorCode.INTERNAL, "boom"))
    await screen.findByRole("dialog")

    for (const calls of [1, 2]) {
      fireEvent.click(accept())
      expect(await screen.findByRole("alert")).toBeTruthy()
      expect(screen.getByRole("alert").textContent).toBe(GENERIC_ERROR)
      expect(screen.getByRole("dialog")).toBeTruthy()
      await waitFor(() => expect(accept().getAttribute("aria-disabled")).not.toBe("true"))
      expect(api.acceptLegal).toHaveBeenCalledTimes(calls)
    }
    fireEvent.click(accept())
    await waitFor(() => expect(api.acceptLegal).toHaveBeenCalledTimes(3))
  })

  it("T8: an outdated version refetches the status and the next acceptance sends the new version", async () => {
    const NEXT = { ...TERMS, version: "2026-11-02", sha256: "d".repeat(64), summary: "Second change" }
    const { api, setStatus } = showGate(status({ required: [TERMS] }))
    api.acceptLegal.mockImplementationOnce(async () => {
      setStatus(status({ required: [NEXT] }))
      throw new AppError(ErrorCode.CONFLICT, "outdated", {
        details: {
          reason: "legal_version_outdated",
          current: [{ type: "terms", version: NEXT.version, sha256: NEXT.sha256 }],
        },
      })
    })
    await screen.findByRole("dialog")
    fireEvent.click(accept())
    await waitFor(() => expect(api.getMyLegalStatus).toHaveBeenCalledTimes(2))
    expect(await screen.findByText("Second change")).toBeTruthy()
    expect(screen.getByRole("dialog")).toBeTruthy()

    await waitFor(() => expect(accept().getAttribute("aria-disabled")).not.toBe("true"))
    fireEvent.click(accept())
    await waitFor(() => expect(api.acceptLegal).toHaveBeenCalledTimes(2))
    expect(api.acceptLegal.mock.calls[1]?.[0].items).toEqual([
      { type: "terms", version: "2026-11-02", sha256: NEXT.sha256, action: "accepted" },
    ])
  })

  it("T9: Sign out signs out without accepting, and the gate is gone once signed out", async () => {
    const { api, logout, store } = showGate(status({ required: [TERMS] }))
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }))
    expect(logout).toHaveBeenCalledTimes(1)
    expect(api.acceptLegal).not.toHaveBeenCalled()
    store.set(GUEST)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(api.acceptLegal).not.toHaveBeenCalled()
  })

  it("T10: Read the Terms shows the owed version inside the gate, and Back returns to the screen", async () => {
    const before = openPanel()
    const { api } = showGate(status({ required: [TERMS] }))
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByText("Read the Terms"))

    expect(await screen.findByText("1. About the Terms of Service")).toBeTruthy()
    expect(api.getLegalDocument).toHaveBeenCalledWith({ type: "terms", version: "2026-10-30" })
    const dialog = screen.getByRole("dialog")
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(within(dialog).getByRole("button", { name: "Back" })).toBeTruthy()
    expect(navNow()).toEqual(before)

    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(await screen.findByRole("heading", { name: "We've updated our Terms" })).toBeTruthy()
    expect(screen.getByText("Adds a section on city filing")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Accept and continue" })).toBeTruthy()
    expect(navNow()).toEqual(before)
  })

  describe("T11: a link to another legal document stays inside the gate", () => {
    const LINKED_TERMS = {
      ...TERMS_DOC,
      blocks: [{ kind: "paragraph" as const, text: `See [the Privacy notice](${PRIVACY_LINK}).` }],
    }

    it("shows the owed version when privacy is owed too", async () => {
      const { api } = showGate(status({ required: [TERMS, PRIVACY] }))
      api.getLegalDocument.mockImplementation(async ({ type, version }) => ({
        document: type === "terms" ? { ...LINKED_TERMS, version } : { ...TERMS_DOC, ...privacyText(), version },
      }))
      await screen.findByRole("dialog")
      fireEvent.click(screen.getByText("Read the Terms"))
      fireEvent.click(await screen.findByRole("link", { name: "the Privacy notice" }))

      expect(await screen.findByText("1. About the Privacy Policy")).toBeTruthy()
      expect(api.getLegalDocument).toHaveBeenCalledWith({ type: "privacy", version: PRIVACY.version })
      expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true")
      expectNothingLeftTheGate()
    })

    it("shows the current version when privacy isn't owed", async () => {
      const { api } = showGate(status({ required: [TERMS] }))
      api.getLegalDocument.mockImplementation(async ({ version }) => ({ document: { ...LINKED_TERMS, version } }))
      await screen.findByRole("dialog")
      fireEvent.click(screen.getByText("Read the Terms"))
      fireEvent.click(await screen.findByRole("link", { name: "the Privacy notice" }))

      expect(await screen.findByText("1. About the Privacy Policy")).toBeTruthy()
      expect(api.getLegalDocument).not.toHaveBeenCalledWith(expect.objectContaining({ type: "privacy" }))
      expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true")
      expectNothingLeftTheGate()
    })

    function privacyText() {
      return {
        type: "privacy" as const,
        title: "Privacy Policy",
        blocks: [{ kind: "heading" as const, level: 2 as const, text: "1. About the Privacy Policy" }],
      }
    }

    function expectNothingLeftTheGate() {
      expect(openInPlace).not.toHaveBeenCalled()
      expect(present).not.toHaveBeenCalled()
      expect(open).not.toHaveBeenCalled()
    }
  })

  it("T12: Escape closes nothing, on the page, on the screen or on the document view", async () => {
    function ShellKeys() {
      useShellKeys()
      return null
    }
    const before = openPanel()
    const legal = legalApi(status({ required: [TERMS] }))
    mountLegal(
      <>
        <ShellKeys />
        <LegalUpdateGate />
      </>,
      { api: legal.api },
    )
    const dialog = await screen.findByRole("dialog")

    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(navNow()).toEqual(before)

    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(screen.getByRole("heading", { name: "We've updated our Terms" })).toBeTruthy()
    expect(navNow()).toEqual(before)

    fireEvent.click(screen.getByText("Read the Terms"))
    const text = await screen.findByText("1. About the Terms of Service")
    fireEvent.keyDown(text, { key: "Escape" })
    expect(screen.getByText("1. About the Terms of Service")).toBeTruthy()
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(navNow()).toEqual(before)
  })

  it("T14: renders nothing while the status loads", async () => {
    const legal = legalApi(status({ required: [TERMS] }))
    legal.api.getMyLegalStatus.mockImplementation(() => new Promise(() => {}))
    const { container } = mountLegal(<LegalUpdateGate />, { api: legal.api })
    await settle()
    expect(legal.api.getMyLegalStatus).toHaveBeenCalledTimes(1)
    expect(container.innerHTML).toBe("")
    expect(screen.queryByRole("progressbar")).toBeNull()
  })

  it.each([
    ["a network error", () => new TypeError("Failed to fetch")],
    ["an INTERNAL error", () => new AppError(ErrorCode.INTERNAL, "boom")],
  ])("T15: renders nothing and blocks nothing when the status fails with %s", async (_name, failure) => {
    const legal = legalApi(status({ required: [TERMS] }))
    legal.api.getMyLegalStatus.mockRejectedValue(failure())
    const sibling = vi.fn()
    mountLegal(
      <>
        <LegalUpdateGate />
        <button type="button" onClick={sibling}>
          Sibling
        </button>
      </>,
      { api: legal.api },
    )
    await settle()
    expect(legal.api.getMyLegalStatus).toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Sibling" }))
    expect(sibling).toHaveBeenCalledTimes(1)
  })
})

describe("LegalUpdateGate and LegalNoticeBanner", () => {
  it("T16: a guest is never asked and sees neither", async () => {
    const { api, container } = showGate(status({ required: [TERMS], notices: [COOKIES] }), GUEST)
    await settle()
    expect(api.getMyLegalStatus).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe("")
  })

  it("T17: neither shows while first run is open", async () => {
    const { api, container } = showGate(status({ required: [TERMS], notices: [COOKIES] }), FIRST_RUN)
    await settle()
    await waitFor(() => expect(api.getMyLegalStatus.mock.results[0]?.type).toBe("return"))
    await settle()
    expect(container.innerHTML).toBe("")
  })

  it("T18: neither shows when nothing is owed or new", async () => {
    const { api, container } = showGate(SETTLED)
    await waitFor(() => expect(api.getMyLegalStatus).toHaveBeenCalledTimes(1))
    await settle()
    expect(container.innerHTML).toBe("")
  })

  it("T19: both actions of the screen are buttons labelled from legal.json", async () => {
    showGate(status({ required: [TERMS] }))
    await screen.findByRole("dialog")
    const acceptButton = screen.getByRole("button", { name: en.update.accept })
    const signOut = screen.getByRole("button", { name: en.update.sign_out })
    expect(acceptButton.getAttribute("aria-label")).toBe(en.update.accept)
    expect(signOut.getAttribute("aria-label")).toBe(en.update.sign_out)
    expect(en.update.accept).toBe("Accept and continue")
    expect(en.update.sign_out).toBe("Sign out")
  })
})
