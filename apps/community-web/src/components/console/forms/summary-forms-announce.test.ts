/**
 * These forms render an ErrorSummary, which is an alert and takes focus on submit. A field error that
 * is ALSO role="alert" fires one more assertive announcement per field on the same submit, so every
 * Field in them opts out; the aria-describedby wiring still exposes each message.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const FORMS = [
  "features/host/broadcasts/broadcast-composer.tsx",
  "features/host/org/org-profile-form.tsx",
  "features/host/org/verification-screen.tsx",
  "features/host/tickets/ticket-type-drawer.tsx",
]

describe("forms with an ErrorSummary", () => {
  for (const rel of FORMS) {
    it(`${rel} silences every per-field alert`, () => {
      const source = readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8")
      expect(source).toContain("<ErrorSummary")
      const fields = source.match(/<Field[\s>]/g) ?? []
      expect(fields.length).toBeGreaterThan(0)
      expect(source.match(/announceError=\{false\}/g) ?? []).toHaveLength(fields.length)
    })
  }
})
