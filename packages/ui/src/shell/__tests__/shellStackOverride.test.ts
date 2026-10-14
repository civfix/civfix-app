import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { portraitFramePlan, portraitShellPlan } from "../bodyLayout"
import type { DetailEntry } from "../../nav"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const appShell = read("../AppShell.tsx")
const portrait = read("../PortraitShell.shared.tsx")
const expanded = read("../ExpandedShell.tsx")
const types = read("../types.ts")
const searchReveal = read("../SearchBodyReveal.native.tsx")

const cleanup = { kind: "cleanup", id: "c1" } as DetailEntry

describe("a shell renders the stack it owns, not whatever the store holds", () => {
  it("takes the override as a prop", () => {
    expect(types).toContain("stack?: readonly DetailEntry[]")
  })

  it("derives the active entry from the override, so the store cannot leak an entry in", () => {
    expect(appShell).toContain("const liveActive = useNavStore((state) => state.active)")
    expect(appShell).toContain(
      "const active = stack ? (stack[stack.length - 1] ?? null) : liveActive",
    )
  })

  it("hands the override to BOTH shells", () => {
    expect(appShell).toContain("<ExpandedShell renderBody={renderBody} stack={stack} />")
    expect(appShell).toMatch(/<PortraitShell[\s\S]*?stack=\{stack\}[\s\S]*?\/>/)
  })

  it("prefers the override over the live store in each shell, and falls back when absent", () => {
    expect(portrait).toContain("const liveStack = useNavStore((state) => state.stack)")
    expect(portrait).toContain("const stack = ownedStack ?? liveStack")
    expect(expanded).toContain("const stack = ownedStack ?? liveStack")
    expect(expanded).toContain(
      "const active = ownedStack ? (ownedStack[ownedStack.length - 1] ?? null) : liveActive",
    )
  })

  it("keeps the search overlay's body out of every unrelated shell re-render", () => {
    expect(searchReveal).toContain('const body = useMemo(() => renderBody(null, "search"), [renderBody])')
    expect(searchReveal).not.toMatch(/\{renderBody\(null, "search"\)\}/)
  })

  it("keeps the expanded panel's body out of shell re-renders that leave the entry and view alone", () => {
    expect(expanded).toContain("const body = useMemo(() => renderBody(entry, view), [renderBody, entry, view])")
    expect(expanded).not.toMatch(/\{renderBody\(entry, view\)\}/)
  })
})

describe("an empty owned stack presents no page at all, so the base body shows through", () => {
  const shellPlan = portraitShellPlan("home", null, true, true)

  it("mounts no overlay for an empty stack", () => {
    const frame = portraitFramePlan("home", null, shellPlan, 0, 0, [], true)
    expect(frame.overlay.bodyMounted).toBe(false)
    expect(frame.overlay.entries).toEqual([])
    expect(frame.base.bodyMounted).toBe(true)
  })

  it("mounts exactly the pages the owned stack names", () => {
    const frame = portraitFramePlan("home", cleanup, shellPlan, 0, 0, [cleanup], true)
    expect(frame.overlay.entries).toEqual([cleanup])
    expect(frame.overlay.entry).toEqual(cleanup)
  })
})
