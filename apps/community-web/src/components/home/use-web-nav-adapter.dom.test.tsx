import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@civfix/ui", async () => {
  const nav = await import("@civfix/ui/nav")
  return { ...nav, layoutModeFor: () => "compact" }
})

import { useNavStore, type DetailEntry } from "@civfix/ui/nav"

import { readNavHistory } from "./nav-history"
import { useWebNavAdapter } from "./use-web-nav-adapter"

function Host() {
  useWebNavAdapter()
  return null
}

function mount(): void {
  render(<Host />)
}

function depth(): number | null {
  return readNavHistory(window.history.state)?.depth ?? null
}

function path(): string {
  return window.location.pathname
}

function nav() {
  return useNavStore.getState()
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

async function drive(run: () => void): Promise<void> {
  await act(async () => {
    run()
  })
  await settle()
}

async function browserBack(): Promise<void> {
  await act(async () => {
    window.history.back()
  })
  await settle()
}

async function browserForward(): Promise<void> {
  await act(async () => {
    window.history.forward()
  })
  await settle()
}

const PIN_A: DetailEntry = { kind: "pin", id: "a" }
const PIN_B: DetailEntry = { kind: "pin", id: "b" }
const PERSON: DetailEntry = { kind: "person", id: "p1" }

beforeEach(() => {
  window.history.replaceState(null, "", "/")
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
})

afterEach(() => {
  cleanup()
})

describe("mount", () => {
  it("stamps the in-app root when the app boots at /", () => {
    mount()
    expect(path()).toBe("/")
    expect(depth()).toBe(0)
    expect(readNavHistory(window.history.state)?.snapshot.view).toBe("home")
  })

  it("writes a synthetic in-app root beneath a cold deep link, so Back stays in the app", async () => {
    window.history.replaceState(null, "", "/pin/a")
    mount()
    expect(path()).toBe("/pin/a")
    expect(depth()).toBe(1)
    expect(nav().stack).toEqual([PIN_A])

    await browserBack()
    expect(path()).toBe("/")
    expect(depth()).toBe(0)
    expect(nav().stack).toEqual([])
    expect(nav().view).toBe("home")
  })

  it("writes the synthetic root beneath a cold report deep link too", () => {
    window.history.replaceState(null, "", "/report")
    mount()
    expect(path()).toBe("/report")
    expect(depth()).toBe(1)
    expect(nav().view).toBe("report")
  })

  it("restores the stamped snapshot instead of re-seeding, so a reload keeps the stack", async () => {
    mount()
    await drive(() => nav().push(PIN_A))
    const reloadedState = window.history.state

    cleanup()
    useNavStore.setState({ view: "home", stack: [], active: null })
    window.history.replaceState(reloadedState, "", "/pin/a")
    mount()

    expect(nav().stack).toEqual([PIN_A])
    expect(depth()).toBe(1)
  })
})

describe("in-app Back consumes a history entry instead of appending one", () => {
  it("returns to the previous page and leaves nothing for Forward to re-open", async () => {
    mount()
    await drive(() => nav().push(PIN_A))
    expect(path()).toBe("/pin/a")
    expect(depth()).toBe(1)

    await drive(() => nav().push(PERSON))
    expect(path()).toBe("/people/p1")
    expect(depth()).toBe(2)

    const lengthBeforeBack = window.history.length
    await drive(() => nav().back())
    expect(path()).toBe("/pin/a")
    expect(depth()).toBe(1)
    expect(nav().stack).toEqual([PIN_A])
    expect(window.history.length).toBe(lengthBeforeBack)

    await drive(() => nav().back())
    expect(path()).toBe("/")
    expect(nav().stack).toEqual([])
  })

  it("browser Back and Forward walk the same surfaces the chevron does", async () => {
    mount()
    await drive(() => nav().push(PIN_A))
    await drive(() => nav().push(PERSON))

    await browserBack()
    expect(path()).toBe("/pin/a")
    expect(nav().stack).toEqual([PIN_A])

    await browserForward()
    expect(path()).toBe("/people/p1")
    expect(nav().stack).toEqual([PIN_A, PERSON])
  })
})

describe("lateral opens and dismissals leave nothing resurrectable", () => {
  it("a pin-to-pin swap replaces the entry, so Back closes to the surface beneath", async () => {
    mount()
    await drive(() => nav().selectView("map"))
    await drive(() => nav().openDetail(PIN_A))
    expect(path()).toBe("/pin/a")
    const afterFirst = depth()

    await drive(() => nav().openDetail(PIN_B))
    expect(path()).toBe("/pin/b")
    expect(depth()).toBe(afterFirst)

    await drive(() => nav().back())
    expect(nav().stack).toEqual([])
    expect(path()).toBe("/map")
  })

  it("a drag-dismiss traverses past every entry it cleared", async () => {
    mount()
    await drive(() => nav().push(PIN_A))
    await drive(() => nav().push(PERSON))
    expect(depth()).toBe(2)

    await drive(() => nav().collapseToParent())
    expect(nav().stack).toEqual([])
    expect(depth()).toBe(0)
    expect(path()).toBe("/")
  })
})

describe("the report wizard returns to the surface it was launched from", () => {
  it("unwinds the whole search detour in one traversal", async () => {
    mount()
    await drive(() => nav().selectView("events"))
    expect(path()).toBe("/cleanups")
    expect(depth()).toBe(1)

    await drive(() => nav().selectView("report"))
    expect(path()).toBe("/report")
    expect(depth()).toBe(2)
    expect(readNavHistory(window.history.state)?.returnDepth).toBe(1)

    await drive(() => nav().selectView("search"))
    await drive(() => nav().selectView("report"))
    expect(depth()).toBe(4)
    expect(readNavHistory(window.history.state)?.returnDepth).toBe(1)

    await drive(() => nav().leaveReportFlow())
    expect(nav().view).toBe("events")
    expect(path()).toBe("/cleanups")
    expect(depth()).toBe(1)
  })

  it("lands the created report on the launching surface, with the wizard gone from history", async () => {
    mount()
    await drive(() => nav().selectView("events"))
    await drive(() => nav().selectView("report"))

    await drive(() => nav().finishReportFlow({ kind: "pin", id: "new" }))
    expect(path()).toBe("/pin/new")
    expect(depth()).toBe(2)

    await browserBack()
    expect(path()).toBe("/cleanups")
    expect(nav().view).toBe("events")
    expect(nav().stack).toEqual([])
  })
})

describe("history entries this adapter did not write", () => {
  it("seeds from the pathname and stamps the entry so the next pop has a depth", async () => {
    mount()
    await drive(() => nav().push(PIN_A))
    window.history.replaceState({ __NA: true }, "", "/cleanups")

    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: { __NA: true } }))
    })
    await settle()

    expect(nav().view).toBe("events")
    expect(depth()).toBe(0)
    expect(readNavHistory(window.history.state)?.snapshot.view).toBe("events")
  })

  it("keeps the host router's own entry state when it stamps", () => {
    window.history.replaceState({ __NA: true, tree: ["x"] }, "", "/")
    mount()
    const state = window.history.state as Record<string, unknown>
    expect(state.__NA).toBe(true)
    expect(state.tree).toEqual(["x"])
    expect(readNavHistory(state)).not.toBeNull()
  })
})
