/**
 * GH#308: Light, Dark and System are picture tiles at the top of Settings, signed in or out, and the old
 * Appearance row (with the page behind it) is gone.
 */
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type * as ReactNative from "react-native"
import { I18nProvider } from "../../i18n"
import { makeMemoryAppearanceStore, setAppearancePreferenceStore } from "../../theme/appearance"
import { SettingsBody } from "../SettingsBody"

const auth = vi.hoisted(() => ({ isAuthenticated: true }))

// The icon set and the primitives barrel pull in native-only modules; sections and rows only need a label.
vi.mock("../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})

vi.mock("../../primitives", () => ({
  SettingsSection: ({ label, children }: { label?: string; children: React.ReactNode }) => (
    <section aria-label={label}>{children}</section>
  ),
  SettingsRow: ({ label, onPress }: { label: string; onPress?: () => void }) =>
    onPress ? <button onClick={onPress}>{label}</button> : <span>{label}</span>,
  SignInPrompt: ({ title }: { title: string }) => <p>{title}</p>,
  DONATE_URL: "https://civfix.test/donate",
  PRIVACY_URL: "https://civfix.test/privacy",
  TERMS_URL: "https://civfix.test/terms",
  sourceCommit: () => "",
  sourceUrl: () => "https://civfix.test/source",
  useToast: () => ({ show: () => {} }),
}))

vi.mock("../../data", () => ({
  useAuthState: () => ({ isAuthenticated: auth.isAuthenticated, isPending: false }),
  useLogout: () => async () => {},
  useRequireAuth: () => () => {},
}))

vi.mock("../../capabilities", () => ({
  useOpenExternal: () => null,
  useHaptics: () => ({ selection: () => {} }),
}))

vi.mock("../../nav", () => ({ useNavStore: { getState: () => ({ push: () => {} }) } }))

vi.mock("../../shell/ScrollHost", async () => {
  const { ScrollView } = await vi.importActual<typeof ReactNative>("react-native")
  return { useScrollHost: () => ({ ScrollView }) }
})

function renderSettings() {
  return render(
    <I18nProvider locale="en" setLocale={() => {}}>
      <SettingsBody />
    </I18nProvider>,
  )
}

afterEach(() => {
  auth.isAuthenticated = true
  setAppearancePreferenceStore(null)
})

describe.each([
  ["signed in", true, "Account"],
  ["signed out", false, "Sign in to civfix"],
] as const)("GH#308 Settings, %s", (_state, signedIn, nextThing) => {
  it("opens with the Light, Dark and System tiles, before anything else", () => {
    auth.isAuthenticated = signedIn
    const { container } = renderSettings()

    const appearance = screen.getByRole("region", { name: "Appearance" })
    const group = within(appearance).getByRole("radiogroup", { name: "Appearance" })
    expect(
      within(group)
        .getAllByRole("radio")
        .map((r) => r.getAttribute("aria-label")),
    ).toEqual(["Light", "Dark", "System"])
    const first = container.querySelector("section, p")
    expect(first).toBe(appearance)
    const next = signedIn
      ? screen.getByRole("region", { name: nextThing })
      : screen.getByText(nextThing)
    expect(appearance.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("has no Appearance row leading to a page of its own", () => {
    auth.isAuthenticated = signedIn
    renderSettings()
    expect(screen.queryByRole("button", { name: /Appearance/ })).toBeNull()
  })
})

describe("GH#308 choosing an appearance tile", () => {
  it("checks the tile and switches the app's appearance at once", async () => {
    const store = makeMemoryAppearanceStore("light")
    setAppearancePreferenceStore(store)
    renderSettings()
    const radio = (name: string) => screen.getByRole("radio", { name })
    expect(radio("Light").getAttribute("aria-checked")).toBe("true")

    fireEvent.click(radio("Dark"))
    expect(radio("Dark").getAttribute("aria-checked")).toBe("true")
    expect(radio("Light").getAttribute("aria-checked")).toBe("false")
    await waitFor(() => expect(store.get()).toBe("dark"))

    fireEvent.click(radio("System"))
    await waitFor(() => expect(store.get()).toBe("system"))
    expect(radio("System").getAttribute("aria-checked")).toBe("true")
    expect(radio("Dark").getAttribute("aria-checked")).toBe("false")
  })
})
