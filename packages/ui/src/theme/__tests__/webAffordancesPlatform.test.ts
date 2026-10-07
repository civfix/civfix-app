/**
 * The platform-gated affordance values, loaded once per platform against a stubbed `Platform.OS`
 * (react-native itself cannot load under this package's node vitest).
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import type * as WebAffordancesModule from "../webAffordances"
import { tokens } from "@civfix/shared/tokens"
import type { Theme } from "../themes"

type Affordances = typeof WebAffordancesModule

async function load(os: "web" | "ios"): Promise<Affordances> {
  vi.resetModules()
  vi.doMock("react-native", () => ({ Platform: { OS: os } }))
  return import("../webAffordances")
}

afterEach(() => {
  vi.doUnmock("react-native")
  vi.resetModules()
})

const theme = { colors: { accent: "#F0685C" } } as unknown as Theme

describe("inputFocusedStyle", () => {
  it("draws the coral border and the ring token on web", async () => {
    const { inputFocusedStyle } = await load("web")
    expect(inputFocusedStyle(theme)).toEqual({ boxShadow: tokens.shadow.ring, borderColor: "#F0685C" })
  })

  it("ignores the native fallback on web", async () => {
    const { inputFocusedStyle } = await load("web")
    expect(inputFocusedStyle(theme, {})).toEqual({ boxShadow: tokens.shadow.ring, borderColor: "#F0685C" })
  })

  it("draws only the coral border on native", async () => {
    const { inputFocusedStyle } = await load("ios")
    expect(inputFocusedStyle(theme)).toEqual({ borderColor: "#F0685C" })
  })

  it("hands back the caller's own native style when it passes one", async () => {
    const { inputFocusedStyle } = await load("ios")
    expect(inputFocusedStyle(theme, {})).toEqual({})
  })
})

describe("the flat row affordances", () => {
  it("read the ring footprint off the ring token", async () => {
    const { FOCUS_RING_FOOTPRINT, FOCUS_RING_OFFSET, FOCUS_RING_WIDTH } = await load("web")
    expect(tokens.shadow.ring.startsWith(`0 0 0 ${FOCUS_RING_FOOTPRINT}px `)).toBe(true)
    expect(FOCUS_RING_WIDTH + FOCUS_RING_OFFSET).toBe(FOCUS_RING_FOOTPRINT)
  })

  it("pull the ring inside the row by its whole footprint on web, and do nothing on native", async () => {
    const web = await load("web")
    expect(web.WEB_ROW_FOCUS_INSET).toEqual({ outlineOffset: -web.FOCUS_RING_FOOTPRINT })
    const native = await load("ios")
    expect(native.WEB_ROW_FOCUS_INSET).toEqual({})
  })

  it("take the row out of the tab order on web and out of the accessibility tree on native", async () => {
    expect((await load("web")).ROW_A11Y_PROPS).toEqual({ tabIndex: -1 })
    expect((await load("ios")).ROW_A11Y_PROPS).toEqual({ accessible: false })
  })
})
