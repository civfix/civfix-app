import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import type * as ReactNative from "react-native"
import { AppError, ErrorCode, type MyLegalStatusResponse } from "@civfix/contract"
import { useNavStore } from "../../nav"
import { setLegalDocumentPresenter } from "../../primitives/legalDocument"
import { LegalDocumentBody } from "../LegalDocumentBody"
import { LegalUpdateGate } from "../LegalUpdateGate"
import { TERMS, legalApi, mountLegal, settle, status } from "./legalUpdateHarness"

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

const OWED_VERSION = "2026-10-30"
const UNAVAILABLE = "This earlier version isn't available here."
const CURRENT_LINK = "Read the current version"
const TERMS_TEXT = "1. About the Terms of Service"

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
  return navNow()
}

function navNow(): { view: unknown; active: unknown } {
  const { view, active } = useNavStore.getState()
  return { view, active }
}

/** The owed Terms version the server no longer has: `GET /legal/documents/terms/2026-10-30` is a 404. */
function showGateWithOwedVersionMissing(initial: MyLegalStatusResponse = status({ required: [TERMS] })) {
  const legal = legalApi(initial)
  legal.api.getLegalDocument.mockRejectedValue(new AppError(ErrorCode.NOT_FOUND, "no such version"))
  return { ...legal, ...mountLegal(<LegalUpdateGate />, { api: legal.api, open }) }
}

function expectNothingLeftTheGate(): void {
  expect(openInPlace).not.toHaveBeenCalled()
  expect(present).not.toHaveBeenCalled()
  expect(open).not.toHaveBeenCalled()
}

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

describe("LegalUpdateGate: reading inside the screen", () => {
  it("T12: an owed version the server doesn't have says so inside the dialog, with a link to the current one", async () => {
    showGateWithOwedVersionMissing()
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByText("Read the Terms"))

    const dialog = screen.getByRole("dialog")
    expect(await within(dialog).findByText(UNAVAILABLE)).toBeTruthy()
    expect(within(dialog).getByRole("link", { name: CURRENT_LINK })).toBeTruthy()
  })

  it("T13: Read the current version shows the current Terms inside the gate, and nothing leaves it", async () => {
    const before = openPanel()
    const { api } = showGateWithOwedVersionMissing()
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByText("Read the Terms"))
    fireEvent.click(await screen.findByRole("link", { name: CURRENT_LINK }))

    const dialog = screen.getByRole("dialog")
    expect(await within(dialog).findByText(TERMS_TEXT)).toBeTruthy()
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(within(dialog).getByRole("button", { name: "Back" })).toBeTruthy()
    expect(screen.queryByText(UNAVAILABLE)).toBeNull()
    // The current version, unpinned: the documents list, and no second request for the owed version.
    expect(api.getLegalDocuments).toHaveBeenCalled()
    expect(api.getLegalDocument.mock.calls).toEqual([[{ type: "terms", version: OWED_VERSION }]])
    expect(screen.queryByText(/This is an earlier version/)).toBeNull()
    expectNothingLeftTheGate()
    expect(navNow()).toEqual(before)
  })

  it("T14: Back returns to the update screen, and accepting leaves the person where they were", async () => {
    const before = openPanel()
    const { container } = showGateWithOwedVersionMissing()
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByText("Read the Terms"))
    fireEvent.click(await screen.findByRole("link", { name: CURRENT_LINK }))
    await screen.findByText(TERMS_TEXT)

    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(await screen.findByRole("heading", { name: "We've updated our Terms" })).toBeTruthy()
    expect(screen.getByText("Adds a section on city filing")).toBeTruthy()
    expect(screen.getByText("Read the Terms")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Accept and continue" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    await settle()
    expect(container.innerHTML).toBe("")
    expectNothingLeftTheGate()
    expect(navNow()).toEqual(before)
  })

  it("T19: the document reads in a centred column 760 wide, under a full-width Back bar", async () => {
    const legal = legalApi(status({ required: [TERMS] }))
    mountLegal(<LegalUpdateGate />, { api: legal.api, open })
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByText("Read the Terms"))
    const text = await screen.findByText(TERMS_TEXT)

    let column: HTMLElement | null = text.parentElement
    while (column !== null && getComputedStyle(column).maxWidth !== "760px") column = column.parentElement
    expect(column).not.toBeNull()
    expect(getComputedStyle(column as HTMLElement).alignSelf).toBe("center")

    const back = screen.getByRole("button", { name: "Back" })
    expect(column?.contains(back)).toBe(false)
    let bar: HTMLElement | null = back.parentElement
    while (bar !== null && !bar.contains(column)) {
      expect(["", "none"]).toContain(getComputedStyle(bar).maxWidth)
      bar = bar.parentElement
    }
  })
})

describe("LegalDocumentBody outside the gate", () => {
  it("T16: Read the current version opens the document's own page in place, as before", async () => {
    const legal = legalApi(status({}))
    legal.api.getLegalDocument.mockRejectedValue(new AppError(ErrorCode.NOT_FOUND, "no such version"))
    mountLegal(<LegalDocumentBody type="terms" version={OWED_VERSION} />, { api: legal.api, open })

    fireEvent.click(await screen.findByRole("link", { name: CURRENT_LINK }))
    expect(openInPlace).toHaveBeenCalledTimes(1)
    expect(openInPlace).toHaveBeenCalledWith("terms")
  })
})
