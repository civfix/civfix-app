import { readFileSync } from "node:fs"

import { JSDOM } from "jsdom"
import { describe, expect, it } from "vitest"

const PAGE = readFileSync(new URL("../public/home-turf/index.html", import.meta.url), "utf8")

/**
 * @typedef {{ ok: boolean, status: number }} FakeResponse
 * @typedef {() => Promise<FakeResponse>} FakeFetch
 * @typedef {{ callback: (token: string) => void }} TurnstileOptions
 * @typedef {import("jsdom").DOMWindow & {
 *   turnstile?: { render(slot: string, options: TurnstileOptions): string, reset(): void },
 *   onTurnstileLoad?: () => void,
 * }} PageWindow
 */

/**
 * @param {Document} doc
 * @param {string} id
 */
function byId(doc, id) {
  const element = doc.getElementById(id)
  if (element === null) throw new Error(`the home-turf page has no #${id}`)
  return element
}

/** @param {{ fetchImpl: FakeFetch, solveTurnstile: boolean }} options */
function mountPage({ fetchImpl, solveTurnstile }) {
  const dom = new JSDOM(PAGE, {
    runScripts: "dangerously",
    beforeParse(window) {
      Object.assign(window, { fetch: fetchImpl })
    },
  })
  const window = /** @type {PageWindow} */ (dom.window)
  const doc = window.document
  /** @type {TurnstileOptions | undefined} */
  let widget
  window.turnstile = {
    render(_slot, options) {
      widget = options
      if (solveTurnstile) options.callback("token")
      return "widget"
    },
    reset() {},
  }
  if (!window.onTurnstileLoad) throw new Error("the home-turf page never defined onTurnstileLoad")
  window.onTurnstileLoad()

  for (const field of doc.querySelectorAll("#coach-form [required]")) {
    if (field instanceof window.HTMLSelectElement) field.selectedIndex = 1
    else if (
      field instanceof window.HTMLInputElement ||
      field instanceof window.HTMLTextAreaElement
    ) {
      field.value =
        field.type === "email"
          ? "coach@example.com"
          : field.type === "tel"
            ? "5555550100"
            : "Filled"
    }
  }

  const form = byId(doc, "coach-form")
  const button = form.querySelector("button[type=submit]")
  if (!(button instanceof window.HTMLButtonElement))
    throw new Error("the coach form has no submit button")
  const submit = () => form.dispatchEvent(new window.Event("submit", { cancelable: true }))
  return {
    status: byId(doc, "form-status"),
    alert: () => doc.getElementById("form-error"),
    button,
    solveTurnstile: () => {
      if (!widget) throw new Error("the Turnstile widget never rendered")
      widget.callback("token")
    },
    submit,
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("home-turf coach form status", () => {
  it("announces the missing robot check in a freshly inserted alert, never by flipping a role", () => {
    const page = mountPage({ fetchImpl: () => new Promise(() => {}), solveTurnstile: false })
    page.submit()
    const first = page.alert()
    expect(first?.getAttribute("role")).toBe("alert")
    expect(first?.textContent).toContain("not a robot")
    expect(page.status.getAttribute("role")).toBe("status")

    page.submit()
    expect(page.alert()).not.toBe(first)
    expect(first?.isConnected).toBe(false)
    expect(page.status.getAttribute("role")).toBe("status")
  })

  it("marks the button busy while submitting and alerts on a rejected submit", async () => {
    /** @type {((response: FakeResponse) => void) | undefined} */
    let respond
    const page = mountPage({
      fetchImpl: () => new Promise((resolve) => (respond = resolve)),
      solveTurnstile: true,
    })
    page.submit()
    expect(page.button.getAttribute("aria-busy")).toBe("true")
    expect(page.button.disabled).toBe(true)

    if (!respond) throw new Error("the form never called fetch")
    respond({ ok: false, status: 429 })
    await settle()
    expect(page.button.hasAttribute("aria-busy")).toBe(false)
    expect(page.button.disabled).toBe(false)
    expect(page.alert()?.getAttribute("role")).toBe("alert")
    expect(page.alert()?.textContent).toContain("Too many attempts")
  })

  it("clears the alert and reports success politely when a submit succeeds after an error", async () => {
    const page = mountPage({
      fetchImpl: () => Promise.resolve({ ok: true, status: 200 }),
      solveTurnstile: false,
    })
    page.submit()
    expect(page.alert()).not.toBeNull()

    page.solveTurnstile()
    page.submit()
    await settle()
    expect(page.alert()).toBeNull()
    expect(page.status.getAttribute("role")).toBe("status")
    expect(page.status.textContent).toContain("Got it")
  })
})
