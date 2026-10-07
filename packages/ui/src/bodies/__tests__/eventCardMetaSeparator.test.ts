/**
 * The event card's foot row - "{N} going . {dist}" - and its separator dot.
 *
 * The row is allowed to WRAP: the foot reserves 88px for the absolutely-positioned RSVP pill, and in
 * es/de/ko the attendee-count label ("21 asistentes", "21 Teilnehmer") needs the full remaining width, so
 * the distance drops to a line of its own rather than ellipsis-clipping the word. A separator, though,
 * only means anything BETWEEN two segments on ONE line: in flow before the distance it dangles at the end
 * of line 1 ("8 going *"), and inside the distance's wrap group it opens line 2 ("* 0.4 mi").
 * So the separator HANGS: the count reserves the dot's width as trailing margin and the dot is
 * absolutely positioned back into that margin, 8px left of the distance group. On one line it lands on
 * exactly the pixel the in-flow dot did; on a wrapped line the group starts at x=0 so the dot lands at
 * x=-8, outside `cnt`, whose `overflow: hidden` clips it away. The separator is painted iff both of its
 * neighbours share a line - it cannot orphan on either side.
 *
 * Pinned by source grep: EventsBody imports react-native, which this package's node-environment vitest
 * cannot load, so the component invariants are read off the source - the house pattern (see
 * `wizardDetailAffordances.test.ts`, `searchInboxAffordances.test.ts`).
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const events = strip(read("../EventsBody.tsx"))
const metaDot = strip(read("../../primitives/MetaDot.tsx"))

/** Pull one StyleSheet entry's body ("name: { ... }") out of the stripped source. */
function styleBlock(src: string, name: string): string {
  const m = new RegExp(`\\n  ${name}: \\{([\\s\\S]*?)\\n  \\},`).exec(src)
  // `noUncheckedIndexedAccess` types a capture group as `string | undefined`, so the group is checked
  // rather than asserted - a regex that matched with an empty group would otherwise typecheck-fail here.
  if (!m || m[1] === undefined) throw new Error(`style "${name}" not found`)
  return m[1]
}

/** The design's separator dot is a 3px View; the foot row spaces its items with a 5px flex gap. */
const DOT_WIDTH = 3
const ROW_GAP = 5
/** What the count must reserve so the distance keeps its old x: one gap + the dot. */
const RESERVED = ROW_GAP + DOT_WIDTH

describe("event card foot: the separator can never orphan", () => {
  it("keeps the wrap the non-English locales need (the row is allowed to break)", () => {
    expect(styleBlock(events, "cnt")).toMatch(/flexWrap: "wrap"/)
    // ...and the count still wraps its own word rather than clipping it.
    expect(events).toMatch(/styles\.cntText[\s\S]{0,80}numberOfLines=\{2\}/)
  })

  it("hangs the dot out of flow, 8px left of the distance group", () => {
    const sep = styleBlock(events, "cntSep")
    expect(sep).toMatch(/position: "absolute"/)
    expect(sep).toMatch(new RegExp(`left: -${RESERVED}\\b`))
    // top+bottom+centred keeps the 3px dot on the group's centre line (the row is alignItems:center, so
    // that IS the line's centre line) without the dot taking part in layout.
    expect(sep).toMatch(/top: 0/)
    expect(sep).toMatch(/bottom: 0/)
    expect(sep).toMatch(/justifyContent: "center"/)
    // The dot is INSIDE the distance's wrap group, so the two can never be separated by a line break.
    expect(events).toMatch(
      /<View style=\{styles\.cntDistGroup\}>\s*<View style=\{styles\.cntSep\}>\s*<MetaDot/,
    )
  })

  it("clips the hanging dot when the distance takes a line of its own", () => {
    // Without this the dot at x=-8 would simply paint outside the row: the clip IS the fix.
    expect(styleBlock(events, "cnt")).toMatch(/overflow: "hidden"/)
  })

  it("reserves the separator's exact width on the count, and only when a distance follows", () => {
    expect(styleBlock(events, "cntTextSep")).toMatch(new RegExp(`marginRight: ${RESERVED}`))
    // Gated on `dist`: with no distance there is no separator, so there is no reserved space either.
    expect(events).toMatch(/style=\{\[styles\.cntText, dist \? styles\.cntTextSep : null\]\}/)
    // The reserved margin + the row's own gap must equal the in-flow spacing it replaced
    // (gap + dot + gap), or the unwrapped row would shift and portrait pixels would move.
    expect(RESERVED + ROW_GAP).toBe(ROW_GAP + DOT_WIDTH + ROW_GAP)
    expect(styleBlock(events, "cnt")).toMatch(new RegExp(`gap: ${ROW_GAP}`))
    expect(styleBlock(metaDot, "dot")).toMatch(new RegExp(`width: ${DOT_WIDTH}`))
  })

  it("leaves the sub line's in-flow dots alone (it does not wrap, so they cannot orphan)", () => {
    const sub = styleBlock(events, "sub")
    expect(sub).not.toMatch(/flexWrap/)
    expect(sub).toMatch(/flexDirection: "row"/)
  })
})
