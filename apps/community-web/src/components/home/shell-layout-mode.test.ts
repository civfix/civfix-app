import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

const shell = read("./home-shell.tsx")
const globals = read("../../app/globals.css")

describe("the maplibre chrome offsets key on the shell's layout mode, not on orientation", () => {
  it("publishes the live layout mode onto .cf-shell as data-cf-layout", () => {
    expect(shell).toContain('import { useLayoutMode } from "@civfix/ui/theme"')
    expect(shell).toContain("const layoutMode = useLayoutMode()")
    expect(shell).toContain('shell.current?.setAttribute("data-cf-layout", layoutMode)')
    expect(shell).toContain('className="cf-shell cf-design" data-cf-layout="compact"')
  })

  it("gates the attribution + zoom offsets on that attribute, never on a media query", () => {
    expect(globals).not.toContain("@media (orientation")
    expect(globals).toContain('.cf-shell[data-cf-layout="expanded"] .maplibregl-ctrl-bottom-left')
    expect(globals).toContain('.cf-shell[data-cf-layout="compact"] .maplibregl-ctrl-bottom-left')
  })
})
