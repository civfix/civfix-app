import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import type * as ReactNative from "react-native"
import {
  AppError,
  ErrorCode,
  toAppError,
  type GetLegalDocumentsResponse,
  type MyLegalStatusResponse,
  type UpdateProfileResponse,
} from "@civfix/contract"
import { useCompleteFirstRun } from "../../data"
import type { AuthState } from "../../data/types"
import { LegalNoticeBanner } from "../LegalNoticeBanner"
import { LegalUpdateGate } from "../LegalUpdateGate"
import {
  COOKIES,
  FIRST_RUN,
  PRIVACY,
  PRIVACY_DOC,
  SETTLED,
  SUBPROCESSORS,
  SUBPROCESSORS_DOC,
  TERMS,
  TERMS_DOC,
  COOKIES_DOC,
  USER,
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

const PROFILE = { handle: "ada_l", displayName: "Ada Lovelace" }
const SAVED: UpdateProfileResponse = { user: { ...USER, handle: "ada_l" } }

/** Both first-run gates' Continue, reduced to the step: it submits, and shows the profile error it reports. */
function FirstRunContinue() {
  const complete = useCompleteFirstRun()
  return (
    <>
      <button type="button" onClick={() => complete.mutate(PROFILE)}>
        Continue
      </button>
      {complete.isError ? <p role="alert">{toAppError(complete.error).code}</p> : null}
    </>
  )
}

interface Setup {
  initial?: MyLegalStatusResponse
  ui?: React.ReactElement
  /** Runs before anything mounts, so the first requests already see it. */
  configure?: (api: ReturnType<typeof legalApi>["api"]) => void
}

function setup({ initial = SETTLED, ui = <FirstRunContinue />, configure }: Setup = {}) {
  const legal = legalApi(initial)
  configure?.(legal.api)
  const updateProfile = vi.fn(async (_body: unknown): Promise<UpdateProfileResponse> => SAVED)
  const api = { ...legal.api, updateProfile }
  const mounted = mountLegal(ui, { api, auth: FIRST_RUN })
  return { ...legal, ...mounted, api, updateProfile }
}

const firstRunClosed = (auth: { get: () => AuthState }) => auth.get().user?.profileComplete === true

/** Every element the DOM ever gained, so a screen that came and went between two checks still counts. */
function recordAdded(): () => Element[] {
  const added: Element[] = []
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) added.push(node)
      })
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  stopObservers.push(() => observer.disconnect())
  return () => {
    observer.takeRecords().forEach((record) =>
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) added.push(node)
      }),
    )
    return added
  }
}

const stopObservers: (() => void)[] = []

afterEach(() => {
  stopObservers.splice(0).forEach((stop) => stop())
})

describe("the sign-up acceptance step", () => {
  it("T27: after the profile is saved, accepts the current Terms and Privacy and acknowledges the rest", async () => {
    const { api, updateProfile } = setup()
    const saved = deferred<UpdateProfileResponse>()
    updateProfile.mockImplementation(() => saved.promise)
    await waitFor(() => expect(api.getLegalDocuments).toHaveBeenCalledTimes(1))
    await settle()

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(PROFILE))
    await settle()
    expect(api.acceptLegal).not.toHaveBeenCalled()

    await act(async () => saved.resolve(SAVED))
    await waitFor(() => expect(api.acceptLegal).toHaveBeenCalledTimes(1))
    expect(api.acceptLegal.mock.calls[0]?.[0]).toStrictEqual({
      items: [
        { type: "terms", version: TERMS_DOC.version, sha256: TERMS_DOC.sha256, action: "accepted" },
        { type: "privacy", version: PRIVACY_DOC.version, sha256: PRIVACY_DOC.sha256, action: "accepted" },
        { type: "cookies", version: COOKIES_DOC.version, sha256: COOKIES_DOC.sha256, action: "acknowledged" },
        {
          type: "subprocessors",
          version: SUBPROCESSORS_DOC.version,
          sha256: SUBPROCESSORS_DOC.sha256,
          action: "acknowledged",
        },
      ],
      surface: "signup",
    })
  })

  it("T28: a refused profile update records nothing and reports the profile error", async () => {
    const { api, updateProfile, store } = setup()
    updateProfile.mockRejectedValue(new AppError(ErrorCode.CONFLICT, "handle taken"))
    await waitFor(() => expect(api.getLegalDocuments).toHaveBeenCalledTimes(1))
    await settle()

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect((await screen.findByRole("alert")).textContent).toBe("CONFLICT")
    await settle()
    expect(api.acceptLegal).not.toHaveBeenCalled()
    expect(firstRunClosed(store)).toBe(false)
  })

  it("T29: neither the screen nor the banner appears between Continue and the end of first run", async () => {
    const owed = status({ required: [TERMS, PRIVACY], notices: [COOKIES, SUBPROCESSORS] })
    const { api, store, setStatus } = setup({
      initial: owed,
      ui: (
        <>
          <FirstRunContinue />
          <LegalUpdateGate />
          <LegalNoticeBanner />
        </>
      ),
    })
    const recorded = deferred<MyLegalStatusResponse>()
    api.acceptLegal.mockImplementation(async () => {
      const settled = await recorded.promise
      setStatus(settled)
      return settled
    })
    await waitFor(() => expect(api.getMyLegalStatus).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(api.getLegalDocuments).toHaveBeenCalledTimes(1))
    await settle()
    const added = recordAdded()

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() => expect(api.acceptLegal).toHaveBeenCalledTimes(1))
    await settle()
    await act(async () => recorded.resolve(SETTLED))
    await settle()

    expect(firstRunClosed(store)).toBe(true)
    expect(added().filter((node) => node.matches('[role="dialog"]') || node.querySelector('[role="dialog"]'))).toEqual([])
    expect(added().filter((node) => node.textContent?.includes("We've updated our"))).toEqual([])
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByText(/We've updated our/)).toBeNull()
  })

  it("T30: a failed recording still finishes first run, and the screen then asks", async () => {
    const owed = status({ required: [TERMS, PRIVACY], notices: [COOKIES, SUBPROCESSORS] })
    const { api, store } = setup({
      initial: owed,
      ui: (
        <>
          <FirstRunContinue />
          <LegalUpdateGate />
        </>
      ),
    })
    api.acceptLegal.mockRejectedValue(new TypeError("Failed to fetch"))
    await waitFor(() => expect(api.getLegalDocuments).toHaveBeenCalledTimes(1))
    await settle()

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() => expect(firstRunClosed(store)).toBe(true))
    expect(store.get().user).toEqual(SAVED.user)
    expect(screen.queryByRole("alert")).toBeNull()
    expect(await screen.findByRole("dialog", { name: "We've updated our Terms and Privacy notice" })).toBeTruthy()
  })

  it.each<[string, () => Promise<GetLegalDocumentsResponse>]>([
    ["rejected", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["still pending", () => new Promise<GetLegalDocumentsResponse>(() => {})],
  ])("T31: documents %s when Continue is pressed: the profile is still saved and nothing is recorded", async (_name, documents) => {
    const { api, updateProfile, store } = setup({
      configure: (legal) => legal.getLegalDocuments.mockImplementation(documents),
    })
    await settle()

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(PROFILE))
    await waitFor(() => expect(firstRunClosed(store)).toBe(true))
    await settle()
    expect(api.acceptLegal).not.toHaveBeenCalled()
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
