/**
 * announce (web seam) regression tests. The package's vitest setup is plain node (no jsdom), so this
 * installs a MINIMAL fake `document` - only the handful of members the seam touches - on globalThis.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

interface FakeElement {
  id: string
  textContent: string
  style: Record<string, string>
  attrs: Record<string, string>
  setAttribute: (name: string, value: string) => void
}

function makeFakeDocument() {
  const children: FakeElement[] = []
  return {
    children,
    createElement: (): FakeElement => {
      const el: FakeElement = {
        id: "",
        textContent: "",
        style: {},
        attrs: {},
        setAttribute(name: string, value: string) {
          el.attrs[name] = value
        },
      }
      return el
    },
    getElementById: (id: string) => children.find((c) => c.id === id) ?? null,
    body: {
      appendChild: (el: FakeElement) => {
        children.push(el)
      },
    },
  }
}

type FakeDocument = ReturnType<typeof makeFakeDocument>

let doc: FakeDocument
let announce: typeof import("../announce.web").announce

beforeEach(async () => {
  vi.useFakeTimers()
  doc = makeFakeDocument()
  ;(globalThis as { document?: unknown }).document = doc
  vi.resetModules()
  announce = (await import("../announce.web")).announce
})

afterEach(() => {
  vi.useRealTimers()
  delete (globalThis as { document?: unknown }).document
})

const region = (id: string) => doc.getElementById(id)

describe("announce (web)", () => {
  it("writes the message into the polite region in a deferred task", () => {
    announce("Report filed")
    const el = region("civfix-aria-live-polite")
    expect(el).not.toBeNull()
    expect(el?.attrs["aria-live"]).toBe("polite")
    // Cleared synchronously; the text lands only after the deferred task.
    expect(el?.textContent).toBe("")
    vi.runAllTimers()
    expect(el?.textContent).toBe("Report filed")
  })

  it("re-announces an IDENTICAL message (clear + set are separate mutations)", () => {
    announce("Something went wrong")
    vi.runAllTimers()
    const el = region("civfix-aria-live-polite")
    expect(el?.textContent).toBe("Something went wrong")

    announce("Something went wrong")
    // The region is blanked first, so assistive tech sees a real change when the text returns.
    expect(el?.textContent).toBe("")
    vi.runAllTimers()
    expect(el?.textContent).toBe("Something went wrong")
  })

  it("uses a SEPARATE permanent region per priority instead of flipping aria-live", () => {
    announce("polite one")
    announce("urgent one", { priority: "assertive" })
    vi.runAllTimers()
    expect(region("civfix-aria-live-polite")?.textContent).toBe("polite one")
    expect(region("civfix-aria-live-assertive")?.textContent).toBe("urgent one")
    expect(region("civfix-aria-live-assertive")?.attrs["aria-live"]).toBe("assertive")
    // aria-live is set once at creation and never mutated afterwards.
    expect(region("civfix-aria-live-polite")?.attrs["aria-live"]).toBe("polite")
  })

  it("reuses the existing region across announcements", () => {
    announce("first")
    vi.runAllTimers()
    announce("second")
    vi.runAllTimers()
    expect(doc.children).toHaveLength(1)
    expect(region("civfix-aria-live-polite")?.textContent).toBe("second")
  })

  it("keeps only the latest of several announcements fired in one tick", () => {
    announce("a")
    announce("b")
    vi.runAllTimers()
    expect(region("civfix-aria-live-polite")?.textContent).toBe("b")
  })

  it("ignores an empty message", () => {
    announce("")
    vi.runAllTimers()
    expect(doc.children).toHaveLength(0)
  })
})
