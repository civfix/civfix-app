import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it } from "vitest"
import { detailTrailingActionFor } from "../detailTrailingAction"
import { ALL_DETAIL_KINDS, useNavStore } from "../../nav"
import type { DetailKind } from "../../nav"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

const BUTTON = read("../DetailTrailingButton.tsx")
const BAR = read("../DetailBar.tsx")
const SHEET = read("../SheetHeader.shared.tsx")
const PANEL = read("../ExpandedShell.tsx")
const PAGE_NATIVE = read("../PageStack.native.tsx")
const PAGE_WEB = read("../PageStack.web.tsx")
const HEADER_ICON_BUTTON = read("../../bodies/HeaderIconButton.tsx")
const GEOMETRY = read("../detailHeader.ts")

const MIN_TOUCH_TARGET = 44

const num = (source: string, name: string): number => {
  const found = new RegExp(`const ${name} = ([0-9.]+)`).exec(source)
  expect(found, `${name} is gone - re-scope the guard, do not delete it`).not.toBeNull()
  return Number.parseFloat(found![1] as string)
}

function resetCompact(): void {
  useNavStore.setState({
    view: "home",
    stack: [],
    active: null,
    snap: 2,
    query: "",
    mode: "compact",
    originView: null,
  })
}

beforeEach(resetCompact)

describe("detailTrailingActionFor", () => {
  it("gives the OWN profile a settings gear, and names it from the nav namespace", () => {
    expect(detailTrailingActionFor({ kind: "profile" })).toEqual({
      icon: "Settings",
      a11yKey: "a11y.settings",
      push: { kind: "settings" },
    })
  })

  it("gives every OTHER kind nothing - a person's page included", () => {
    expect(detailTrailingActionFor({ kind: "person", id: "u1" })).toBeNull()
    const withAction = ALL_DETAIL_KINDS.filter(
      (kind: DetailKind) => detailTrailingActionFor({ kind }) !== null,
    )
    expect(withAction).toEqual(["profile"])
  })

  it("gives a bare view entry and an absent entry nothing", () => {
    expect(detailTrailingActionFor(null)).toBeNull()
    expect(detailTrailingActionFor({ kind: "view", view: "map" })).toBeNull()
  })

  it("pushes the settings hub ONTO the profile, so Back returns to it", () => {
    useNavStore.getState().push({ kind: "profile" })
    const action = detailTrailingActionFor(useNavStore.getState().active)
    expect(action).not.toBeNull()
    useNavStore.getState().push(action!.push)
    expect(useNavStore.getState().active?.kind).toBe("settings")
    useNavStore.getState().back()
    expect(useNavStore.getState().active?.kind).toBe("profile")
  })
})

describe("the trailing chip", () => {
  it("performs the action's intent as a push, and nothing else", () => {
    expect(BUTTON).toContain("onPress={() => push(action.push)}")
    expect(BUTTON).toContain('accessibilityLabel={t(action.a11yKey)}')
    expect(BUTTON).toContain('useT("nav")')
    expect(BUTTON).toContain("if (!action) return null")
  })

  it("takes the header row's 36pt geometry, not HeaderIconButton's 44pt target", () => {
    expect(num(GEOMETRY, "DETAIL_BACK_SIZE")).toBe(36)
    expect(GEOMETRY).toContain("export const DETAIL_ACTION_SIZE = DETAIL_BACK_SIZE")
    expect(GEOMETRY).toContain("export const DETAIL_ACTION_RADIUS = DETAIL_BACK_RADIUS")
    expect(BUTTON).toContain("width: DETAIL_ACTION_SIZE")
    expect(BUTTON).toContain("borderRadius: DETAIL_ACTION_RADIUS")
    expect(num(HEADER_ICON_BUTTON, "HEADER_ICON_BUTTON_TARGET")).toBe(MIN_TOUCH_TARGET)
  })

  it("reaches the 44pt touch minimum through hitSlop", () => {
    expect(BUTTON).toContain("hitSlop={DETAIL_ACTION_HIT_SLOP}")
    const size = num(GEOMETRY, "DETAIL_BACK_SIZE")
    const slop = num(GEOMETRY, "DETAIL_ACTION_HIT_SLOP")
    expect(size + slop * 2).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
  })

  it("wears the list roots' header-chip skin, glyph size included", () => {
    expect(BUTTON).toContain("backgroundColor: t.glass.sheet.input")
    expect(HEADER_ICON_BUTTON).toContain("backgroundColor: t.glass.sheet.input")
    expect(BUTTON).toContain("chipHovered: { backgroundColor: t.colors.surfaceTint }")
    expect(HEADER_ICON_BUTTON).toContain("chipHovered: { backgroundColor: t.colors.surfaceTint }")
    expect(num(GEOMETRY, "DETAIL_ACTION_ICON_SIZE")).toBe(num(HEADER_ICON_BUTTON, "HEADER_ICON_BUTTON_GLYPH"))
    expect(num(GEOMETRY, "DETAIL_ACTION_ICON_SIZE")).toBe(18)
  })

  it("shows the keyboard focus ring like every other header chip", () => {
    expect(BUTTON).toContain("{...focusRingProps}")
  })
})

describe("every host that draws a detail header draws the trailing chip", () => {
  const CHIP = "<DetailTrailingButton action={trailingAction} />"

  it("puts it AFTER the flex:1 title, so it right-aligns in the row", () => {
    for (const [name, src, size] of [
      ["DetailBar", BAR, 16],
      ["ExpandedShell's PanelHeader", PANEL, 18],
    ] as const) {
      expect(src, `${name} must draw the trailing chip`).toContain(CHIP)
      expect(src).toContain(`title: { ...detailTitleStyle(${size}, t), flex: 1 }`)
      expect(src.indexOf(CHIP), `${name} must draw it after the title`).toBeGreaterThan(
        src.indexOf("{title}"),
      )
    }
  })

  it("resolves the action once per host, from the entry the header describes", () => {
    expect(SHEET).toContain("trailingAction={detailTrailingActionFor(active)}")
    expect(PANEL).toContain("trailingAction={detailTrailingActionFor(held.active)}")
  })

  it("reaches both page stacks through the SHARED DetailHeader, so neither can miss it", () => {
    expect(PAGE_NATIVE).toContain("<DetailHeader active={entry} stack={stack} dismissGesture={false} />")
    expect(PAGE_WEB).toContain("<DetailHeader active={entry} stack={stack} dismissGesture={false} />")
    expect(PAGE_NATIVE).not.toContain("<DetailBar")
    expect(PAGE_WEB).not.toContain("<DetailBar")
  })
})

describe("the gear's a11y label", () => {
  const locale = (lng: string): Record<string, Record<string, string>> =>
    JSON.parse(read(`../../i18n/locales/${lng}/nav.json`)) as Record<string, Record<string, string>>

  it.each(["en", "es", "de", "ko"])("%s names it in the nav namespace", (lng) => {
    expect(locale(lng).a11y?.settings, `${lng}/nav.json is missing a11y.settings`).toBeTruthy()
  })

  it("left no orphan behind in the profile-view namespace", () => {
    for (const lng of ["en", "es", "de", "ko"]) {
      const view = JSON.parse(read(`../../i18n/locales/${lng}/profile-view.json`)) as {
        hero?: Record<string, string>
      }
      expect(view.hero?.settings_a11y).toBeUndefined()
    }
  })
})
