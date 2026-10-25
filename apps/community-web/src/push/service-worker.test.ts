import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { PERVASIVE_HEADERS, parseHeaderBlock } from "@/lib/edge-headers"
import { SW_SOURCE, fakeWindowClient, loadServiceWorker } from "./__fixtures__"

const ORIGIN = "https://civfix.test"

const headersFile = readFileSync(
  fileURLToPath(new URL("../../public/_headers", import.meta.url)),
  "utf8",
)

/** The header lines of one `_headers` rule, in file order. */
function ruleLines(file: string, rule: string): string[] {
  const lines = file.split("\n")
  const start = lines.indexOf(rule)
  if (start === -1) return []
  const body: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (!/^\s+\S/.test(line)) break
    body.push(line.trim())
  }
  return body
}

const REPORT_PUSH = {
  title: "Report updated",
  body: "Your report was fixed",
  link: "/reports/r1",
  tag: "n1",
  data: {
    kind: "notification",
    notificationId: "n1",
    type: "report_update",
    category: "reportUpdates",
    link: "/reports/r1",
  },
}

const clickData = (link: string | null) => ({ notificationId: "n1", category: "reportUpdates", link })

describe("the service worker's edge headers", () => {
  it("T1: /sw.js drops the site-wide Cache-Control, then sets no-cache; the /* rule is unchanged", () => {
    expect(ruleLines(headersFile, "/sw.js")).toEqual(["! Cache-Control", "Cache-Control: no-cache"])
    expect(parseHeaderBlock(headersFile, "/*")).toEqual({ headers: { ...PERVASIVE_HEADERS }, drops: [] })
    expect(PERVASIVE_HEADERS["Cache-Control"]).toBe("public, max-age=0, must-revalidate")
  })
})

describe("public/sw.js", () => {
  it("T2: listens for push and notificationclick, never fetch, and imports nothing", () => {
    const worker = loadServiceWorker(ORIGIN)
    const types = worker.self.addEventListener.mock.calls.map(([type]) => type)
    expect(types).toContain("push")
    expect(types).toContain("notificationclick")
    expect(types).not.toContain("fetch")
    expect(worker.importScripts).not.toHaveBeenCalled()
    expect(SW_SOURCE).not.toMatch(/\bimportScripts\b/)
    expect(SW_SOURCE).not.toMatch(/^\s*import[\s{*]/m)
    expect(SW_SOURCE).not.toMatch(/\bimport\s*\(/)
  })

  it("T4: a push shows its title and body, tagged with the notification id, with the civfix icon", () => {
    const worker = loadServiceWorker(ORIGIN)
    const { waitUntil } = worker.push(REPORT_PUSH)

    expect(worker.showNotification).toHaveBeenCalledTimes(1)
    const [title, options] = worker.showNotification.mock.calls[0]!
    expect(title).toBe("Report updated")
    expect(options).toMatchObject({
      body: "Your report was fixed",
      tag: "n1",
      icon: "/apple-touch-icon.png",
      data: expect.objectContaining({
        notificationId: "n1",
        category: "reportUpdates",
        link: "/reports/r1",
      }),
    })
    expect(waitUntil).toHaveBeenCalledTimes(1)
    expect(waitUntil.mock.calls[0]![0]).toBe(worker.showNotification.mock.results[0]!.value)
  })

  it("T5: a push with no body and no link shows the title alone", () => {
    const worker = loadServiceWorker(ORIGIN)
    const { body: _body, link: _link, ...rest } = REPORT_PUSH
    const { link: _dataLink, ...data } = REPORT_PUSH.data
    worker.push({ ...rest, data })

    expect(worker.showNotification).toHaveBeenCalledTimes(1)
    const [title, options] = worker.showNotification.mock.calls[0]!
    expect(title).toBe("Report updated")
    expect(options).toMatchObject({ tag: "n1", icon: "/apple-touch-icon.png" })
    expect(options).not.toHaveProperty("body")
  })

  it("T6: a click focuses the open civfix tab, navigates it to the link and tells it which notification", async () => {
    const tab = fakeWindowClient(`${ORIGIN}/`)
    const worker = loadServiceWorker(ORIGIN, [tab])

    const { notification } = await worker.click(clickData("/reports/r1"))

    expect(notification.close).toHaveBeenCalled()
    expect(tab.focus).toHaveBeenCalled()
    expect(tab.navigate).toHaveBeenCalledTimes(1)
    const target = new URL(tab.navigate.mock.calls[0]![0] as string, ORIGIN)
    expect(target.origin).toBe(ORIGIN)
    expect(target.pathname).toBe("/reports/r1")
    expect(tab.postMessage).toHaveBeenCalledWith(expect.objectContaining({ notificationId: "n1" }))
    expect(worker.openWindow).not.toHaveBeenCalled()
  })

  it("T7: with no civfix tab open, a click opens one on the link", async () => {
    const worker = loadServiceWorker(ORIGIN)

    await worker.click(clickData("/reports/r1"))

    expect(worker.openWindow).toHaveBeenCalledTimes(1)
    const target = new URL(worker.openWindow.mock.calls[0]![0] as string, ORIGIN)
    expect(target.origin).toBe(ORIGIN)
    expect(target.pathname).toBe("/reports/r1")
  })

  const UNSAFE_LINKS = ["https://evil.example/x", "//evil.example/x", "/\\evil.example", "javascript:alert(1)"]

  function expectNoNavigation(link: string | null) {
    return async () => {
      const tab = fakeWindowClient(`${ORIGIN}/`)
      const withTab = loadServiceWorker(ORIGIN, [tab])
      await withTab.click(clickData(link))
      expect(tab.focus).toHaveBeenCalled()
      expect(tab.navigate).not.toHaveBeenCalled()
      expect(withTab.openWindow).not.toHaveBeenCalled()

      const withoutTab = loadServiceWorker(ORIGIN)
      await withoutTab.click(clickData(link))
      expect(withoutTab.openWindow).toHaveBeenCalledTimes(1)
      expect(withoutTab.openWindow).toHaveBeenCalledWith("/")

      if (link !== null) {
        const targets = [...tab.navigate.mock.calls, ...withTab.openWindow.mock.calls, ...withoutTab.openWindow.mock.calls]
        for (const [target] of targets) expect(String(target)).not.toContain(link)
      }
    }
  }

  for (const link of UNSAFE_LINKS) {
    it(`T8: a click never opens the unsafe link ${link}`, expectNoNavigation(link))
  }

  it("T9: a click on a notification with no link focuses a tab without navigating, or opens /", expectNoNavigation(null))
})
