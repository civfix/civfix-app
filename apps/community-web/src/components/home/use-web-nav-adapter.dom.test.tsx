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

async function wait(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

async function settle(): Promise<void> {
  await wait(20)
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
const PERSON_B: DetailEntry = { kind: "person", id: "p2" }
const CLUSTER: DetailEntry = { kind: "cluster" }
const DROP_PIN: DetailEntry = { kind: "drop-pin", lat: 1, lng: 2 }

const RECOVERY_WAIT_MS = 600

function delayGo(ms: number): void {
  const real = window.history.go.bind(window.history)
  vi.spyOn(window.history, "go").mockImplementation((delta) => {
    setTimeout(() => real(delta), ms)
  })
}

function dropSecondGoOfEachTask(): void {
  const real = window.history.go.bind(window.history)
  let callsThisTask = 0
  vi.spyOn(window.history, "go").mockImplementation((delta) => {
    callsThisTask += 1
    if (callsThisTask > 1) return
    queueMicrotask(() => {
      callsThisTask = 0
    })
    real(delta)
  })
}

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
  vi.restoreAllMocks()
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
    expect(depth()).toBe(3)
    const entriesBefore = window.history.length
    await drive(() => nav().selectView("report"))
    expect(depth()).toBe(2)
    expect(window.history.length).toBe(entriesBefore)
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

describe("entries with no address are never traversed for", () => {
  it("cancelling a dropped pin stays on the map instead of eating the entry beneath", async () => {
    mount()
    await drive(() => nav().selectView("map"))
    expect(depth()).toBe(1)
    const entriesBefore = window.history.length

    await drive(() => nav().openDetail(DROP_PIN))
    expect(path()).toBe("/map")
    expect(depth()).toBe(1)
    expect(window.history.length).toBe(entriesBefore)

    await drive(() => nav().back())
    expect(path()).toBe("/map")
    expect(depth()).toBe(1)

    await browserBack()
    expect(depth()).toBe(0)
    expect(path()).toBe("/")
    expect(nav().view).toBe("home")
    expect(nav().stack).toEqual([])
  })

  it("closing a cluster leaves the map entry and the in-app root both intact", async () => {
    mount()
    await drive(() => nav().selectView("map"))
    await drive(() => nav().openDetail(CLUSTER))
    expect(depth()).toBe(1)

    await drive(() => nav().back())
    expect(path()).toBe("/map")
    expect(depth()).toBe(1)

    await browserBack()
    expect(depth()).toBe(0)
    expect(nav().view).toBe("home")
  })

  it("dragging a dropped pin away is not a traversal either", async () => {
    mount()
    await drive(() => nav().selectView("map"))
    await drive(() => nav().openDetail(DROP_PIN))

    await drive(() => nav().collapseToParent())
    expect(nav().stack).toEqual([])
    expect(path()).toBe("/map")
    expect(depth()).toBe(1)

    await browserBack()
    expect(depth()).toBe(0)
    expect(nav().view).toBe("home")
  })

  it("a dismissal traverses the addressable entries it cleared and no more", async () => {
    mount()
    await drive(() => nav().push(PIN_A))
    await drive(() => nav().push(DROP_PIN))
    expect(depth()).toBe(1)
    expect(path()).toBe("/pin/a")

    await drive(() => nav().collapseToParent())
    expect(nav().stack).toEqual([])
    expect(path()).toBe("/")
    expect(depth()).toBe(0)
  })
})

describe("two Backs before the first has landed", () => {
  it("serializes the traversals and lands two surfaces down", async () => {
    mount()
    await drive(() => nav().push(PIN_A))
    await drive(() => nav().push(PERSON))

    await act(async () => {
      nav().back()
      nav().back()
    })
    await settle()

    expect(nav().stack).toEqual([])
    expect(path()).toBe("/")
    expect(depth()).toBe(0)
  })

  it("still lands on an engine that drops a second traversal queued in the same task", async () => {
    mount()
    await drive(() => nav().push(PIN_A))
    await drive(() => nav().push(PERSON))
    dropSecondGoOfEachTask()

    await act(async () => {
      nav().back()
      nav().back()
    })
    await settle()

    expect(nav().stack).toEqual([])
    expect(path()).toBe("/")
    expect(depth()).toBe(0)
  })

  it("releases the lock when a traversal never lands, leaving the entry it never left alone", async () => {
    mount()
    await drive(() => nav().push(PIN_A))
    await drive(() => nav().push(PERSON))
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {})

    await drive(() => nav().back())
    expect(go).toHaveBeenCalledWith(-1)

    await wait(RECOVERY_WAIT_MS)
    expect(path()).toBe("/people/p1")
    expect(depth()).toBe(2)
    expect(readNavHistory(window.history.state)?.snapshot.stack).toEqual([PIN_A, PERSON])

    go.mockRestore()
    await drive(() => nav().push(PIN_B))
    expect(path()).toBe("/pin/b")
    expect(depth()).toBe(3)

    await browserBack()
    expect(path()).toBe("/people/p1")
    expect(nav().stack).toEqual([PIN_A, PERSON])
  })

  it("treats a traversal that lands after the timeout as ours, leaving no twin ahead of it", async () => {
    mount()
    await drive(() => nav().push(PIN_A))
    await drive(() => nav().push(PERSON))
    delayGo(500)

    await drive(() => nav().back())
    await wait(700)
    expect(path()).toBe("/pin/a")
    expect(depth()).toBe(1)
    expect(nav().stack).toEqual([PIN_A])

    await browserForward()
    expect(path()).toBe("/people/p1")
    expect(nav().stack).toEqual([PIN_A, PERSON])
  })

  it("keeps a detail opened while the traversal was still in flight", async () => {
    mount()
    await drive(() => nav().push(PIN_A))
    await drive(() => nav().push(PERSON))
    delayGo(500)

    await drive(() => nav().back())
    await wait(200)
    await act(async () => {
      nav().push(PIN_B)
    })
    await wait(600)

    expect(nav().stack).toEqual([PIN_A, PIN_B])
    expect(path()).toBe("/pin/b")
    expect(depth()).toBe(2)

    await browserBack()
    expect(path()).toBe("/pin/a")
    expect(nav().stack).toEqual([PIN_A])
  })
})

describe("transitions that change nothing a URL can address", () => {
  it("a lateral open with no address of its own traverses to the entry beneath it", async () => {
    mount()
    await drive(() => nav().selectView("map"))
    await drive(() => nav().openDetail(PIN_A))
    expect(path()).toBe("/pin/a")
    expect(depth()).toBe(2)
    const entriesBefore = window.history.length

    await drive(() => nav().openDetail(CLUSTER))
    expect(path()).toBe("/map")
    expect(depth()).toBe(1)
    expect(window.history.length).toBe(entriesBefore)

    await browserBack()
    expect(path()).toBe("/")
    expect(depth()).toBe(0)
    expect(nav().view).toBe("home")
    expect(nav().stack).toEqual([])
  })

  it("a typed search query is in-place state, so it never grows history or twins an entry", async () => {
    mount()
    await drive(() => nav().selectView("map"))
    expect(depth()).toBe(1)
    const entriesBefore = window.history.length

    await drive(() => nav().setQuery("abc"))
    expect(window.history.length).toBe(entriesBefore)
    expect(depth()).toBe(1)

    await drive(() => nav().openDetail(CLUSTER))
    expect(depth()).toBe(1)
    expect(window.history.length).toBe(entriesBefore)
    expect(readNavHistory(window.history.state)?.snapshot.query).toBe("abc")

    await drive(() => nav().back())
    expect(depth()).toBe(1)
    expect(window.history.length).toBe(entriesBefore)

    await browserBack()
    expect(path()).toBe("/")
    expect(depth()).toBe(0)
    expect(nav().view).toBe("home")
  })
})

describe("a landing reconciles every surface the store gained mid-flight", () => {
  it("pushes one entry per skipped surface, so Back walks them one at a time", async () => {
    mount()
    await drive(() => nav().push(PIN_A))
    await drive(() => nav().push(PERSON))

    await act(async () => {
      nav().back()
      nav().push(PIN_B)
      nav().push(PERSON_B)
    })
    await settle()

    expect(path()).toBe("/people/p2")
    expect(depth()).toBe(3)
    expect(nav().stack).toEqual([PIN_A, PIN_B, PERSON_B])

    await browserBack()
    expect(path()).toBe("/pin/b")
    expect(nav().stack).toEqual([PIN_A, PIN_B])

    await browserBack()
    expect(path()).toBe("/pin/a")
    expect(nav().stack).toEqual([PIN_A])
  })

  it("never overwrites the in-app root with a surface of its own", async () => {
    window.history.replaceState(null, "", "/pin/a")
    mount()
    expect(depth()).toBe(1)

    await drive(() => nav().collapseToParent())
    expect(nav().view).toBe("reports")
    expect(path()).toBe("/reports")
    expect(depth()).toBe(1)

    await browserBack()
    expect(path()).toBe("/")
    expect(depth()).toBe(0)
    expect(nav().view).toBe("home")
  })
})

describe("a lateral open after a drill-down", () => {
  it("leaves no duplicate entry for Back to land on twice", async () => {
    mount()
    await drive(() => nav().push(PIN_A))
    await drive(() => nav().push(PERSON))
    await drive(() => nav().openDetail(PIN_B))
    expect(path()).toBe("/pin/b")
    expect(depth()).toBe(2)

    await drive(() => nav().back())
    expect(nav().stack).toEqual([])
    expect(path()).toBe("/")
    expect(depth()).toBe(0)
  })
})

describe("leaving a view consumes its entry instead of twinning the surface beneath", () => {
  it("closing search from the docked home action returns to the in-app root without growing history", async () => {
    mount()
    await drive(() => nav().selectView("search"))
    expect(path()).toBe("/search")
    expect(depth()).toBe(1)
    const entriesBefore = window.history.length

    await drive(() => nav().selectView("home"))
    expect(path()).toBe("/")
    expect(depth()).toBe(0)
    expect(nav().view).toBe("home")
    expect(window.history.length).toBe(entriesBefore)

    await browserForward()
    expect(path()).toBe("/search")
    expect(nav().view).toBe("search")
  })

  it("closing search after typing lands past it, so Back does not re-open it", async () => {
    mount()
    await drive(() => nav().selectView("map"))
    await drive(() => nav().selectView("search"))
    expect(path()).toBe("/search")
    expect(depth()).toBe(2)
    const entriesBefore = window.history.length

    await drive(() => nav().setQuery("abc"))
    await drive(() => nav().selectView("map"))
    expect(path()).toBe("/map")
    expect(depth()).toBe(1)
    expect(window.history.length).toBe(entriesBefore)

    await browserBack()
    expect(path()).toBe("/")
    expect(depth()).toBe(0)
    expect(nav().view).toBe("home")
  })

  it("the home chip stays a forward push when the entry beneath is another surface", async () => {
    mount()
    await drive(() => nav().selectView("events"))
    await drive(() => nav().selectView("map"))
    expect(depth()).toBe(2)

    await drive(() => nav().reset())
    expect(path()).toBe("/")
    expect(depth()).toBe(3)
    expect(nav().view).toBe("home")

    await browserBack()
    expect(path()).toBe("/map")
    expect(nav().view).toBe("map")
  })
})
