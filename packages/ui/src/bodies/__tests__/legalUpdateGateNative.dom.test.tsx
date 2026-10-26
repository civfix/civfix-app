import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import type * as ReactNative from "react-native"
import { BackHandler } from "react-native"
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

// The app's bundle resolves the .native file; this one runs Android's back button as the phone app does.
vi.mock("../reportFlow/useHardwareBack", () => import("../reportFlow/useHardwareBack.native"))

type BackListener = () => boolean | null | undefined

const listeners: BackListener[] = []
const remove = vi.fn()

beforeEach(() => {
  listeners.length = 0
  remove.mockClear()
  vi.spyOn(BackHandler, "addEventListener").mockImplementation((_event, listener) => {
    listeners.push(listener)
    return { remove }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function pressBack(): boolean | null | undefined {
  const latest = listeners[listeners.length - 1]
  if (!latest) throw new Error("no back handler registered")
  let consumed: boolean | null | undefined
  act(() => {
    consumed = latest()
  })
  return consumed
}

describe("LegalUpdateGate on the phone", () => {
  it("T13: hardware back is consumed on the screen and on the document view, and released once the gate closes", async () => {
    const legal = legalApi(status({ required: [TERMS] }))
    mountLegal(<LegalUpdateGate />, { api: legal.api })
    await screen.findByRole("dialog")
    expect(BackHandler.addEventListener).toHaveBeenCalledWith("hardwareBackPress", expect.any(Function))

    expect(pressBack()).toBe(true)
    expect(screen.getByRole("heading", { name: "We've updated our Terms" })).toBeTruthy()

    fireEvent.click(screen.getByText("Read the Terms"))
    expect(await screen.findByText("1. About the Terms of Service")).toBeTruthy()
    expect(pressBack()).toBe(true)
    expect(await screen.findByRole("heading", { name: "We've updated our Terms" })).toBeTruthy()
    expect(screen.queryByText("1. About the Terms of Service")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Accept and continue" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(remove).toHaveBeenCalledTimes(listeners.length)
  })
})
