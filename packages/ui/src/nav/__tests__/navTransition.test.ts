import { beforeEach, describe, expect, it } from "vitest"
import { stackTransition } from "../navTransition"
import { useNavStore } from "../useNavStore"
import type { DetailEntry } from "../types"

const a: DetailEntry = { kind: "pin", id: "a" }
const b: DetailEntry = { kind: "person", id: "b" }
const c: DetailEntry = { kind: "post-thread", id: "c" }

function resetStore(): void {
  useNavStore.setState({
    view: "home",
    stack: [],
    active: null,
    snap: 0,
    snapAnimated: true,
    query: "",
    mode: "compact",
    originView: null,
    seededDetailPage: false,
    reportReturn: null,
    navSeq: 0,
    lastTransition: null,
  })
}

describe("stackTransition", () => {
  it("reports no transition for identical stacks", () => {
    expect(stackTransition([], [])).toBeNull()
    expect(stackTransition([a, b], [a, b])).toBeNull()
    expect(stackTransition([a], [{ kind: "pin", id: "a", title: "renamed" }])).toBeNull()
  })

  it("reports a pop when the next stack is a proper prefix of the previous one", () => {
    expect(stackTransition([a, b, c], [a])).toEqual({ type: "pop", count: 2 })
    expect(stackTransition([a, b], [a])).toEqual({ type: "pop", count: 1 })
    expect(stackTransition([a], [])).toEqual({ type: "pop", count: 1 })
  })

  it("reports a push when the previous stack is a proper prefix of the next one", () => {
    expect(stackTransition([], [a])).toEqual({ type: "push" })
    expect(stackTransition([a], [a, b])).toEqual({ type: "push" })
  })

  it("reports a replace when neither stack is a prefix of the other", () => {
    expect(stackTransition([a], [b])).toEqual({ type: "replace" })
    expect(stackTransition([a, b], [a, c])).toEqual({ type: "replace" })
    expect(stackTransition([a, b], [c])).toEqual({ type: "replace" })
  })
})

describe("navSeq and lastTransition", () => {
  beforeEach(resetStore)

  it("selectView records a select in both branches and deselecting clears the report return", () => {
    useNavStore.getState().selectView("events")
    expect(useNavStore.getState().navSeq).toBe(1)
    expect(useNavStore.getState().lastTransition).toEqual({ type: "select" })

    useNavStore.getState().selectView("events")
    expect(useNavStore.getState().view).toBe("home")
    expect(useNavStore.getState().navSeq).toBe(2)
    expect(useNavStore.getState().lastTransition).toEqual({ type: "select" })
  })

  it("re-selecting map with an empty stack is not a transition at all", () => {
    useNavStore.getState().selectView("map")
    const seq = useNavStore.getState().navSeq
    useNavStore.getState().selectView("map")
    expect(useNavStore.getState().navSeq).toBe(seq)
  })

  it("push records a push", () => {
    useNavStore.getState().push(a)
    expect(useNavStore.getState().lastTransition).toEqual({ type: "push" })
    expect(useNavStore.getState().navSeq).toBe(1)
  })

  it("openDetail pushes from an empty stack and replaces a non-empty one", () => {
    useNavStore.getState().openDetail(a)
    expect(useNavStore.getState().lastTransition).toEqual({ type: "push" })
    useNavStore.getState().openDetail(b)
    expect(useNavStore.getState().lastTransition).toEqual({ type: "replace" })
    expect(useNavStore.getState().stack).toEqual([b])
  })

  it("back pops one entry and does not bump on an empty stack", () => {
    useNavStore.getState().push(a)
    useNavStore.getState().back()
    expect(useNavStore.getState().lastTransition).toEqual({ type: "pop", count: 1 })
    const seq = useNavStore.getState().navSeq
    useNavStore.getState().back()
    expect(useNavStore.getState().navSeq).toBe(seq)
  })

  it("collapseToParent pops the whole stack, and its no-op branches do not bump", () => {
    const seq0 = useNavStore.getState().navSeq
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().navSeq).toBe(seq0)

    useNavStore.getState().push(a)
    useNavStore.getState().push(b)
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().lastTransition).toEqual({ type: "pop", count: 2 })

    resetStore()
    useNavStore.getState().push({ kind: "create-cleanup" })
    const seq1 = useNavStore.getState().navSeq
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().navSeq).toBe(seq1)
  })

  it("reset and seed record their own transitions", () => {
    useNavStore.getState().reset()
    expect(useNavStore.getState().lastTransition).toEqual({ type: "reset" })
    useNavStore.getState().seed(a, "compact")
    expect(useNavStore.getState().lastTransition).toEqual({ type: "seed" })
    useNavStore.getState().seed(null, "compact")
    expect(useNavStore.getState().lastTransition).toEqual({ type: "seed" })
  })

  it("setStack routes through stackTransition", () => {
    useNavStore.getState().push(a)
    useNavStore.getState().push(b)
    useNavStore.getState().setStack([a])
    expect(useNavStore.getState().lastTransition).toEqual({ type: "pop", count: 1 })
    useNavStore.getState().setStack([a, c])
    expect(useNavStore.getState().lastTransition).toEqual({ type: "push" })
    useNavStore.getState().setStack([b])
    expect(useNavStore.getState().lastTransition).toEqual({ type: "replace" })
    const seq = useNavStore.getState().navSeq
    useNavStore.getState().setStack([b])
    expect(useNavStore.getState().navSeq).toBe(seq)
  })

  it("navigateTo truncates as a pop and merges the top entry as a replace", () => {
    useNavStore.getState().push(a)
    useNavStore.getState().push(b)
    useNavStore.getState().push(c)
    useNavStore.getState().navigateTo(a, "compact")
    expect(useNavStore.getState().lastTransition).toEqual({ type: "pop", count: 2 })

    useNavStore.getState().navigateTo({ kind: "pin", id: "a", title: "t" }, "compact")
    expect(useNavStore.getState().lastTransition).toEqual({ type: "replace" })

    const seq = useNavStore.getState().navSeq
    useNavStore.getState().navigateTo({ kind: "pin", id: "a", title: "t" }, "compact")
    expect(useNavStore.getState().navSeq).toBe(seq)
  })

  it("setSnap, setQuery and setMode never bump the sequence", () => {
    useNavStore.getState().push(a)
    const seq = useNavStore.getState().navSeq
    useNavStore.getState().setSnap(2)
    useNavStore.getState().setQuery("hello")
    useNavStore.getState().setMode("expanded")
    expect(useNavStore.getState().navSeq).toBe(seq)
  })
})
