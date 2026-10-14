/**
 * The expanded main-map picker mirrors an external value into its own pick store, so an
 * address pick is handed over through the picker's value alone. A caller that also writes the store
 * keeps a second, divergent path to the same pin.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { reportFlowSource } from "../reportFlow/__tests__/reportFlowSource"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

describe("address picks reach the main-map picker through its value", () => {
  it("the report flow never writes the pick store itself", () => {
    expect(reportFlowSource()).not.toContain("useLocationPick")
  })

  for (const rel of ["../CleanupForm.tsx"]) {
    it(`${rel} never writes the pick store itself`, () => {
      expect(read(rel)).not.toContain("useLocationPick")
    })
  }
})
