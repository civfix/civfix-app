import { describe, expect, it } from "vitest"

import {
  CONSOLE_PUSH_PARAM_KEYS,
  CONSOLE_REPLACE_PARAM_KEYS,
  applyConsolePatch,
  consoleHref,
  drawerClosePlan,
  isDrawerParamKey,
  parseConsoleSearch,
  serializeConsoleParams,
  writeModeForPatch,
} from "./url-state"

describe("console url state", () => {
  it("keeps only registered params", () => {
    expect(parseConsoleSearch("?tab=page&evil=1&q=ann")).toEqual({ tab: "page", q: "ann" })
  })

  it("drops empty values on the way in and out", () => {
    expect(parseConsoleSearch("?q=")).toEqual({})
    expect(serializeConsoleParams({ q: "", tab: "page" })).toBe("?tab=page")
    expect(serializeConsoleParams({})).toBe("")
  })

  it("serializes in a stable registry order regardless of insertion order", () => {
    expect(serializeConsoleParams({ q: "ann", tab: "page" })).toBe(
      serializeConsoleParams({ tab: "page", q: "ann" }),
    )
  })

  it("removes a key when patched with null or empty", () => {
    expect(applyConsolePatch({ q: "ann", tab: "page" }, { q: null })).toEqual({ tab: "page" })
    expect(applyConsolePatch({ q: "ann" }, { q: "" })).toEqual({})
    expect(applyConsolePatch({ q: "ann" }, { q: "bo" })).toEqual({ q: "bo" })
  })

  it("ignores unknown keys in a patch", () => {
    expect(applyConsolePatch({}, { evil: "1" } as never)).toEqual({})
  })

  it("pushes for a drawer param and replaces for a filter param", () => {
    expect(writeModeForPatch({ attendee: "a1" })).toBe("push")
    expect(writeModeForPatch({ q: "ann" })).toBe("replace")
    expect(writeModeForPatch({ attendee: null })).toBe("replace")
    expect(writeModeForPatch({ q: "ann", attendee: "a1" })).toBe("push")
  })

  it("classifies every push key as a drawer key and no replace key as one", () => {
    for (const key of CONSOLE_PUSH_PARAM_KEYS) expect(isDrawerParamKey(key)).toBe(true)
    for (const key of CONSOLE_REPLACE_PARAM_KEYS) expect(isDrawerParamKey(key)).toBe(false)
  })

  it("closes a drawer the console PUSHED by traversing, and any other entry by replacing", () => {
    expect(drawerClosePlan({ consoleDrawer: true })).toBe("back")
    expect(drawerClosePlan({ __NA: true, consoleDrawer: true })).toBe("back")
    expect(drawerClosePlan({ consoleDrawer: false })).toBe("replace")
    expect(drawerClosePlan({ __NA: true })).toBe("replace")
    expect(drawerClosePlan(null)).toBe("replace")
    expect(drawerClosePlan(undefined)).toBe("replace")
  })

  it("builds hrefs from a pathname plus params", () => {
    expect(consoleHref("/manage/events/e1/attendees/", { q: "ann" })).toBe(
      "/manage/events/e1/attendees/?q=ann",
    )
    expect(consoleHref("/manage/", {})).toBe("/manage/")
  })
})
