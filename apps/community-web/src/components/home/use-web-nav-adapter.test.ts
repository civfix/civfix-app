import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

const adapter = read("./use-web-nav-adapter.ts")
const controller = read("./web-nav-controller.ts")
const layoutMode = read("./live-layout-mode.ts")
const internalHref = read("./web-internal-href.ts")
const preview = read("../dev/landscape-preview.tsx")
const providers = read("../providers.tsx")

describe("the mount seed takes its layout mode from the shared shell rule", () => {
  it("seeds the nav store through layoutModeFor, not a local orientation test", () => {
    expect(layoutMode).toContain('import { layoutModeFor } from "@civfix/ui"')
    expect(layoutMode).toContain("return layoutModeFor(window.innerWidth, window.innerHeight)")
    expect(controller).toContain('import { liveMode } from "./live-layout-mode"')
    expect(controller).toContain("seed(entryFromWebPath(pathname), liveMode())")
    for (const source of [adapter, controller, layoutMode]) {
      expect(source).not.toContain("window.innerWidth >= window.innerHeight")
    }
  })

  it("keeps the /landscape harness on the same rule, so the two never disagree", () => {
    expect(preview).toContain('import { liveMode } from "@/components/home/live-layout-mode"')
    expect(preview).not.toContain("layoutModeFor")
    expect(preview).not.toContain("window.innerWidth >= window.innerHeight")
  })
})

describe("focus follows the page on top", () => {
  it("skips hidden and inert layers and falls back to the page layer when it has no heading", () => {
    expect(adapter).toContain(`.filter((element) => !element.closest('[aria-hidden="true"], [inert]'))`)
    expect(adapter).toContain(
      'lastFocusable("[data-civfix-panel-heading]") ?? lastFocusable("[data-civfix-page-layer]")',
    )
  })
})

describe("in-app hrefs resolve through the web address map", () => {
  it("hands the web mapping to the internal-href capability that notifications and chat links use", () => {
    expect(internalHref).toContain("entryFor: entryFromWebPath,")
    expect(internalHref).toMatch(/const entry = entryFromWebPath\(path\)\s+if \(!entry\) return false/)
    expect(providers).toContain("openInternalHref: webOpenInternalHref,")
    expect(providers).not.toContain("entryFromPath")
  })
})
