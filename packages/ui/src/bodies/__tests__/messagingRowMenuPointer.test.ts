/**
 * The web thread row's "More" chip stays visible on a coarse pointer. Probing the pointer kind at module
 * scope would touch the browser at import time (prerender false, client true) and never follow a change,
 * so it is read by `useCoarsePointer` once per list render and handed to every row, and the per-row
 * style callback, which runs on every hover, focus and press change, never probes.
 * MessagingListBody and ThreadRow import react-native, so this pins the source; the hook itself is tested directly.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { sliceBetween } from "../../__tests__/sourceGuards"

const code = (rel: string): string =>
  readFileSync(new URL(rel, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
const source = code("../MessagingListBody.tsx")
const rowSource = code("../inbox/ThreadRow.tsx")

describe("the row menu chip reads the pointer kind once per list render", () => {
  it("never probes the pointer at module scope", () => {
    for (const src of [source, rowSource]) {
      expect(src).not.toContain("isCoarsePointer")
      expect(src).not.toMatch(/^const COARSE_POINTER\b/m)
    }
    expect(source).toContain('import { useCoarsePointer } from "../shell/useCoarsePointer"')
  })

  it("subscribes in the list body, not in each row", () => {
    expect(source.match(/useCoarsePointer\(\)/g)).toHaveLength(1)
    expect(rowSource).not.toContain("useCoarsePointer(")
    const list = sliceBetween(source, "export function MessagingListBody(", "const renderItem = useCallback(")
    expect(list).toContain("const coarsePointer = useCoarsePointer()")
  })

  it("hands the value to every row and re-renders the rows when it changes", () => {
    const renderItem = sliceBetween(source, "const renderItem = useCallback(", "const threads = useMemo(")
    expect(renderItem).toContain("coarsePointer={coarsePointer}")
    expect(renderItem).toMatch(/\[onPressItem, toggleMute, markRead, hideConversation, coarsePointer\]/)
    const row = sliceBetween(rowSource, "export const ThreadRow = React.memo(", "}) {")
    expect(row).toContain("coarsePointer: boolean")
  })

  it("keeps the per-row predicate a pure read of what it is given", () => {
    const predicate = sliceBetween(rowSource, "function rowMenuChipShown(", "\n}\n")
    expect(predicate).toContain("coarsePointer: boolean")
    expect(predicate).toContain("if (hoveredOrOpen || coarsePointer) return true")
    expect(predicate).not.toContain("useCoarsePointer(")
    expect(rowSource).toContain("rowMenuChipShown(state, hovered || menuOpen, coarsePointer)")
  })
})
