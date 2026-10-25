/**
 * The Developer row exists only where a host registers a presenter: the phone app does so on staging and
 * development builds, and web never does.
 */
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type * as ReactNative from "react-native"
import { I18nProvider } from "../../i18n"
import { SettingsBody } from "../SettingsBody"
import { setDeveloperScreenPresenter } from "../developerScreen"

// The icon set and the primitives barrel pull in native-only modules; the rows only need a label to press.
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
  SignInPrompt: () => null,
  DONATE_URL: "https://civfix.test/donate",
  PRIVACY_URL: "https://civfix.test/privacy",
  TERMS_URL: "https://civfix.test/terms",
  sourceCommit: () => "",
  sourceUrl: () => "https://civfix.test/source",
  useToast: () => ({ show: () => {} }),
}))

vi.mock("../../theme", () => ({
  space: new Proxy({}, { get: () => 0 }),
  useAppearancePreference: () => "system",
}))

vi.mock("../../data", () => ({
  useAuthState: () => ({ isAuthenticated: true, isPending: false }),
  useLogout: () => async () => {},
  useRequireAuth: () => () => {},
}))

vi.mock("../../capabilities", () => ({ useOpenExternal: () => null }))

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

afterEach(() => setDeveloperScreenPresenter(null))

describe("Settings' Developer row", () => {
  it("T5: renders in About when a presenter is registered, and pressing it calls the presenter once", () => {
    const present = vi.fn()
    setDeveloperScreenPresenter(present)
    renderSettings()

    const about = screen.getByRole("region", { name: "About" })
    const row = screen.getByRole("button", { name: "Developer" })
    expect(about.contains(row)).toBe(true)

    fireEvent.click(row)
    expect(present).toHaveBeenCalledTimes(1)
  })

  it("T6: does not render when no presenter is registered, as on web", () => {
    renderSettings()
    expect(screen.queryByText("Developer")).toBeNull()
  })
})
