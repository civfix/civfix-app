import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { eventIcsUid } from "@civfix/shared/ics"

const source = readFileSync(new URL("./signup-view.tsx", import.meta.url), "utf8")

describe("the public signup page's add-to-calendar", () => {
  it("takes its uid from the shared helper rather than a hand-written literal", () => {
    expect(source).toContain("uid: eventIcsUid(page.event.id)")
    expect(source).not.toContain("@civfix.org`")
    expect(eventIcsUid("e1")).toBe("cleanup-e1@civfix.org")
  })

  it("still builds the file client-side: GET /cleanups/:id/ics rides the event visibility gate, which 404s an access-code page for a signed-out visitor", () => {
    expect(source).toContain("buildIcs(")
    expect(source).not.toContain("getEventIcs")
  })

  it("carries the fields that make a shared uid safe - it can say CANCELLED, which a ticket-only build cannot", () => {
    expect(source).toContain('status: page.event.status === "cancelled" ? "CANCELLED" : "CONFIRMED"')
    expect(source).toContain("description: page.event.description")
  })

  it("downloads through the one blob helper, which defers the revoke Safari trips over", () => {
    expect(source).toContain("downloadBlob(")
    expect(source).not.toContain("revokeObjectURL")
  })
})
