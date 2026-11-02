/**
 * In the wide layout the system notice is the only top bar on web (the download banner is portrait-only),
 * so the rail and the side panel move down by its published height. ExpandedShell needs the native-only
 * primitives to render, so its wiring is pinned by source; the offsets themselves are the frame plan's.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { NAV_FOOTPRINT, NAV_TOP, expandedTopOffsets } from "../expandedFramePlan"

const expanded = readFileSync(new URL("../ExpandedShell.tsx", import.meta.url), "utf8")
const rail = readFileSync(new URL("../Rail.tsx", import.meta.url), "utf8")

describe("ExpandedShell (web): room for the system notice", () => {
  it("T22: with no notice every offset is today's", () => {
    expect(expandedTopOffsets(0)).toEqual({ railTop: NAV_TOP, cardTop: NAV_FOOTPRINT })
  })

  it("T22: a 36px notice moves the rail and the side panel exactly 36px lower", () => {
    const none = expandedTopOffsets(0)
    const notice = expandedTopOffsets(36)
    expect(notice.railTop - none.railTop).toBe(36)
    expect(notice.cardTop - none.cardTop).toBe(36)
  })

  it("T22: the shell reads the notice height and places the card, its resize handle and the rail by it", () => {
    expect(expanded).toContain("const noticeHeight = useSystemNoticeStore((s) => s.height)")
    expect(expanded).toContain("const { cardTop } = expandedTopOffsets(noticeHeight)")
    expect(expanded).toMatch(/styles\.card,[\s\S]{0,80}\{ top: cardTop, width: animatedWidth \}/)
    expect(expanded).toMatch(/styles\.resizeHandle,[\s\S]{0,40}\{ top: cardTop, transform:/)
    expect(expanded).toContain("<Rail topInset={noticeHeight} />")
    expect(rail).toContain("expandedTopOffsets(topInset).railTop")
  })
})
