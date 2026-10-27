import { beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type * as ReactNative from "react-native"
import type * as SettingsRow from "../../../primitives/SettingsRow"
import { I18nProvider } from "../../../i18n"
import { lazyCatalogs } from "../../../i18n/catalogs/lazy"
import { BioEditor } from "../BioEditor"
import en from "../../../i18n/locales/en/settings-account.json"

// The icon set and the primitives barrel pull in native-only modules; the row is read by its text.
vi.mock("../../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})
vi.mock("../../../primitives", async () => ({
  SettingsRow: (await vi.importActual<typeof SettingsRow>("../../../primitives/SettingsRow")).SettingsRow,
  ModalCardSheet: () => null,
  PrimaryButton: () => null,
  SecondaryButton: () => null,
  TextField: () => null,
}))

const longBio = ["First paragraph of a long bio.".repeat(6), "", "Second paragraph.", "Third paragraph."].join("\n")

describe("the Bio row previews the bio in two lines", () => {
  beforeAll(() => Promise.all(Object.values(lazyCatalogs).map((load) => load())))

  it("clamps a long multi-line bio", async () => {
    render(
      <I18nProvider locale="en" setLocale={() => {}}>
        <BioEditor currentBio={longBio} onSave={async () => {}} />
      </I18nProvider>,
    )
    await screen.findByText(en.bio.label)
    const preview = screen.getByText((_, el) => el?.textContent === longBio && el.children.length === 0)
    expect(getComputedStyle(preview).textOverflow).toBe("ellipsis")
  })
})
