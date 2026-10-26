import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import type * as ReactNative from "react-native"
import { AppError, ErrorCode } from "@civfix/contract"
import { LegalUpdateGate } from "../../bodies/LegalUpdateGate"
import {
  COOKIES,
  FIRST_RUN,
  GUEST,
  TERMS,
  legalApi,
  mountLegal,
  settle,
  status,
} from "../../bodies/__tests__/legalUpdateHarness"
import { useLegalUpdatePending } from ".."

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

function Pending() {
  return <span data-testid="pending">{String(useLegalUpdatePending())}</span>
}

const pending = () => screen.getByTestId("pending").textContent

describe("useLegalUpdatePending", () => {
  it("T1: a guest is never held back, and their status is never asked for", async () => {
    const legal = legalApi(status({ required: [TERMS] }))
    mountLegal(<Pending />, { api: legal.api, auth: GUEST })
    await settle()
    expect(pending()).toBe("false")
    expect(legal.api.getMyLegalStatus).not.toHaveBeenCalled()
  })

  it("T2: first run owns the screen, so a person still in it is not held back", async () => {
    const legal = legalApi(status({ required: [TERMS] }))
    mountLegal(<Pending />, { api: legal.api, auth: FIRST_RUN })
    await waitFor(() => expect(legal.api.getMyLegalStatus.mock.results[0]?.type).toBe("return"))
    await settle()
    expect(pending()).toBe("false")
  })

  it("T3: holds back while the status loads", async () => {
    const legal = legalApi(status({ required: [TERMS] }))
    legal.api.getMyLegalStatus.mockImplementation(() => new Promise(() => {}))
    mountLegal(<Pending />, { api: legal.api })
    await settle()
    expect(legal.api.getMyLegalStatus).toHaveBeenCalledTimes(1)
    expect(pending()).toBe("true")
  })

  it("T4: holds back while a document is owed", async () => {
    const legal = legalApi(status({ required: [TERMS] }))
    mountLegal(<Pending />, { api: legal.api })
    await waitFor(() => expect(legal.api.getMyLegalStatus).toHaveBeenCalledTimes(1))
    await settle()
    expect(pending()).toBe("true")
  })

  it("T5: a notice alone holds nothing back", async () => {
    const legal = legalApi(status({ required: [], notices: [COOKIES] }))
    mountLegal(<Pending />, { api: legal.api })
    await waitFor(() => expect(legal.api.getMyLegalStatus).toHaveBeenCalledTimes(1))
    await settle()
    expect(pending()).toBe("false")
  })

  it.each([
    ["a network error", () => new TypeError("Failed to fetch")],
    ["an INTERNAL error", () => new AppError(ErrorCode.INTERNAL, "boom")],
  ])("T6: a status that fails with %s holds nothing back", async (_name, failure) => {
    const legal = legalApi(status({ required: [TERMS] }))
    legal.api.getMyLegalStatus.mockRejectedValue(failure())
    mountLegal(<Pending />, { api: legal.api })
    await waitFor(() => expect(legal.api.getMyLegalStatus).toHaveBeenCalledTimes(1))
    await settle()
    expect(pending()).toBe("false")
  })

  it("T7: holds back while the update screen is up and lets go once it is accepted", async () => {
    // The harness's acceptance answers `{ required: [], notices: [], accepted: {…} }` and keeps it.
    const legal = legalApi(status({ required: [TERMS] }))
    mountLegal(
      <>
        <Pending />
        <LegalUpdateGate />
      </>,
      { api: legal.api },
    )
    await screen.findByRole("dialog")
    expect(pending()).toBe("true")
    fireEvent.click(screen.getByRole("button", { name: "Accept and continue" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(legal.api.acceptLegal).toHaveBeenCalledTimes(1)
    expect(pending()).toBe("false")
  })
})
