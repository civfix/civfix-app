// The package's vitest runs in plain node, so maplibre, react-dom's root and the DOM are minimal fakes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DesiredMarker as Desired, MarkerEntry as Entry } from "../domMarkerLayer.web"

interface FakeEl {
  style: Record<string, string>
  attrs: Record<string, string>
  parentNode: FakeParent | null
  setAttribute: (name: string, value: string) => void
  removeAttribute: (name: string) => void
  addEventListener: (type: string, fn: (e: unknown) => void) => void
}

interface FakeParent {
  children: FakeEl[]
  appendChild: (el: FakeEl) => FakeEl
}

const created = { elements: 0, roots: 0, markers: 0 }
const renders: { el: FakeEl; node: unknown }[] = []
const unmounted: FakeEl[] = []
const container: FakeParent = {
  children: [],
  appendChild(el) {
    const at = container.children.indexOf(el)
    if (at >= 0) container.children.splice(at, 1)
    container.children.push(el)
    el.parentNode = container
    return el
  },
}

vi.mock("react-dom/client", () => ({
  createRoot: (el: FakeEl) => {
    created.roots += 1
    return {
      render: (node: unknown) => renders.push({ el, node }),
      unmount: () => unmounted.push(el),
    }
  },
}))

vi.mock("maplibre-gl", () => {
  class Marker {
    private el: FakeEl
    lngLat: [number, number] = [0, 0]
    constructor(opts: { element: FakeEl }) {
      created.markers += 1
      this.el = opts.element
    }
    setLngLat(lngLat: [number, number]) {
      this.lngLat = lngLat
      return this
    }
    addTo() {
      container.appendChild(this.el)
      this.el.setAttribute("aria-label", "Map marker")
      return this
    }
    remove() {
      const at = container.children.indexOf(this.el)
      if (at >= 0) container.children.splice(at, 1)
      this.el.parentNode = null
      return this
    }
    getElement() {
      return this.el
    }
  }
  return { default: { Marker }, Marker }
})

function fakeElement(): FakeEl {
  const el: FakeEl = {
    style: {},
    attrs: {},
    parentNode: null,
    setAttribute(name, value) {
      el.attrs[name] = value
    },
    removeAttribute(name) {
      delete el.attrs[name]
    },
    addEventListener() {},
  }
  return el
}

const { syncMarkers } = await import("../domMarkerLayer.web")

const map = {} as never

function want(signature: string, extra: Partial<Desired> = {}): Desired {
  return { signature, anchor: "bottom", lngLat: [1, 2], node: signature, label: `pin ${signature}`, ...extra }
}

beforeEach(() => {
  vi.stubGlobal("document", {
    createElement: () => {
      created.elements += 1
      return fakeElement()
    },
  })
  created.elements = 0
  created.roots = 0
  created.markers = 0
  renders.length = 0
  unmounted.length = 0
  container.children.length = 0
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function flushMicrotasks() {
  await Promise.resolve()
}

describe("syncMarkers", () => {
  it("re-renders a changed signature into the same element, root and marker", async () => {
    const current = new Map<string, Entry>()
    syncMarkers(map, current, new Map([["r:1", want("a|light")], ["r:2", want("b|light")]]))
    expect(created).toEqual({ elements: 2, roots: 2, markers: 2 })
    const first = current.get("r:1")
    const el = first?.marker.getElement() as unknown as FakeEl

    syncMarkers(map, current, new Map([["r:1", want("a|dark")], ["r:2", want("b|dark")]]))
    await flushMicrotasks()
    expect(created).toEqual({ elements: 2, roots: 2, markers: 2 })
    expect(unmounted).toEqual([])
    expect(current.get("r:1")).toBe(first)
    expect(current.get("r:1")?.signature).toBe("a|dark")
    expect(renders.filter((r) => r.el === el).map((r) => r.node)).toEqual(["a|light", "a|dark"])
  })

  it("leaves an unchanged signature un-rendered while its position, name and click target move", () => {
    const current = new Map<string, Entry>()
    const pressA = vi.fn()
    const pressB = vi.fn()
    syncMarkers(map, current, new Map([["r:1", want("a", { onClick: pressA })]]))
    const entry = current.get("r:1")
    syncMarkers(map, current, new Map([["r:1", want("a", { onClick: pressB, lngLat: [3, 4], label: "moved" })]]))
    expect(renders).toHaveLength(1)
    expect(entry?.onClick.fn).toBe(pressB)
    expect((entry?.marker.getElement() as unknown as FakeEl).attrs["aria-label"]).toBe("moved")
    expect((entry?.marker as unknown as { lngLat: [number, number] }).lngLat).toEqual([3, 4])
  })

  it("re-applies cursor, pressed state and name on a reused element", () => {
    const current = new Map<string, Entry>()
    syncMarkers(map, current, new Map([["r:1", want("off", { pressed: false })]]))
    const el = current.get("r:1")?.marker.getElement() as unknown as FakeEl
    expect(el.attrs["aria-label"]).toBe("pin off")
    expect(el.attrs["aria-pressed"]).toBe("false")
    expect(el.style.cursor).toBe("default")

    syncMarkers(map, current, new Map([["r:1", want("on", { pressed: true, onClick: () => {} })]]))
    expect(el.attrs["aria-label"]).toBe("pin on")
    expect(el.attrs["aria-pressed"]).toBe("true")
    expect(el.style.cursor).toBe("pointer")
    expect(el.attrs.role).toBe("button")
    expect(el.attrs.tabindex).toBe("0")

    syncMarkers(map, current, new Map([["r:1", want("plain")]]))
    expect(el.attrs["aria-pressed"]).toBeUndefined()
  })

  it("moves a re-rendered marker to the top of the stack, where a rebuilt one used to land", () => {
    const current = new Map<string, Entry>()
    syncMarkers(map, current, new Map([["r:1", want("a|0")], ["r:2", want("b|0")], ["r:3", want("c|0")]]))
    const elOf = (key: string) => current.get(key)?.marker.getElement() as unknown as FakeEl
    const order = () => container.children.map((el) => [...current].find(([, e]) => e.marker.getElement() === (el as never))?.[0])
    expect(order()).toEqual(["r:1", "r:2", "r:3"])

    syncMarkers(map, current, new Map([["r:1", want("a|1")], ["r:2", want("b|0")], ["r:3", want("c|0")]]))
    expect(order()).toEqual(["r:2", "r:3", "r:1"])
    expect(elOf("r:1").parentNode).toBe(container)
  })

  it("rebuilds a marker whose anchor changed and drops one no longer wanted", async () => {
    const current = new Map<string, Entry>()
    syncMarkers(map, current, new Map([["k", want("a")], ["gone", want("g")]]))
    const before = current.get("k")
    syncMarkers(map, current, new Map([["k", want("a", { anchor: "center" })]]))
    await flushMicrotasks()
    expect(current.get("k")).not.toBe(before)
    expect(current.has("gone")).toBe(false)
    expect(unmounted).toHaveLength(2)
    expect(created.markers).toBe(3)
  })
})
