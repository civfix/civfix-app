/**
 * The list-layout headline. Pins BOTH the picker default (unchanged) and the feed's title headline, which
 * exists because a `LinkedReportRef` carries no `referenceCode` - so every feed post with an attached
 * report used to render "Dump: 550e8400-e29b-41d4-a716-446655440000".
 */
import { describe, expect, it } from "vitest"
import { linkedReportHeadline } from "../linkedReportHeadline"

describe("linkedReportHeadline", () => {
  it("prints '<type>: <reference>' for the picker default", () => {
    const out = linkedReportHeadline(
      { id: "550e8400-e29b-41d4-a716-446655440000", title: "Sofa", referenceCode: "DU-42-000001" },
      "reference",
      "Dump",
      "Trash",
    )
    expect(out).toBe("Dump: DU-42-000001")
  })

  it("falls back to the raw id when no reference has been minted", () => {
    const out = linkedReportHeadline(
      { id: "550e8400", title: "Sofa", referenceCode: "  " },
      "reference",
      "Dump",
      "Trash",
    )
    expect(out).toBe("Dump: 550e8400")
  })

  it("prints the human title for the feed headline", () => {
    const out = linkedReportHeadline({ id: "550e8400", title: "  Sofa on the sidewalk " }, "title", "Dump", "Trash")
    expect(out).toBe("Sofa on the sidewalk")
  })

  it("falls back to the category label when the title is blank", () => {
    expect(linkedReportHeadline({ id: "x", title: "   " }, "title", "Dump", "Trash")).toBe("Trash")
    expect(linkedReportHeadline({ id: "x", title: null }, "title", "Dump", "Trash")).toBe("Trash")
    expect(linkedReportHeadline({ id: "x" }, "title", "Dump", "Trash")).toBe("Trash")
  })
})
