import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createI18n } from "../config"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("GH#299 i18next 26 starts silently", () => {
  it("T13: createI18n logs nothing to the console, and config.ts sets no showSupportNotice", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const i18n = createI18n("en")
    await vi.waitFor(() => {
      expect(i18n.isInitialized).toBe(true)
    })
    expect(log).not.toHaveBeenCalled()
    expect(info).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    const source = readFileSync(new URL("../config.ts", import.meta.url), "utf8")
    expect(source).not.toContain("showSupportNotice")
  })
})
