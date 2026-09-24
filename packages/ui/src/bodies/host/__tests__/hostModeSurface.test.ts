import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const body = strip(read("../HostModeBody.tsx"))
const sheets = strip(read("../HostModeSheets.tsx"))
const sheetActions = strip(read("../useHostSheetActions.ts"))
const copy = strip(read("../hostModeCopy.ts"))
const panels = strip(read("../HostInsightsPanels.tsx"))
const bodyState = strip(read("../HostBodyState.tsx"))
const model = strip(read("../hostSurfaceModel.ts"))
const roster = strip(read("../EventRosterBlock.tsx"))
const rosterList = strip(read("../RosterCheckinList.tsx"))
const rosterPaged = strip(read("../RosterPagedList.tsx"))
const announce = strip(read("../HostAnnounceBody.tsx"))
const invite = strip(read("../HostTeamInviteSheet.tsx"))
const inviteFields = strip(read("../InviteIdentifierFields.tsx"))
const checkin = strip(read("../HostCheckinBody.tsx"))
const ticket = strip(read("../MyTicketBody.tsx"))
const cancelSheet = strip(read("../../../primitives/CancelEventSheet.tsx"))
const target = strip(read("../../hostDashboardTarget.ts"))
const detail = strip(read("../../EventDetailBody.tsx"))
const hooks = strip(read("../../../data/hooks/host.ts"))
const reachSelector = strip(read("../../../primitives/consoleReach.ts"))
const reachWeb = strip(read("../../../primitives/consoleReach.web.ts"))
const reachNative = strip(read("../../../primitives/consoleReach.native.ts"))
const keys = strip(read("../../../data/keys.ts"))
const cleanupHooks = strip(read("../../../data/hooks/cleanups.ts"))

const HOST_SOURCES: Record<string, string> = {
  "HostModeBody.tsx": body,
  "HostModeSheets.tsx": sheets,
  "useHostSheetActions.ts": sheetActions,
  "hostModeCopy.ts": copy,
  "HostInsightsPanels.tsx": panels,
  "hostSurfaceModel.ts": model,
  "EventRosterBlock.tsx": roster,
  "RosterCheckinList.tsx": rosterList,
  "RosterPagedList.tsx": rosterPaged,
  "HostAnnounceBody.tsx": announce,
  "HostTeamInviteSheet.tsx": invite,
  "InviteIdentifierFields.tsx": inviteFields,
}

describe("the comms rework", () => {
  it("reaches the event group chat and the announcement composer, and emails nobody", () => {
    expect(body).toContain('kind: "thread"')
    expect(body).toContain('roomKind: "cleanup"')
    expect(body).toContain('kind: "host-announce"')
    expect(body).not.toContain("emailAttendeesPreset")
    expect(body).not.toContain("setBroadcastPreset")
    expect(body).not.toContain('t("row.email")')
    expect(model).not.toContain('"email"')
  })

  it("suppresses a row the PhaseHeader is already showing, from the pure model", () => {
    expect(body).toContain("ctas: [primary, secondary],")
    expect(model).toContain("const shown = ctaRowKeys(input.ctas)")
    expect(model).toContain("card.rows.filter((row) => !shown.has(row))")
  })

  it("lists what the host already sent, with the counts only this surface shows", () => {
    expect(body).toContain("<HostAnnouncementsBlock cleanupId={id} />")
    expect(strip(read("../HostAnnouncementsBlock.tsx"))).toContain("showDelivery")
    expect(strip(read("../EventAnnouncementsBlock.tsx"))).not.toContain("showDelivery")
  })

  it("sends through the announcement endpoint, never the draft-and-send broadcast machine", () => {
    expect(announce).toContain("useCreateAnnouncement")
    expect(announce).not.toContain("useQuickBroadcast")
    expect(announce).not.toContain("createEventBroadcast")
  })
})

describe("the host surface spends its coral once", () => {
  it("renders exactly one PrimaryButton, and it is the PhaseHeader's CTA", () => {
    expect(`${body}\n${sheets}`.match(/<PrimaryButton\b/g) ?? []).toHaveLength(1)
    expect(sheets).toContain('variant="destructive"')
    expect(strip(read("../PhaseHeader.tsx"))).toContain("<PrimaryButton")
  })

  it("takes the CTA and the action rows from the pure model, not from inline phase branches", () => {
    expect(body).toContain("const primary = hostPrimaryCta(surface)")
    expect(body).toContain("const secondary = hostSecondaryCta(surface)")
    expect(body).toContain("const cards = hostActionCards({")
    expect(body).not.toMatch(/phase === "ended" \?\s*t\("cta\./)
  })

  it("keeps every brand fill out of the host surface's own source", () => {
    for (const [name, source] of Object.entries(HOST_SOURCES)) {
      expect(source.match(/colors\.brand\.bloom/g) ?? [], `${name} still fills with the brand hue`)
        .toHaveLength(0)
      expect(source.match(/"#[0-9a-fA-F]{3,8}"/g) ?? [], `${name} hardcodes a colour`).toHaveLength(0)
      expect(source.match(/colors\.bloom\["700"\]/g) ?? [], `${name} uses the old danger hue`)
        .toHaveLength(0)
    }
  })

  it("spells destructive copy in the danger ink token everywhere it survived", () => {
    expect(checkin).toContain("colors.dangerInk")
    expect(ticket).toContain("colors.dangerInk")
    expect(checkin).not.toContain('colors.bloom["700"]')
    for (const part of ["../checkin/CheckinDeskCards.tsx", "../checkin/CheckinRosterSection.tsx"]) {
      const src = strip(read(part))
      expect(src).toContain("colors.dangerInk")
      expect(src).not.toContain('colors.bloom["700"]')
    }
    expect(ticket).not.toContain('colors.bloom["700"]')
  })
})

describe("cancelling lives in the danger card and nowhere else", () => {
  it("reaches CancelEventSheet from the host surface only", () => {
    expect(body).toContain("<HostModeSheets")
    expect(sheets).toContain("<CancelEventSheet")
    expect(detail).not.toContain("<CancelEventSheet")
    expect(detail).not.toContain('t("actions.cancel_event")')
  })

  it("makes the confirm destructive rather than another coral button", () => {
    expect(cancelSheet).toContain('variant="destructive"')
    expect(cancelSheet).toContain("colors.dangerInk")
  })

  it("renders the cancel row without a chevron, in the destructive variant", () => {
    expect(body).toContain('variant={row === "cancel" ? "destructive" : "default"}')
    expect(body).toContain('chevron={row === "cancel" ? false : undefined}')
  })
})

describe("selection is neutral", () => {
  it("gives the roster FilterChips instead of a hand-rolled chip row", () => {
    expect(roster).toContain("<FilterChip")
    expect(roster).not.toContain("styles.chipOn")
  })

  it("gives the announcement audience a radio list with live counts, and the invite a SegmentedControl", () => {
    expect(announce).toContain('accessibilityRole="radiogroup"')
    expect(announce).toContain('accessibilityRole="radio"')
    expect(announce).toContain("useAudiencePreview")
    expect(announce).not.toContain("styles.segmentOn")
    expect(invite).toContain("<InviteIdentifierFields")
    expect(inviteFields).toContain("<SegmentedControl")
    expect(invite).not.toContain("styles.segmentOn")
    expect(inviteFields).not.toContain("styles.segmentOn")
  })
})

describe("the dashboard handoff is one file on both platforms", () => {
  it("pushes the shared host-mode route rather than leaving the shell", () => {
    expect(target).toContain('push({ kind: "host-mode", id: target.eventId })')
    expect(target).not.toContain("window.location")
    expect(target).not.toContain("openExternal")
  })

  it("answers in the app instead of sending the host out to the console", () => {
    expect(body).not.toContain("ConsoleLinkRow")
    expect(body).not.toContain("AnalyticsCarouselCard")
    expect(body).toContain('title={tAnalytics("card.view_full")}')
    expect(body).toContain('push({ kind: "event-analytics", id })')
  })

  it("collapses the event detail's host block to the single dashboard row", () => {
    expect(detail).toContain("openHostDashboard({ eventId: cleanup.id })")
    expect(detail.match(/<EventActionRow\b/g) ?? []).not.toHaveLength(0)
    expect(detail).not.toContain('t("host.request_resources")')
    expect(detail).not.toContain('t("complete.action")')
  })
})

describe("the tickets row is gated on the platform, not on a capability every host injects", () => {
  it("reads reachability from the seam rather than from the presence of openExternal", () => {
    expect(body).toContain("consoleReachable,")
    expect(body).not.toContain("ticketsReachable")
    expect(body).not.toContain("!!openExternal")
    expect(strip(read("../hostSurfaceModel.ts"))).toContain(
      'if (before && can.manageTickets && input.consoleReachable) configure.push("tickets")',
    )
  })

  it("answers true on the web and false on native, and the selector re-exports the web file", () => {
    expect(reachWeb).toContain("export const consoleReachable = true")
    expect(reachNative).toContain("export const consoleReachable = false")
    expect(reachSelector).toContain('from "./consoleReach.web"')
  })

  it("opens the console through the one helper the tickets row still needs", () => {
    expect(body).toContain("openConsolePath(managePath(id), openExternal)")
  })
})

describe("insights wiring", () => {
  it("polls on the live cadence and idles otherwise", () => {
    expect(hooks).toContain("opts.live ? INSIGHTS_LIVE_POLL_MS : INSIGHTS_IDLE_POLL_MS")
    expect(hooks).toContain("export const INSIGHTS_LIVE_POLL_MS = HOST_COUNTERS_POLL_MS")
    expect(body).toContain('live: clockPhase === "live"')
  })

  it("keeps the rendered frame across a refetch rather than flashing a skeleton", () => {
    expect(hooks).toContain("placeholderData: (previous) => previous")
  })

  it("says so in the hero caption when the kept frame is a failed refresh, not fresh numbers", () => {
    expect(body).toContain("stale={failed}")
    expect(panels).toContain("const caption = stale ? t(\"hero.stale\") : fresh")
    expect(panels).toContain("stale={stale}")
  })

  it("asks for insights only when the viewer may read analytics", () => {
    expect(body).toContain("enabled: can.viewAnalytics")
    expect(body).toContain("{can.viewAnalytics ? (")
  })

  it("refreshes the hero whenever anything about the event changes", () => {
    expect(keys).toContain('eventInsights: (id: string) => ["host", id, "insights"] as const')
    expect(hooks).toContain("void qc.invalidateQueries({ queryKey: queryKeys.eventInsights(cleanupId) })")
  })

  it("refreshes it after a shift claim too, so the hero and the shift board agree", () => {
    const claim = cleanupHooks.slice(
      cleanupHooks.indexOf("export function claimEventSlotMutationOptions"),
      cleanupHooks.indexOf("export function useClaimEventSlot"),
    )
    expect(claim).toContain(
      "void qc.invalidateQueries({ queryKey: queryKeys.eventInsights(cleanupId) })",
    )
  })

  it("covers loading, error and the analytics-less viewer", () => {
    expect(body).toContain("<HeroSkeleton />")
    expect(body).toContain("<TilesSkeleton columns={columns} count={4} />")
    expect(body).toContain('title={t("state.insights_error_title")}')
    expect(body).toContain('<HostBodyState state="denied" t={t} />')
    expect(bodyState).toContain('icon="Lock"')
  })

  it("reads the phase from the server once it arrives, and from the clock until then", () => {
    expect(body).toContain("const phase = insights.data?.phase ?? clockPhase")
    expect(body).toContain("eventPhase(")
  })
})

describe("density comes from the measured content, not from the window", () => {
  it("never reads a window dimension for layout - the shell mounts it in a 300-640px panel", () => {
    expect(body).not.toContain("useWindowDimensions")
    expect(body).not.toContain("Dimensions")
  })

  it("measures its own stack and feeds the tile columns and the wide CTA row from it", () => {
    expect(body).toContain("onLayout={onContentLayout}")
    expect(body).toContain("setContentWidth(layout.nativeEvent.layout.width)")
    expect(body).toContain("const columns = statTileColumns(contentWidth)")
    expect(body).toContain("const wide = contentWidth >= STAT_TILE_WIDE_AT")
  })

  it("shares the one density threshold with the stat tiles instead of restating it", () => {
    expect(body).not.toMatch(/const WIDE_AT = \d+/)
    expect(strip(read("../../../primitives/statTileModel.ts"))).toContain(
      "export const STAT_TILE_WIDE_AT = 480",
    )
  })
})

describe("the panels render only what the phase asked for", () => {
  it("drives every card off hostPanels rather than a second phase table", () => {
    expect(panels).toContain("const panels = hostPanels(phase)")
    expect(panels).toContain("{panels.signups ?")
    expect(panels).toContain("{panels.arrivals ?")
    expect(panels).toContain("{panels.messages ?")
  })

  it("hides the ticket-type and sign-up cards when there is nothing to draw", () => {
    expect(panels).toContain("if (insights.byTicketType.length < 2) return null")
    expect(panels).toContain("if (points.length < 2) return null")
    expect(panels).toContain("if (points.length === 0) return null")
    expect(panels).toContain("if (insights.broadcasts.length === 0) return null")
  })

  it("names the top volunteers from the card both host screens share", () => {
    expect(panels).toContain("{panels.topVolunteers ?")
    expect(panels).toContain("<TopVolunteersCard")
    expect(panels).toContain("entries={insights.topVolunteers}")
    expect(panels).toContain('label={t("top_volunteers.title")}')
    expect(panels).toContain('caption={t("top_volunteers.caption")}')
  })

  it("draws the shift board from the slot model, marking the running shift only while live", () => {
    expect(panels).toContain("{panels.shifts ?")
    expect(panels).toContain("<ShiftsPanel")
    expect(panels).toContain("<ShiftRow")
    expect(panels).toContain("if (!boardHasTimedSlots(slots)) return null")
    expect(panels).toContain("slotDisplayOrder(slots)")
    expect(panels).toContain('phase === "live" ? new Set(currentShifts(slots, new Date(now))')
  })

  it("takes the event's slots from the cleanup the body already holds", () => {
    expect(body).toContain("slots={event.slots ?? []}")
    expect(body).toContain("now={now}")
  })
})

describe("one rhythm across both host screens", () => {
  it("spaces console cards on the dashboard's section gap, not on the intra-card one", () => {
    expect(panels).toContain("<View style={styles.sections}>")
    expect(/sections: \{\s*gap: t\.space\["6"\],/.test(panels)).toBe(true)
    expect(/\n {2}stack: \{\s*gap: t\.space\["3"\],/.test(panels)).toBe(true)
    expect(body).toContain("<View style={styles.sections}>")
    expect(/sections: \{\s*gap: t\.space\["6"\],/.test(body)).toBe(true)
    expect(/body: \{\s*gap: t\.space\["6"\],/.test(body)).toBe(true)
  })

  it("says how many were credited without a denominator the number cannot sit inside", () => {
    expect(panels).toContain("hoursHintHasDenominator(credited, attended)")
    expect(panels).toContain('t("tiles.hours_hint", { credited, attended })')
    expect(panels).toContain('t("tiles.hours_hint_credited", { count: credited })')
  })
})

describe("one hero size across both host screens", () => {
  it("renders the compact hero unconditionally instead of threading a density prop", () => {
    expect(panels).not.toContain("compact={compact}")
    expect(panels).not.toContain("compact: boolean")
    expect(body).not.toContain("compact={wide}")
  })

  it("keeps the skeleton hero the same height as the real one", () => {
    expect(strip(read("../HostSkeletons.tsx"))).toContain("const HERO_VALUE_HEIGHT = 42")
  })
})

describe("every t(...) key the surface uses exists in en/host-mode.json", () => {
  const catalog = JSON.parse(
    readFileSync(new URL("../../../i18n/locales/en/host-mode.json", import.meta.url), "utf8"),
  ) as Record<string, unknown>

  function has(path: string): boolean {
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

  it.each(["HostModeBody.tsx", "HostModeSheets.tsx", "useHostSheetActions.ts", "hostModeCopy.ts", "HostInsightsPanels.tsx"])("%s", (name) => {
    const source = HOST_SOURCES[name] as string
    const keys = [...source.matchAll(/\bt\("([a-z][a-z0-9_]*\.[a-z0-9_.]+)"/g)].map((m) => m[1] ?? "")
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.filter((key) => !key.includes(":") && !has(key))).toEqual([])
  })

  it("covers the dynamic key families the surface builds from the model", () => {
    for (const prefix of ["cta", "row", "section", "tiles", "hero", "phase"]) {
      expect(catalog[prefix], prefix).toBeTypeOf("object")
    }
  })
})
