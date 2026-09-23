import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { makeFakeCapabilities, fakeOpenInternalHref } from "../fakes"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("openInternalHref is an OPTIONAL capability, like every other host seam", () => {
  it("is declared on PlatformCapabilities as optional, so a host without one still typechecks", () => {
    const types = code(read("../types.ts"))
    expect(types).toMatch(
      /export interface OpenInternalHrefCapability \{\s*open\(path: string\): boolean\s*entryFor\?\(path: string \| null \| undefined\): DetailEntry \| null\s*\}/,
    )
    expect(types).toContain("openInternalHref?: OpenInternalHrefCapability")
  })

  it("has a selector hook that returns undefined rather than throwing", () => {
    const hooks = code(read("../hooks.ts"))
    expect(hooks).toMatch(
      /export function useOpenInternalHref\(\): OpenInternalHrefCapability \| undefined \{\s*return useCapabilities\(\)\.openInternalHref/,
    )
  })

  it("is exported from the capabilities barrel with its type and its fake", () => {
    const barrel = code(read("../index.ts"))
    expect(barrel).toContain("useOpenInternalHref")
    expect(barrel).toContain("OpenInternalHrefCapability")
    expect(barrel).toContain("fakeOpenInternalHref")
  })
})

describe("the fake bundle carries it, so galleries and tests navigate without a host", () => {
  it("registers the fake in makeFakeCapabilities", () => {
    expect(makeFakeCapabilities().openInternalHref).toBe(fakeOpenInternalHref)
  })

  it("records what it was asked to open and reports success", () => {
    fakeOpenInternalHref.opened.length = 0
    expect(fakeOpenInternalHref.open("/pin/r1")).toBe(true)
    expect(fakeOpenInternalHref.open("/people/jane")).toBe(true)
    expect(fakeOpenInternalHref.opened).toEqual(["/pin/r1", "/people/jane"])
  })
})
