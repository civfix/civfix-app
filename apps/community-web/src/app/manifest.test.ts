import { tokens } from "@civfix/tokens"
import { describe, expect, it } from "vitest"
import { APPLE_TOUCH_ICON_PATH, SITE_NAME } from "@/lib/site-meta"
import { ACTIVE_ICON_PATH } from "@/lib/season-icon"
import manifest from "./manifest"

describe("the web app manifest", () => {
  const value = manifest()

  it("installs as a standalone app that opens on the home feed", () => {
    expect(value.display).toBe("standalone")
    expect(value.start_url).toBe("/")
    expect(value.name).toBe(SITE_NAME)
  })

  it("paints the launch surface in the shell's paper colour", () => {
    expect(value.background_color).toBe(tokens.color.neutral.paper)
    expect(value.theme_color).toBe(tokens.color.neutral.paper)
  })

  it("only points at icons the export actually ships", () => {
    const sources = (value.icons ?? []).map((icon) => icon.src)
    expect(sources.length).toBeGreaterThan(0)
    for (const src of sources) expect([ACTIVE_ICON_PATH, APPLE_TOUCH_ICON_PATH]).toContain(src)
  })

  it("T11: leads with the christmas favicon and keeps the apple-touch icon", () => {
    expect(value.icons?.[0]).toEqual({
      src: "/favicon-christmas.svg",
      sizes: "any",
      type: "image/svg+xml",
    })
    expect(value.icons?.[1]).toEqual({
      src: "/apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png",
    })
  })
})
