import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, within } from "@testing-library/react"
import type * as ReactNative from "react-native"
import { AppError, ErrorCode } from "@civfix/contract"
import { setLegalDocumentPresenter } from "../../primitives/legalDocument"
import { LegalUpdateGate } from "../LegalUpdateGate"
import { TERMS, legalApi, mountLegal, status } from "./legalUpdateHarness"

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

// The app's bundle resolves the .native files; these run the phone app's back button, gate layer and
// in-app legal navigation (the presenter that opens the app's own legal screen).
vi.mock("../reportFlow/useHardwareBack", () => import("../reportFlow/useHardwareBack.native"))
vi.mock("../legalGateLayer", () => import("../legalGateLayer.native"))
vi.mock("../../primitives/legalDocumentNav", () => import("../../primitives/legalDocumentNav.native"))

const present = vi.fn((_type: string) => true)
const open = vi.fn(async (_url: string) => {})

const UNAVAILABLE = "This earlier version isn't available here."
const CURRENT_LINK = "Read the current version"

beforeEach(() => {
  present.mockClear()
  open.mockClear()
  setLegalDocumentPresenter(present)
})

afterEach(() => {
  setLegalDocumentPresenter(null)
  vi.restoreAllMocks()
})

describe("LegalUpdateGate on the phone: reading inside the screen", () => {
  it("T15: the unavailable owed version and its current-version link stay inside the gate", async () => {
    const legal = legalApi(status({ required: [TERMS] }))
    legal.api.getLegalDocument.mockRejectedValue(new AppError(ErrorCode.NOT_FOUND, "no such version"))
    mountLegal(<LegalUpdateGate />, { api: legal.api, open })
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByText("Read the Terms"))

    const dialog = screen.getByRole("dialog")
    expect(await within(dialog).findByText(UNAVAILABLE)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole("link", { name: CURRENT_LINK }))

    expect(await within(screen.getByRole("dialog")).findByText("1. About the Terms of Service")).toBeTruthy()
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true")
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Back" })).toBeTruthy()
    expect(present).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })
})
