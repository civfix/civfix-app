import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type * as ReactNative from "react-native"
import { SettingsRow } from "../SettingsRow"
import { RadioOptionRow } from "../RadioOptionRow"
import en from "../../i18n/locales/en/settings-privacy.json"
import de from "../../i18n/locales/de/settings-privacy.json"
import es from "../../i18n/locales/es/settings-privacy.json"
import ko from "../../i18n/locales/ko/settings-privacy.json"

// The icon set pulls in native-only modules; the rows are read by their text.
vi.mock("../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})

const catalogs = { en, de, es, ko }
const helpers = Object.entries(catalogs).flatMap(([lng, c]) => [
  [lng, "allowDms.helper", c.allowDms.helper],
  [lng, "showHours.helper", c.showHours.helper],
])

// react-native-web turns `numberOfLines` into a clipped, ellipsized -webkit-box.
function expectUnclamped(el: HTMLElement) {
  const style = getComputedStyle(el)
  expect(style.overflow).not.toBe("hidden")
  expect(style.textOverflow).not.toBe("ellipsis")
  expect(style.display).not.toBe("-webkit-box")
}

describe("a settings row shows its whole description", () => {
  it.each(helpers)("toggle row, %s %s", (_lng, _key, helper) => {
    render(<SettingsRow label="Label" sub={helper} toggle={{ value: false, onValueChange: () => {} }} />)
    expectUnclamped(screen.getByText(helper))
  })

  it("plain row", () => {
    render(<SettingsRow label="Label" sub={en.showHours.helper} />)
    expectUnclamped(screen.getByText(en.showHours.helper))
  })

  it("pressable row", () => {
    render(<SettingsRow label="Label" icon="Ban" sub={en.showHours.helper} onPress={() => {}} />)
    expectUnclamped(screen.getByText(en.showHours.helper))
  })

  it.each(["flush", "inset"] as const)("radio option row, %s", (layout) => {
    render(
      <RadioOptionRow
        label="Label"
        sub={de.showHours.helper}
        selected={false}
        pending={false}
        onPress={() => {}}
        layout={layout}
      />,
    )
    expectUnclamped(screen.getByText(de.showHours.helper))
  })

  it("clamps a value preview that asks for it", () => {
    render(<SettingsRow label="Label" sub={en.showHours.helper} subNumberOfLines={2} onPress={() => {}} />)
    expect(getComputedStyle(screen.getByText(en.showHours.helper)).textOverflow).toBe("ellipsis")
  })
})
