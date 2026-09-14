/**
 * Source-text guards for the event LIFECYCLE surfaces: the restructured `EventDetailBody` region, the
 * `EventHoursBlock` and the relocated `LogHoursEditor`.
 *
 * The pure state machines are covered by `eventLifecycle.test.ts`. What is left is the wiring, and every
 * assertion here guards a rule that typecheck cannot see and review reliably misses:
 *
 *   1. Nothing marks an event completed any more. Status is a clock reading, so a surface that still
 *      imported the retired confirm dialog or the retired completion gate would be writing state the
 *      server no longer changes.
 *   2. `EventHoursBlock` imports no reanimated and no `Modal`/`FlatList`/`ScrollView`. It renders inside
 *      the event body's scroller, which on compact IS the gorhom sheet: a nested vertical scroller
 *      swallows the sheet's pan, and reanimated is the 0.36.1 worklet-factory crash class.
 *   3. The hours editor is GONE from the body. Its whole point was moving out of the dead zone below the
 *      host card and into the DONE region; a stray re-mount would show it twice on a finished event.
 *   4. The attendee receipt degrades through `?? false`. `anyLogged` is `.optional()` on the wire, and a
 *      bare truthiness read against an older server would tell every attendee they were skipped.
 *   5. Every `t("…")` key these files reference exists in `en/event-detail.json`. i18next has no
 *      compile-time check and `i18n:check` only compares catalogs to EACH OTHER, so a key missing from
 *      all four locales renders the raw key path to the user and sails through the gate.
 */
import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const body = readFileSync(new URL("../EventDetailBody.tsx", import.meta.url), "utf8")
const hoursBlock = readFileSync(new URL("../EventHoursBlock.tsx", import.meta.url), "utf8")
const editor = readFileSync(new URL("../LogHoursEditor.tsx", import.meta.url), "utf8")
const hostMode = readFileSync(new URL("../host/HostModeBody.tsx", import.meta.url), "utf8")

/**
 * Strip block + line comments so the assertions read CODE only - the header comments deliberately NAME
 * the banned components while explaining why they are absent, and a whole-file grep would trip on the
 * prose that documents the rule.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

describe("no surface marks an event completed any more", () => {
  it("mounts no completion dialog and imports no completion module", () => {
    for (const source of [code(hostMode), code(body)]) {
      expect(source).not.toMatch(/CompleteEventSheet/)
      expect(source).not.toMatch(/eventCompletionState/)
      expect(source).not.toMatch(/useCompleteCleanup/)
      expect(source).not.toMatch(/completionArmed/)
    }
    expect(existsSync(new URL("../../primitives/CompleteEventSheet.tsx", import.meta.url))).toBe(false)
  })

  it("sends the host's Log hours affordances at the dedicated screen", () => {
    expect(code(hostMode)).toContain('push({ kind: "host-log-hours", id })')
  })

  it("gates the slots block on a non-empty slot list", () => {
    expect(code(body)).toContain("cleanup.slots.length > 0")
  })

  it("injects a ticked `now` into the stage rather than letting the model read the clock", () => {
    const source = code(hostMode)
    expect(source).toContain("const stage = clock === null ? \"upcoming\" : hostStage(clock, now)")
    expect(source.match(/now: Date\.now\(\)/g) ?? []).toHaveLength(0)
  })

  it("ticks the clock off the shared hook and stops once the event can no longer change", () => {
    const source = code(hostMode)
    expect(source).toContain("useNow(boundaryAt === null ? 0 : PHASE_TICK_MS, { boundaryAt })")
    expect(source).toContain("nextEventBoundaryMs(clock, Date.now())")
    expect(source).not.toMatch(/react-native-reanimated/)
  })

  it("refetches the surfaces the boundary crossing invalidated", () => {
    expect(code(hostMode)).toContain("useEventBoundaryRefresh(clock, now, id)")
    expect(code(body)).toContain("useEventBoundaryRefresh(cleanup, now, cleanup.id)")
  })

  it("mounts <EventHoursBlock/> exactly once, and the block trusts that placement", () => {
    // The block hard-codes `status: "done"` because the lifecycle switch above IS its status gate. A
    // second mount outside the DONE arm would render hours talk on an upcoming event.
    expect(code(body).match(/<EventHoursBlock\b/g) ?? []).toHaveLength(1)
    expect(code(hoursBlock)).toContain('status: "done"')
  })

  it("no longer mounts the hours editor itself - it moved into EventHoursBlock", () => {
    expect(body).not.toContain("<LogHoursEditor")
    expect(body).not.toContain('from "./LogHoursEditor"')
    expect(hoursBlock).toContain('from "./LogHoursEditor"')
  })
})

describe("an ended event closes RSVP without closing check-in", () => {
  it("gates the non-host check-in row on the LIVE status, never on the end time", () => {
    const source = code(body)
    expect(source).toContain("!actsAsHost && canCheckIn && isLive")
    expect(source).not.toMatch(/canCheckIn && isUpcoming/)
  })

  it("puts only the RSVP surfaces behind the end time", () => {
    const source = code(body)
    expect(source).toContain("const isEnded = hasEventEnded(cleanup, now)")
    expect(source).toContain("const status = deriveCleanupStatus(cleanup, now)")
    expect(source).toContain("const isLive = !isCancelled && !isDone")
    expect(source).toContain("const isUpcoming = isLive && !isEnded")
    expect(source).toContain("readonly={isDone || isCancelled || isEnded}")
  })

  it("still shows a registered attendee their ticket once the event has ended", () => {
    const source = code(body)
    expect(source).toContain("(isUpcoming || isRegistered) ? (")
    expect(source).toContain('const isRegistered = cleanup.myRegistration?.status === "registered"')
  })
})

describe("EventHoursBlock renders inside its host's scroller", () => {
  it("imports no Modal, FlatList or ScrollView, and no reanimated", () => {
    const imports = hoursBlock.match(/^import[\s\S]*?from\s+"[^"]+"$/gm)?.join("\n") ?? ""
    expect(imports).not.toMatch(/\bModal\b/)
    expect(imports).not.toMatch(/\bFlatList\b/)
    expect(imports).not.toMatch(/\bScrollView\b/)
    expect(hoursBlock).not.toMatch(/react-native-reanimated/)
    // ...and does not reach for a scroller through a hook seam either.
    expect(hoursBlock).not.toMatch(/useScrollHost/)
  })

  it("plays the shared fadeUp on transform + opacity only, so useNativeDriver is safe everywhere", () => {
    expect(hoursBlock).toContain("motion.fadeUp")
    expect(hoursBlock).toContain("useNativeDriver: true")
    expect(hoursBlock).toContain("translateY")
  })

  it("honours reduce motion by dropping the rise and keeping the fade", () => {
    // The package convention (BodyTransition.native.tsx, usePopScale): reduce-motion suppresses the
    // POSITIONAL half only. This block wraps all four of its arms, so a missing path slid every one.
    const source = code(hoursBlock)
    expect(source).toContain("AccessibilityInfo.isReduceMotionEnabled()")
    expect(source).toContain('AccessibilityInfo.addEventListener("reduceMotionChanged"')
    expect(source).toContain("translateY.setValue(0)")
    // The fade still plays under reduce motion - it is only the offset that is settled outright.
    expect(source).toMatch(/timing\(opacity, 1\)\.start\(\)/)
    expect(source).toContain("sub?.remove()")
  })

  it("degrades an absent `anyLogged` to pending instead of accusing the host of skipping people", () => {
    expect(code(hoursBlock)).toContain("anyLogged: data?.anyLogged ?? false")
  })

  it("keeps a credited row whose user has left the roster, under a neutral label", () => {
    expect(code(hoursBlock)).toContain("log_hours.row_unknown")
  })

  it("uses the WCAG-safe coral ink token and never the fill token for text", () => {
    expect(code(hoursBlock)).not.toMatch(/theme\.colors\.accent\b(?!Text)/)
  })
})

describe("LogHoursEditor re-opens seeded rather than blank", () => {
  it("seeds its drafts from the already-credited rows on every open", () => {
    const source = code(editor)
    expect(source).toContain("seedHoursDrafts(initialEntries ?? [])")
    expect(source).toContain("setHoursDrafts(seeded)")
  })

  it("hands the screen back to the summary card on cancel AND on a successful save", () => {
    // Two call sites, no more: the cancel path and the mutation's onSuccess.
    expect(code(editor).match(/onClose\?\.\(\)/g) ?? []).toHaveLength(2)
  })

  it("never puts the ACTING VIEWER in the roster it submits", () => {
    // The server throws `forbidden` for `entry.userId === actorId` BEFORE writing anything, and the
    // roster returns the organizer FIRST - so an unfiltered list 403'd the whole batch and credited
    // nobody. The filter must sit on `attendees`, which every downstream reader shares.
    const source = code(editor)
    expect(source).toContain("roster.filter((a) => a.id !== viewerId)")
    expect(source).toContain("const viewerId = user?.id")
    // Rows, "Apply to all", the validity scan and the request all read the FILTERED list.
    expect(source).toContain("attendees.map((a) => a.id)")
    expect(source).toContain("Object.fromEntries(")
    expect(source).toMatch(/attendees\.map\(\(a\) => \{[\s\S]*?defaultHoursDraft\]/)
    expect(source).toMatch(/for \(const attendee of attendees\)/)
    expect(source).toContain("attendees.some(")
    // ...and the raw roster is never mapped into rows or entries behind its back.
    expect(source).not.toMatch(/roster\.map\(/)
    // The absent row is explained rather than silently missing.
    expect(source).toContain("log_hours.self_note")
    expect(source).toContain("viewerOnRoster")
  })

  it("stops promising that a blank row removes an existing credit", () => {
    // The server upserts the rows it is sent and has no void path, so an emptied row leaves the old
    // credit standing. The edit pass says so; the first pass keeps the original skip hint.
    const source = code(editor)
    expect(source).toContain("log_hours.blank_hint_edit")
    expect(source).toContain("hasLoggedRows ? t(\"log_hours.blank_hint_edit\") : t(\"log_hours.blank_hint\")")
    expect(source).toContain("const hasLoggedRows = (initialEntries?.length ?? 0) > 0")
  })
})

/** `key`, `key_one` or `key_other` - a plural key never exists under its bare path. */
function catalogHas(catalog: Record<string, unknown>, path: string): boolean {
  const parts = path.split(".")
  const leaf = parts.pop()
  if (!leaf) return false
  let node: unknown = catalog
  for (const part of parts) {
    if (typeof node !== "object" || node === null) return false
    node = (node as Record<string, unknown>)[part]
  }
  if (typeof node !== "object" || node === null) return false
  const obj = node as Record<string, unknown>
  return leaf in obj || `${leaf}_one` in obj || `${leaf}_other` in obj
}

describe("the lifecycle surfaces reference only real keys", () => {
  const eventDetail = JSON.parse(
    readFileSync(new URL("../../i18n/locales/en/event-detail.json", import.meta.url), "utf8"),
  ) as Record<string, unknown>
  const volunteerHours = JSON.parse(
    readFileSync(new URL("../../i18n/locales/en/volunteer-hours.json", import.meta.url), "utf8"),
  ) as Record<string, unknown>

  const SOURCES = {
    "EventDetailBody.tsx": body,
    "EventHoursBlock.tsx": hoursBlock,
    "LogHoursEditor.tsx": editor,
  }

  for (const [name, source] of Object.entries(SOURCES)) {
    it(`${name}'s keys all exist in en/event-detail.json`, () => {
      // Dotted lowercase literals are the i18n keys in these files; nothing else in them is quoted in
      // that shape (style values are single words, module specifiers carry a slash or a leading dot,
      // and the one cross-namespace key carries a colon so it is excluded here on purpose).
      const keys = [...source.matchAll(/"([a-z][a-z0-9_]*\.[a-z0-9_]+)"/g)].map((m) => m[1] ?? "")
      expect(keys.length).toBeGreaterThan(0)
      expect(keys.filter((key) => !catalogHas(eventDetail, key))).toEqual([])
    })
  }

  it("resolves the summary card's cross-namespace hours unit", () => {
    expect(hoursBlock).toContain('"volunteer-hours:ledger.hours_unit"')
    expect(catalogHas(volunteerHours, "ledger.hours_unit")).toBe(true)
  })
})
