import { tokens } from "@civfix/shared/tokens"
import { describe, expect, it } from "vitest"
import { APPLE_TOUCH_ICON_PATH, ICON_PATH, SITE_NAME } from "@/lib/site-meta"
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
    for (const src of sources) expect([ICON_PATH, APPLE_TOUCH_ICON_PATH]).toContain(src)
  })
})
