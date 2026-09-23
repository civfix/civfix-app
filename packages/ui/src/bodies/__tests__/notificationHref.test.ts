import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const notifications = readFileSync(new URL("../NotificationsBody.tsx", import.meta.url), "utf8")

describe("NotificationsBody resolves a notification link through the host's address map", () => {
  it("prefers the host's entryFor and falls back to the shared parser", () => {
    expect(notifications).toContain("const entryForHref = useOpenInternalHref()?.entryFor ?? entryFromPath")
    expect(notifications).toContain("const entry = entryForHref(item.link)")
    expect(notifications).toContain("[entryForHref, mutateRead]")
  })
})
