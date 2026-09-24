// The package's vitest runs in plain node, so this installs a minimal fake `window.visualViewport`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type Handler = () => void

function makeViewport(height: number) {
  const handlers: Record<string, Set<Handler>> = { resize: new Set(), scroll: new Set() }
  return {
    height,
    offsetTop: 0,
    handlers,
    addEventListener: (type: string, fn: Handler) => handlers[type]?.add(fn),
    removeEventListener: (type: string, fn: Handler) => handlers[type]?.delete(fn),
    fire(type: string) {
      for (const fn of [...(handlers[type] ?? [])]) fn()
    },
  }
}

let vv: ReturnType<typeof makeViewport>
let store: typeof import("../useKeyboardInset.web")

beforeEach(async () => {
  vv = makeViewport(800)
  vi.stubGlobal("window", { innerHeight: 800, visualViewport: vv })
  vi.resetModules()
  store = await import("../useKeyboardInset.web")
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("the shared visualViewport inset store", () => {
  it("attaches one resize and one scroll listener however many hooks subscribe", () => {
    const offs = [store.subscribeKeyboardInset(() => {}), store.subscribeKeyboardInset(() => {})]
    offs.push(store.subscribeKeyboardInset(() => {}))
    expect(vv.handlers.resize?.size).toBe(1)
    expect(vv.handlers.scroll?.size).toBe(1)
    for (const off of offs) off()
    expect(vv.handlers.resize?.size).toBe(0)
    expect(vv.handlers.scroll?.size).toBe(0)
  })

  it("measures the overlap once per viewport event and notifies only on a change", () => {
    const a = vi.fn()
    const b = vi.fn()
    const offA = store.subscribeKeyboardInset(a)
    const offB = store.subscribeKeyboardInset(b)
    expect(store.readKeyboardInset()).toBe(0)

    vv.height = 500
    vv.fire("resize")
    expect(store.readKeyboardInset()).toBe(300)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)

    vv.fire("scroll")
    expect(a).toHaveBeenCalledTimes(1)

    vv.offsetTop = 40
    vv.fire("scroll")
    expect(store.readKeyboardInset()).toBe(260)
    expect(b).toHaveBeenCalledTimes(2)
    offA()
    offB()
  })

  it("keeps the old rounding and floors sub-pixel noise to 0", () => {
    const off = store.subscribeKeyboardInset(() => {})
    vv.height = 799.4
    vv.fire("resize")
    expect(store.readKeyboardInset()).toBe(0)
    vv.height = 600.4
    vv.fire("resize")
    expect(store.readKeyboardInset()).toBe(200)
    off()
  })

  it("re-measures for the first subscriber and forgets the value once nobody listens", () => {
    vv.height = 500
    const off = store.subscribeKeyboardInset(() => {})
    expect(store.readKeyboardInset()).toBe(300)
    off()
    expect(store.readKeyboardInset()).toBe(0)
  })

  it("stays at 0 without a visual viewport", async () => {
    vi.stubGlobal("window", { innerHeight: 800, visualViewport: null })
    vi.resetModules()
    const bare = await import("../useKeyboardInset.web")
    const off = bare.subscribeKeyboardInset(() => {})
    expect(bare.readKeyboardInset()).toBe(0)
    off()
  })
})
