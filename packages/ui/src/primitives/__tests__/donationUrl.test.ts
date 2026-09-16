import { describe, expect, it } from "vitest"
import { donationUrlHost, safeDonationUrl } from "../donationUrl"
import { openDonate as openDonateWeb } from "../donateTarget.web"
import { openDonate as openDonateNative } from "../donateTarget.native"

describe("safeDonationUrl", () => {
  it("accepts a plain https link and trims it", () => {
    expect(safeDonationUrl("  https://give.example.org/river  ")).toBe("https://give.example.org/river")
  })

  it("refuses anything that is not a safe https link, so the card renders nothing", () => {
    for (const bad of [
      "http://give.example.org",
      "javascript:alert(1)",
      "https://192.168.0.1/pay",
      "https://xn--80ak6aa92e.com/",
      "https://user@give.example.org/",
      "give.example.org",
      "",
      null,
      undefined,
    ]) {
      expect(safeDonationUrl(bad), String(bad)).toBeNull()
    }
  })
})

describe("donationUrlHost", () => {
  it("shows the bare hostname, without www, port, path or query", () => {
    expect(donationUrlHost("https://www.give.example.org:8443/river?x=1#top")).toBe("give.example.org")
    expect(donationUrlHost("https://opencollective.com/river-keepers")).toBe("opencollective.com")
  })
})

describe("openDonate", () => {
  it("native prefers the in-app browser and falls back to a plain open", async () => {
    const calls: string[] = []
    openDonateNative({
      url: "https://give.example.org",
      openExternal: {
        open: async (url) => {
          calls.push(`open:${url}`)
        },
        openInAppBrowser: async (url) => {
          calls.push(`inapp:${url}`)
        },
      },
    })
    openDonateNative({
      url: "https://give.example.org",
      openExternal: {
        open: async (url) => {
          calls.push(`open:${url}`)
        },
      },
    })
    openDonateNative({ url: "https://give.example.org" })
    await Promise.resolve()
    expect(calls).toEqual(["inapp:https://give.example.org", "open:https://give.example.org"])
  })

  it("web opens a new, unlinked tab and never navigates the shell away", () => {
    const opened: unknown[] = []
    const win = { open: (...args: unknown[]) => opened.push(args) }
    const previous = (globalThis as { window?: unknown }).window
    ;(globalThis as { window?: unknown }).window = win
    try {
      openDonateWeb({ url: "https://give.example.org" })
    } finally {
      ;(globalThis as { window?: unknown }).window = previous
    }
    expect(opened).toEqual([["https://give.example.org", "_blank", "noopener,noreferrer"]])
  })
})
