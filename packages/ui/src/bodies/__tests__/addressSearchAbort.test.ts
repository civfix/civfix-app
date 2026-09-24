import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const addressSearch = strip(read("../AddressSearch.tsx") + "\n" + read("../useAddressSearch.ts"))

describe("AddressSearch supersede", () => {
  it("hands the AbortController's signal to the suggest request, not just to the ordering guards", () => {
    expect(addressSearch).toContain("const ac = new AbortController()")
    expect(addressSearch).toContain(
      "api.suggest(buildSuggestRequest(trimmed, bias), { signal: ac.signal })",
    )
  })

  it("keeps an aborted in-flight search from clearing the newer search's results or spinner", () => {
    expect(addressSearch).toMatch(/if \(!ac\.signal\.aborted\) \{\s*setResults\(\[\]\)/)
    expect(addressSearch).toContain("if (!ac.signal.aborted) setLoading(false)")
  })
})
