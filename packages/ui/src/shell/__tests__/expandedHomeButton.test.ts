/**
 * Unit test for the ExpandedShell PanelHeader Home-button gate (Feature 3). The shell renders Home ONLY
 * when Back would NOT already return to the home card. Back pops the active entry; when the stack has a
 * single entry, popping it reveals home, so Home is redundant and must be hidden. With two+ entries, Back
 * lands on another panel and Home gives the one-tap path home.
 *
 * The gate is a pure predicate over the nav stack length (showHome === stack.length > 1, alongside the
 * shared showBackAffordance gate), so vitest exercises it directly against the real store in
 * expanded mode - no React Native renderer needed. The expanded mode matters because only there does
 * `push` APPEND (building a multi-entry stack); compact replaces to a single entry.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { useNavStore, titleForEntry } from "../../nav"
import { showBackAffordance } from "../backAffordance"

/**
 * The two predicates the PanelHeader derives. Back now comes from the SHARED gate the compact sheet uses
 * (`showBackAffordance`) rather than a locally re-implemented `stackLen > 0`, so this test keeps LOCKING
 * the landscape contract: the sidebar panel is persistent (no dock, no dismiss gesture), so Back is the
 * only exit and must be offered wherever the header renders. Home stays a separate question ("would Back
 * already land on home?") and remains ExpandedShell's own.
 */
function showBack(): boolean {
  return showBackAffordance({ stack: useNavStore.getState().stack, mode: "expanded" })
}
function showHome(stackLen: number): boolean {
  return stackLen > 1
}

/** Reset the singleton store to a clean home state in the EXPANDED layout (so push appends). */
function resetExpanded(): void {
  useNavStore.setState({
    view: "home",
    stack: [],
    active: null,
    snap: 0,
    query: "",
    mode: "expanded",
    // See the nav store's origin invariant: a raw setState runs no reducer, so clear it explicitly.
    originView: null,
  })
}

beforeEach(resetExpanded)

describe("ExpandedShell Home-button gate", () => {
  it("hides Home on a direct child of home (one entry) - Back already returns home", () => {
    useNavStore.getState().push({ kind: "pin", id: "a" })
    const len = useNavStore.getState().stack.length
    expect(len).toBe(1)
    expect(showBack()).toBe(true) // Back is shown...
    expect(showHome(len)).toBe(false) // ...but Home is hidden (Back lands on home).

    // And Back from here really does reveal home (active null).
    useNavStore.getState().back()
    expect(useNavStore.getState().active).toBeNull()
    expect(useNavStore.getState().stack).toEqual([])
  })

  it("shows Home with two+ entries - Back lands on another panel, not home", () => {
    useNavStore.getState().push({ kind: "pin", id: "a" })
    useNavStore.getState().push({ kind: "person", id: "b" })
    const len = useNavStore.getState().stack.length
    expect(len).toBe(2)
    expect(showBack()).toBe(true)
    expect(showHome(len)).toBe(true)

    // Back here lands on the previous panel (still not home), confirming Home is non-redundant.
    useNavStore.getState().back()
    expect(useNavStore.getState().active).toEqual({ kind: "pin", id: "a" })
    expect(useNavStore.getState().stack).toHaveLength(1)
  })

  it("renders NO panel header at all on the bare home card (empty stack)", () => {
    const { stack, active } = useNavStore.getState()
    expect(stack).toHaveLength(0)
    // ExpandedShell gates the whole header on `hasHeader` (a non-blank titleForEntry), and with no active
    // entry there is no title - so neither chip is reachable and the Back gate is never consulted here.
    // This is WHY the shared gate may answer "always true" in expanded mode: wherever the landscape header
    // actually renders, Back is the only exit (no dock, no dismiss gesture). It is also why the landscape
    // REPORT WIZARD - an empty stack with its own body-owned header - keeps its chevron.
    expect(active).toBeNull()
    expect(active ? titleForEntry(active) : "").toBe("")
    expect(showHome(stack.length)).toBe(false)
  })
})
