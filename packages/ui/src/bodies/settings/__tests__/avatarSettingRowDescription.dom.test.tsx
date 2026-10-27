import { beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type * as ReactNative from "react-native"
import type * as ListRow from "../../../primitives/ListRow"
import type * as SettingsRow from "../../../primitives/SettingsRow"
import type { SupportedLocale, UserProfileDTO } from "@civfix/contract"
import { I18nProvider } from "../../../i18n"
import { lazyCatalogs } from "../../../i18n/catalogs/lazy"
import { AvatarSettingRow } from "../AvatarSettingRow"
import en from "../../../i18n/locales/en/settings-account.json"
import de from "../../../i18n/locales/de/settings-account.json"
import es from "../../../i18n/locales/es/settings-account.json"
import ko from "../../../i18n/locales/ko/settings-account.json"

// The icon set and the primitives barrel pull in native-only modules; the row is read by its text.
vi.mock("../../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})
vi.mock("../../../primitives", async () => ({
  Avatar: () => null,
  LIST_TILE: (await vi.importActual<typeof ListRow>("../../../primitives/ListRow")).LIST_TILE,
  SETTINGS_ROW_MIN_HEIGHT: (await vi.importActual<typeof SettingsRow>("../../../primitives/SettingsRow"))
    .SETTINGS_ROW_MIN_HEIGHT,
}))

const profile = { id: "u1", name: "Ada", avatarUrl: null, avatar: null } as unknown as UserProfileDTO

const catalogs = { en, de, es, ko }
const descriptions = Object.entries(catalogs).flatMap(([lng, c]) => [
  [lng as SupportedLocale, "avatar.sub", c.avatar.sub, false],
  [lng as SupportedLocale, "avatar.uploading", c.avatar.uploading, true],
] as const)

// react-native-web turns `numberOfLines` into a clipped, ellipsized -webkit-box.
function expectUnclamped(el: HTMLElement) {
  const style = getComputedStyle(el)
  expect(style.overflow).not.toBe("hidden")
  expect(style.textOverflow).not.toBe("ellipsis")
  expect(style.display).not.toBe("-webkit-box")
}

describe("the Profile photo row shows its whole description", () => {
  // A locale catalog's first import outlasts findByText's wait; warm the module cache the provider loads from.
  beforeAll(async () => {
    await Promise.all(Object.values(lazyCatalogs).map((load) => load()))
  })

  it.each(descriptions)("%s %s", async (lng, _key, text, uploading) => {
    render(
      <I18nProvider locale={lng} setLocale={() => {}}>
        <AvatarSettingRow profile={profile} uploading={uploading} onPress={() => {}} />
      </I18nProvider>,
    )
    expectUnclamped(await screen.findByText(text))
  })

  it("keeps the label on one line", async () => {
    render(
      <I18nProvider locale="de" setLocale={() => {}}>
        <AvatarSettingRow profile={profile} onPress={() => {}} />
      </I18nProvider>,
    )
    expect(getComputedStyle(await screen.findByText(de.avatar.change)).textOverflow).toBe("ellipsis")
  })
})
