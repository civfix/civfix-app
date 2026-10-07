import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { ticketFieldInputId } from "./ticket-type-drawer"

const SOURCE = readFileSync(new URL("./ticket-type-drawer.tsx", import.meta.url), "utf8")
const RENDERED_IDS = new Set([...SOURCE.matchAll(/\bid="(ticket-[^"]+)"/g)].map((m) => m[1]))

// The request fields the drawer edits through a text input or select, as the schema and server name them.
const FIELDS_WITH_INPUTS = [
  "name",
  "description",
  "capacity",
  "salesOpensAt",
  "salesClosesAt",
  "visibility",
  "accessCode",
  "maxPartySize",
]

describe("ticket drawer error summary", () => {
  it("links every field error to an input the drawer renders", () => {
    for (const field of FIELDS_WITH_INPUTS) {
      expect(RENDERED_IDS, field).toContain(ticketFieldInputId(field))
    }
  })
})
