import { readFileSync } from "node:fs"

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

import type * as TurnstileModule from "@/lib/turnstile"

/**
 * Two properties regress silently in production, as a "we couldn't verify you're human" dead end rather
 * than a crash: the widget must stay reachable and within its deadline while Cloudflare escalates a
 * visitor to an interactive challenge, and the script loader must never hang (a <script> that already
 * fired `load`, or a load with no window.turnstile behind it).
 *
 * The node env has no DOM, so `window`/`document` are stubbed with the minimal surfaces the module
 * touches, and the module is re-imported per test because the script memo and the mint queue are module
 * state.
 */

// The sitekey is read at module scope, so it must be set BEFORE the module is imported (without one,
// runTurnstile short-circuits to "" and never loads the script).
vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITEKEY", "test-sitekey")

function loadModule(): Promise<typeof TurnstileModule> {
  vi.resetModules()
  return import("@/lib/turnstile")
}

interface FakeElement {
  tag: string
  id: string
  src: string
  async: boolean
  defer: boolean
  style: Record<string, string>
  children: FakeElement[]
  onload: (() => void) | null
  onerror: (() => void) | null
  addEventListener: (type: string, handler: () => void) => void
  appendChild: (el: FakeElement) => void
  remove: () => void
}

/** Elements currently attached to the fake document (appended and not removed). */
let attached: FakeElement[] = []

function makeDocument() {
  const createElement = (tag: string): FakeElement => {
    const el: FakeElement = {
      tag,
      id: "",
      src: "",
      async: false,
      defer: false,
      style: {},
      children: [],
      onload: null,
      onerror: null,
      addEventListener: (type, handler) => {
        if (type === "load") el.onload = handler
        if (type === "error") el.onerror = handler
      },
      appendChild: (child) => {
        el.children.push(child)
      },
      remove: () => {
        attached = attached.filter((e) => e !== el)
      },
    }
    return el
  }
  return {
    createElement,
    head: {
      appendChild: (el: FakeElement) => {
        attached.push(el)
      },
    },
    body: {
      appendChild: (el: FakeElement) => {
        attached.push(el)
      },
    },
    getElementById: (id: string): FakeElement | null => attached.find((e) => e.id === id) ?? null,
  }
}

/** The injected <script> elements. */
function scripts(): FakeElement[] {
  return attached.filter((e) => e.id === "cf-turnstile-script")
}

/** The widget host strips the mint appends to <body> (removed again on settle). */
function hosts(): FakeElement[] {
  return attached.filter((e) => e.tag === "div")
}

type RenderOpts = {
  sitekey: string
  action?: string
  appearance?: string
  callback?: (token: string) => void
  "error-callback"?: (code?: string) => void
  "expired-callback"?: () => void
  "before-interactive-callback"?: () => void
  "after-interactive-callback"?: () => void
}

/**
 * Stub window.turnstile. `onRender` decides what the widget does; returning nothing leaves the mint
 * pending so the test can drive the callbacks itself.
 */
function stubTurnstile(onRender?: (opts: RenderOpts) => void) {
  const rendered: RenderOpts[] = []
  const removed: string[] = []
  const hostsRenderedInto: FakeElement[] = []
  vi.stubGlobal("window", {
    turnstile: {
      render: (el: FakeElement, opts: RenderOpts) => {
        rendered.push(opts)
        hostsRenderedInto.push(el)
        onRender?.(opts)
        return `widget-${rendered.length}`
      },
      remove: (id: string) => {
        removed.push(id)
      },
    },
  })
  return { rendered, removed, hostsRenderedInto }
}

/** Let the queued mint reach window.turnstile.render (the mint starts on a microtask). */
async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

beforeEach(() => {
  attached = []
  vi.stubGlobal("window", {})
  vi.stubGlobal("document", makeDocument())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("turnstile action", () => {
  it("tags the report-submit mint with the action the backend verifies", async () => {
    const { rendered } = stubTurnstile((opts) => opts.callback?.("tok"))
    const { runTurnstile, TURNSTILE_ACTION_ANON_REPORT } = await loadModule()

    await expect(runTurnstile()).resolves.toBe("tok")
    expect(rendered[0]?.action).toBe(TURNSTILE_ACTION_ANON_REPORT)
  })

  it("mints under the action the caller asks for (the guest-RSVP seam)", async () => {
    const { rendered } = stubTurnstile((opts) => opts.callback?.("tok"))
    const { runTurnstile } = await loadModule()

    await expect(runTurnstile("guest-rsvp")).resolves.toBe("tok")
    expect(rendered[0]?.action).toBe("guest-rsvp")
  })

  it("keeps the static home-turf form on the action its endpoint verifies", async () => {
    const { TURNSTILE_ACTION_HOME_TURF } = await loadModule()
    const html = readFileSync(new URL("../../public/home-turf/index.html", import.meta.url), "utf8")
    expect(html).toContain(`var TURNSTILE_ACTION = '${TURNSTILE_ACTION_HOME_TURF}';`)
    expect(html).toContain("action: TURNSTILE_ACTION,")
  })
})

describe("turnstile interactive rendering", () => {
  it("renders interaction-only so Cloudflare can escalate to a solvable challenge", async () => {
    const { rendered } = stubTurnstile((opts) => opts.callback?.("tok"))
    const { runTurnstile } = await loadModule()

    await expect(runTurnstile()).resolves.toBe("tok")
    expect(rendered[0]?.appearance).toBe("interaction-only")
  })

  it("hosts the widget on a click-through strip above every app layer", async () => {
    let frame: FakeElement | undefined
    const { hostsRenderedInto } = stubTurnstile((opts) => {
      frame = hosts()[0]
      opts.callback?.("tok")
    })
    const { runTurnstile } = await loadModule()

    await expect(runTurnstile()).resolves.toBe("tok")
    // The shell caps at 71 and the app's own overlays at 300 - but the sheet that awaits the token is a
    // react-native-web <Modal>, whose overlay (and its dismiss-on-tap backdrop) sits at 9999. Under it the
    // challenge is visible but unclickable, and aiming at it dismisses the sheet.
    expect(Number(frame?.style.zIndex)).toBeGreaterThan(9999)
    expect(frame?.style.position).toBe("fixed")
    // The strip itself never eats a click; only the widget inside it does.
    expect(frame?.style.pointerEvents).toBe("none")
    expect(hostsRenderedInto[0]?.style.pointerEvents).toBe("auto")
    expect(frame?.children[0]).toBe(hostsRenderedInto[0])
  })

  it("extends the deadline once an interactive challenge starts", async () => {
    vi.useFakeTimers()
    const { rendered } = stubTurnstile()
    const { runTurnstile } = await loadModule()

    const token = runTurnstile("guest-rsvp", 1000)
    await flush()

    rendered[0]?.["before-interactive-callback"]?.()
    // Well past the non-interactive deadline: the visitor is still answering the challenge.
    await vi.advanceTimersByTimeAsync(5000)
    rendered[0]?.callback?.("solved")

    await expect(token).resolves.toBe("solved")
  })

  it("still gives up when nothing ever answers the non-interactive check", async () => {
    vi.useFakeTimers()
    stubTurnstile()
    const { runTurnstile } = await loadModule()

    const token = runTurnstile("guest-rsvp", 1000)
    await flush()
    await vi.advanceTimersByTimeAsync(1000)

    await expect(token).resolves.toBe("")
  })
})

describe("turnstile failure handling", () => {
  it("logs the Cloudflare error code and resolves empty", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    stubTurnstile((opts) => opts["error-callback"]?.("300010"))
    const { runTurnstile } = await loadModule()

    await expect(runTurnstile()).resolves.toBe("")
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain("error-callback")
    expect(warn.mock.calls[0]?.[1]).toMatchObject({ action: "anon-report", code: "300010" })
  })

  it("logs an expiry and resolves empty", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    stubTurnstile((opts) => opts["expired-callback"]?.())
    const { runTurnstile } = await loadModule()

    await expect(runTurnstile()).resolves.toBe("")
    expect(warn.mock.calls[0]?.[0]).toContain("expired-callback")
  })

  it("removes the widget and its host on every settle", async () => {
    const { removed } = stubTurnstile((opts) => opts.callback?.("tok"))
    const { runTurnstile } = await loadModule()

    await expect(runTurnstile()).resolves.toBe("tok")
    expect(removed).toEqual(["widget-1"])
    expect(hosts()).toHaveLength(0)
  })
})

describe("turnstile script loader", () => {
  it("retries the injection after a failed load instead of caching the rejection", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { runTurnstile } = await loadModule()

    const first = runTurnstile()
    await flush()
    const firstScript = scripts()[0]
    expect(firstScript).toBeDefined()

    // The script 404s / is blocked: the loader must drop BOTH the memo and the dead <script> tag.
    firstScript!.onerror?.()
    await expect(first).resolves.toBe("")
    expect(scripts()).toHaveLength(0)
    expect(hosts()).toHaveLength(0)

    // A later submit in the SAME session re-injects and gets a real chance at a token.
    const second = runTurnstile()
    await flush()
    expect(scripts()).toHaveLength(1)

    scripts()[0]!.onerror?.()
    await expect(second).resolves.toBe("")
    expect(warn).toHaveBeenCalled()
  })

  it("picks up an api behind a <script> whose load event already fired", async () => {
    vi.useFakeTimers()
    // A tag is already in the document and its load event is long gone, so no listener will ever fire.
    const existing = document.createElement("script") as unknown as FakeElement
    existing.id = "cf-turnstile-script"
    attached.push(existing)

    const { runTurnstile } = await loadModule()
    const token = runTurnstile()
    await flush()

    stubTurnstile((opts) => opts.callback?.("tok"))
    await vi.advanceTimersByTimeAsync(100)

    await expect(token).resolves.toBe("tok")
  })

  it("gives up when the script loads but never defines window.turnstile", async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { runTurnstile } = await loadModule()

    const token = runTurnstile("guest-rsvp", 60000)
    await flush()
    scripts()[0]!.onload?.()
    await vi.advanceTimersByTimeAsync(5000)

    await expect(token).resolves.toBe("")
    expect(warn).toHaveBeenCalled()
    expect(hosts()).toHaveLength(0)
  })
})

describe("turnstile mint serialization", () => {
  it("shares one in-flight mint between callers asking for the same action", async () => {
    stubTurnstile()
    const { runTurnstile } = await loadModule()

    const first = runTurnstile("guest-rsvp", 1000)
    const second = runTurnstile("guest-rsvp", 1000)
    expect(second).toBe(first)
  })

  it("queues a different action instead of stacking two visible widgets", async () => {
    const { rendered } = stubTurnstile()
    const { runTurnstile } = await loadModule()

    const report = runTurnstile("anon-report", 1000)
    const rsvp = runTurnstile("guest-rsvp", 1000)
    await flush()

    expect(rendered).toHaveLength(1)
    expect(hosts()).toHaveLength(1)

    rendered[0]?.callback?.("tok-report")
    await expect(report).resolves.toBe("tok-report")
    await flush()

    expect(rendered).toHaveLength(2)
    expect(hosts()).toHaveLength(1)
    expect(rendered[1]?.action).toBe("guest-rsvp")

    rendered[1]?.callback?.("tok-rsvp")
    await expect(rsvp).resolves.toBe("tok-rsvp")
    expect(hosts()).toHaveLength(0)
  })
})
