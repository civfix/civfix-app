import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type * as ReactNative from "react-native"
import { AppError, ErrorCode, type CleanupDTO, type TicketTypeDTO } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import { CapabilitiesProvider, makeFakeCapabilities } from "../../../capabilities"
import { ApiProvider } from "../../../data/context"
import { makeFakeDataContext } from "../../../data/fakes"
import { I18nProvider } from "../../../i18n"
import { ToastContext } from "../../../primitives/toastContext"
import { DOCUMENTS, outdatedConflict } from "../../../data/__tests__/legalFixtures"
import { RegistrationBlock } from "../registration/RegistrationBlock"
import { GuestRsvpSheet } from "../registration/GuestRsvpSheet"

// The icon set pulls in native-only modules; the form is read by its text and roles.
vi.mock("../../../typography", async () => {
  const RN = await vi.importActual<typeof ReactNative>("react-native")
  return {
    Text: RN.Text,
    TextLink: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => (
      <RN.Text onPress={onPress}>{children}</RN.Text>
    ),
    Icon: () => null,
    iconMap: new Proxy({}, { get: () => "icon" }),
  }
})
// Its CJS build requires the Flow-typed react-native, bypassing the react-native-web alias.
vi.mock("react-native-safe-area-context", async () => {
  const { createContext } = await vi.importActual<typeof React>("react")
  return {
    SafeAreaInsetsContext: createContext(null),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  }
})
// The real sheet animates in a native modal; this one shows what the sheet is given while visible.
vi.mock("../../../primitives/ModalCardSheet", async () => {
  const RN = await vi.importActual<typeof ReactNative>("react-native")
  return {
    modalSheetInputStyle: () => ({}),
    ModalCardSheet: ({
      visible,
      error,
      children,
      actions,
    }: {
      visible: boolean
      error?: string | null
      children: React.ReactNode
      actions: React.ReactNode
    }) =>
      visible ? (
        <RN.View>
          {error ? <RN.Text accessibilityRole="alert">{error}</RN.Text> : null}
          {children}
          {actions}
        </RN.View>
      ) : null,
  }
})

const REGISTER_GENERIC = "Something went wrong. Please try again."
const GUEST_GENERIC = "Something went wrong. Try again."
const OUTDATED_MESSAGE = "Our terms changed. Please review and agree again."
const CLOSED = "This event is closed to registration changes."
const TERMS_BOX = "Agree to the Terms and Privacy Policy"
const HOST_CONTACT_BOX = "Share my name with the host"

const TICKET: TicketTypeDTO = {
  id: "tt1",
  cleanupId: "e1",
  name: "General",
  reserved: 0,
  sold: 0,
  visibility: "public",
  accessCodeSet: false,
  maxPartySize: 1,
  sortOrder: 0,
  questionIds: [],
  soldOut: false,
  salesOpen: true,
  waitlistEnabled: false,
}

const CLEANUP = {
  id: "e1",
  title: "River day",
  status: "upcoming",
  startsAt: "2099-05-10T17:00:00.000Z",
  endsAt: "2099-05-10T20:00:00.000Z",
  registrationState: "open",
  myRegistration: null,
  ticketTypes: [TICKET],
} as unknown as CleanupDTO

function held<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function renderWith(ui: React.ReactElement, api: Record<string, unknown>, signedIn: boolean) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const context = makeFakeDataContext({
    api: { listEventQuestions: async () => ({ items: [] }), ...api } as unknown as ApiClient,
    auth: signedIn ? { isAuthenticated: true } : {},
    requireAuth: (action) => action(),
    getTurnstileToken: async () => "turnstile-token",
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>
        <CapabilitiesProvider value={makeFakeCapabilities()}>
          <I18nProvider locale="en">
            <ToastContext.Provider value={{ show: vi.fn() }}>{ui}</ToastContext.Provider>
          </I18nProvider>
        </CapabilitiesProvider>
      </ApiProvider>
    </QueryClientProvider>,
  )
}

const checkbox = (name: string) => screen.getByRole("checkbox", { name })
const checked = (name: string) => checkbox(name).getAttribute("aria-checked")
const button = (name: string) => screen.getByRole("button", { name })
const consentOf = (mock: { mock: { calls: unknown[][] } }, call = 0) =>
  (mock.mock.calls[call]?.[0] as { consent?: Record<string, unknown> } | undefined)?.consent

describe("RegistrationBlock legal versions", () => {
  function renderBlock(api: Record<string, unknown>) {
    return renderWith(<RegistrationBlock cleanup={CLEANUP} />, api, true)
  }

  it("T16: waits for the documents before it lets anyone register", async () => {
    const registerForEvent = vi.fn()
    renderBlock({ getLegalDocuments: () => held().promise, registerForEvent })
    await screen.findByRole("button", { name: "Register" })
    expect(button("Register").getAttribute("aria-disabled")).toBe("true")
    fireEvent.click(checkbox(TERMS_BOX))
    fireEvent.click(button("Register"))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(registerForEvent).not.toHaveBeenCalled()
  })

  it("T17: shows the generic error and a retry when the documents fail, and recovers", async () => {
    const getLegalDocuments = vi
      .fn()
      .mockRejectedValueOnce(new AppError(ErrorCode.INTERNAL, "boom"))
      .mockResolvedValueOnce({ documents: DOCUMENTS })
    renderBlock({ getLegalDocuments, registerForEvent: vi.fn() })
    await screen.findByText(REGISTER_GENERIC)
    fireEvent.click(button("Try again"))
    await waitFor(() => expect(getLegalDocuments).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(button("Register").getAttribute("aria-disabled")).not.toBe("true"))
  })

  it("T18: shows and sends the fetched versions", async () => {
    const registerForEvent = vi.fn(async () => ({ outcome: "registered" }))
    renderBlock({ getLegalDocuments: async () => ({ documents: DOCUMENTS }), registerForEvent })
    await screen.findByText("Terms version 2026-09-21")
    fireEvent.click(checkbox(TERMS_BOX))
    fireEvent.click(button("Register"))
    await waitFor(() => expect(registerForEvent).toHaveBeenCalledTimes(1))
    expect(consentOf(registerForEvent)).toMatchObject({ termsVersion: "2026-09-21", disclosureVersion: "2026-09-21" })
  })

  it("T19: an outdated answer unticks the boxes and switches to the versions it names", async () => {
    const getLegalDocuments = vi.fn(async () => ({ documents: DOCUMENTS }))
    const registerForEvent = vi
      .fn()
      .mockRejectedValueOnce(outdatedConflict())
      .mockResolvedValueOnce({ outcome: "registered" })
    renderBlock({ getLegalDocuments, registerForEvent })
    await screen.findByText("Terms version 2026-09-21")
    fireEvent.click(checkbox(TERMS_BOX))
    fireEvent.click(checkbox(HOST_CONTACT_BOX))
    fireEvent.click(button("Register"))

    await screen.findByText(OUTDATED_MESSAGE)
    expect(checked(TERMS_BOX)).toBe("false")
    expect(checked(HOST_CONTACT_BOX)).toBe("false")
    expect(screen.queryByText(CLOSED)).toBeNull()
    expect(screen.getByText("Terms version 2026-10-30")).toBeTruthy()
    expect(getLegalDocuments).toHaveBeenCalledTimes(1)

    fireEvent.click(checkbox(TERMS_BOX))
    fireEvent.click(button("Register"))
    await waitFor(() => expect(registerForEvent).toHaveBeenCalledTimes(2))
    expect(consentOf(registerForEvent, 1)).toMatchObject({
      termsVersion: "2026-10-30",
      disclosureVersion: "2026-10-30",
      hostContactOptIn: false,
    })
  })

  it("T20: any other CONFLICT keeps its own message and the ticked box", async () => {
    const registerForEvent = vi.fn(async () => {
      throw new AppError(ErrorCode.CONFLICT, "closed")
    })
    renderBlock({ getLegalDocuments: async () => ({ documents: DOCUMENTS }), registerForEvent })
    await screen.findByText("Terms version 2026-09-21")
    fireEvent.click(checkbox(TERMS_BOX))
    fireEvent.click(button("Register"))
    await screen.findByText(CLOSED)
    expect(checked(TERMS_BOX)).toBe("true")
  })
})

describe("GuestRsvpSheet legal versions", () => {
  function renderSheet(api: Record<string, unknown>) {
    return renderWith(
      <GuestRsvpSheet visible cleanupId="e1" nextPath="/cleanups/e1" onClose={() => {}} ticketTypes={[TICKET]} />,
      api,
      false,
    )
  }

  function fillForm() {
    fireEvent.click(button("Continue as guest"))
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Rosa" } })
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "rosa@example.com" } })
  }

  function requestCode() {
    fireEvent.click(checkbox(TERMS_BOX))
    fireEvent.click(button("Send code"))
  }

  function enterCode() {
    const input = screen.getAllByLabelText("Verification code").find((el) => el.tagName === "INPUT")
    fireEvent.change(input!, { target: { value: "123456" } })
  }

  it("T21: keeps send-code disabled while the documents load", async () => {
    const guestRsvpRequest = vi.fn()
    renderSheet({ getLegalDocuments: () => held().promise, guestRsvpRequest })
    fillForm()
    fireEvent.click(checkbox(TERMS_BOX))
    expect(button("Send code").getAttribute("aria-disabled")).toBe("true")
    fireEvent.click(button("Send code"))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(guestRsvpRequest).not.toHaveBeenCalled()
  })

  it("T22: shows the generic error and a retry when the documents fail", async () => {
    const getLegalDocuments = vi.fn(async () => {
      throw new AppError(ErrorCode.INTERNAL, "boom")
    })
    renderSheet({ getLegalDocuments, guestRsvpRequest: vi.fn() })
    fillForm()
    await screen.findByText(GUEST_GENERIC)
    fireEvent.click(button("Try again"))
    await waitFor(() => expect(getLegalDocuments).toHaveBeenCalledTimes(2))
  })

  it("T23: sends the fetched versions with the code request and the verification", async () => {
    const guestRsvpRequest = vi.fn(async () => ({ sent: true, resendAfterSec: 30 }))
    const guestRsvpVerify = vi.fn(async () => ({ joined: true, going: 1, manageToken: "x" }))
    renderSheet({ getLegalDocuments: async () => ({ documents: DOCUMENTS }), guestRsvpRequest, guestRsvpVerify })
    fillForm()
    await screen.findByText("Terms version 2026-09-21")
    requestCode()
    await waitFor(() => expect(guestRsvpRequest).toHaveBeenCalledTimes(1))
    await screen.findAllByLabelText("Verification code")
    enterCode()
    await waitFor(() => expect(guestRsvpVerify).toHaveBeenCalledTimes(1))
    const versions = { termsVersion: "2026-09-21", disclosureVersion: "2026-09-21" }
    expect(consentOf(guestRsvpRequest)).toMatchObject(versions)
    expect(consentOf(guestRsvpVerify)).toMatchObject(versions)
  })

  it("T24: an outdated code request stays on the form with the boxes unticked and the new versions", async () => {
    const getLegalDocuments = vi.fn(async () => ({ documents: DOCUMENTS }))
    const guestRsvpRequest = vi
      .fn()
      .mockRejectedValueOnce(outdatedConflict())
      .mockResolvedValueOnce({ sent: true, resendAfterSec: 30 })
    renderSheet({ getLegalDocuments, guestRsvpRequest })
    fillForm()
    await screen.findByText("Terms version 2026-09-21")
    requestCode()
    await screen.findByText(OUTDATED_MESSAGE)
    expect(screen.queryByText(GUEST_GENERIC)).toBeNull()
    expect(button("Send code")).toBeTruthy()
    expect(checked(TERMS_BOX)).toBe("false")

    requestCode()
    await waitFor(() => expect(guestRsvpRequest).toHaveBeenCalledTimes(2))
    expect(consentOf(guestRsvpRequest, 1)).toMatchObject({ termsVersion: "2026-10-30", disclosureVersion: "2026-10-30" })
    expect(getLegalDocuments).toHaveBeenCalledTimes(1)
  })

  it("T25: an outdated verification goes back to the form with the boxes unticked and the new versions", async () => {
    const guestRsvpRequest = vi.fn(async () => ({ sent: true, resendAfterSec: 30 }))
    const guestRsvpVerify = vi.fn(async () => {
      throw outdatedConflict()
    })
    renderSheet({ getLegalDocuments: async () => ({ documents: DOCUMENTS }), guestRsvpRequest, guestRsvpVerify })
    fillForm()
    await screen.findByText("Terms version 2026-09-21")
    requestCode()
    await screen.findAllByLabelText("Verification code")
    enterCode()

    await screen.findByText(OUTDATED_MESSAGE)
    expect(button("Send code")).toBeTruthy()
    expect(checked(TERMS_BOX)).toBe("false")

    requestCode()
    await waitFor(() => expect(guestRsvpRequest).toHaveBeenCalledTimes(2))
    expect(consentOf(guestRsvpRequest, 1)).toMatchObject({ termsVersion: "2026-10-30", disclosureVersion: "2026-10-30" })
  })
})
