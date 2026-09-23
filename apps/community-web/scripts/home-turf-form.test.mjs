import { readFileSync } from "node:fs"

import { JSDOM } from "jsdom"
import { describe, expect, it } from "vitest"

const PAGE = readFileSync(new URL("../public/home-turf/index.html", import.meta.url), "utf8")

function mountPage({ fetchImpl, solveTurnstile }) {
  const dom = new JSDOM(PAGE, {
    runScripts: "dangerously",
    beforeParse(window) {
      window.fetch = fetchImpl
    },
  })
  const { window } = dom
  const doc = window.document
  let widget
  window.turnstile = {
    render(_slot, options) {
      widget = options
      if (solveTurnstile) options.callback("token")
      return "widget"
    },
    reset() {},
  }
  window.onTurnstileLoad()

  for (const field of doc.querySelectorAll("#coach-form [required]")) {
    if (field.tagName === "SELECT") field.selectedIndex = 1
    else if (field.type === "email") field.value = "coach@example.com"
    else if (field.type === "tel") field.value = "5555550100"
    else field.value = "Filled"
  }

  const form = doc.getElementById("coach-form")
  const submit = () => form.dispatchEvent(new window.Event("submit", { cancelable: true }))
  return {
    status: doc.getElementById("form-status"),
    button: form.querySelector("button[type=submit]"),
    solveTurnstile: () => widget.callback("token"),
    submit,
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("home-turf coach form status", () => {
  it("announces the missing robot check as an alert", () => {
    const page = mountPage({ fetchImpl: () => new Promise(() => {}), solveTurnstile: false })
    page.submit()
    expect(page.status.getAttribute("role")).toBe("alert")
    expect(page.status.textContent).toContain("not a robot")
  })

  it("marks the button busy while submitting and alerts on a rejected submit", async () => {
    let respond
    const page = mountPage({
      fetchImpl: () => new Promise((resolve) => (respond = resolve)),
      solveTurnstile: true,
    })
    page.submit()
    expect(page.button.getAttribute("aria-busy")).toBe("true")
    expect(page.button.disabled).toBe(true)

    respond({ ok: false, status: 429 })
    await settle()
    expect(page.button.hasAttribute("aria-busy")).toBe(false)
    expect(page.button.disabled).toBe(false)
    expect(page.status.getAttribute("role")).toBe("alert")
    expect(page.status.textContent).toContain("Too many attempts")
  })

  it("returns to a polite status when a submit succeeds after an error", async () => {
    const page = mountPage({
      fetchImpl: () => Promise.resolve({ ok: true, status: 200 }),
      solveTurnstile: false,
    })
    page.submit()
    expect(page.status.getAttribute("role")).toBe("alert")

    page.solveTurnstile()
    page.submit()
    await settle()
    expect(page.status.getAttribute("role")).toBe("status")
    expect(page.status.textContent).toContain("Got it")
  })
})
