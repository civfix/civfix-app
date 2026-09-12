import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const body = strip(read("../HostModeBody.tsx"))
const panels = strip(read("../HostInsightsPanels.tsx"))
const model = strip(read("../hostSurfaceModel.ts"))
const roster = strip(read("../EventRosterBlock.tsx"))
const broadcast = strip(read("../HostBroadcastQuickBody.tsx"))
const invite = strip(read("../HostTeamInviteSheet.tsx"))
const checkin = strip(read("../HostCheckinBody.tsx"))
const ticket = strip(read("../MyTicketBody.tsx"))
const cancelSheet = strip(read("../../../primitives/CancelEventSheet.tsx"))
const target = strip(read("../../hostDashboardTarget.ts"))
const detail = strip(read("../../EventDetailBody.tsx"))
const hooks = strip(read("../../../data/hooks/host.ts"))
const keys = strip(read("../../../data/keys.ts"))

const HOST_SOURCES: Record<string, string> = {
  "HostModeBody.tsx": body,
  "HostInsightsPanels.tsx": panels,
  "hostSurfaceModel.ts": model,
  "EventRosterBlock.tsx": roster,
  "HostBroadcastQuickBody.tsx": broadcast,
  "HostTeamInviteSheet.tsx": invite,
}

describe("the host surface spends its coral once", () => {
  it("renders exactly one PrimaryButton, and it is the PhaseHeader's CTA", () => {
    expect(body.match(/<PrimaryButton\b/g) ?? []).toHaveLength(1)
    expect(body).toContain('variant="destructive"')
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
        .toHaveLength(name === "HostBroadcastQuickBody.tsx" ? 1 : 0)
      expect(source.match(/"#[0-9a-fA-F]{3,8}"/g) ?? [], `${name} hardcodes a colour`).toHaveLength(0)
      expect(source.match(/colors\.bloom\["700"\]/g) ?? [], `${name} uses the old danger hue`)
        .toHaveLength(0)
    }
  })

  it("spells destructive copy in the danger ink token everywhere it survived", () => {
    expect(checkin).toContain("colors.dangerInk")
    expect(ticket).toContain("colors.dangerInk")
    expect(checkin).not.toContain('colors.bloom["700"]')
    expect(ticket).not.toContain('colors.bloom["700"]')
  })
})

describe("cancelling lives in the danger card and nowhere else", () => {
  it("reaches CancelEventSheet from the host surface only", () => {
    expect(body).toContain("<CancelEventSheet")
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

describe("selection is neutral now", () => {
  it("gives the roster FilterChips instead of a hand-rolled chip row", () => {
    expect(roster).toContain("<FilterChip")
    expect(roster).not.toContain("styles.chipOn")
  })

  it("gives the broadcast audience and the invite identifier a SegmentedControl", () => {
    expect(broadcast).toContain("<SegmentedControl")
    expect(broadcast).not.toContain("styles.segmentOn")
    expect(invite).toContain("<SegmentedControl")
    expect(invite).not.toContain("styles.segmentOn")
  })
})

describe("the dashboard handoff is one file on both platforms", () => {
  it("pushes the shared host-mode route rather than leaving the shell", () => {
    expect(target).toContain('push({ kind: "host-mode", id: target.eventId })')
    expect(target).not.toContain("window.location")
    expect(target).not.toContain("openExternal")
  })

  it("leaves the console reachable through the targetable row instead", () => {
    expect(body).toContain('<ConsoleLinkRow target={{ kind: "event", eventId: id }} />')
  })

  it("collapses the event detail's host block to the single dashboard row", () => {
    expect(detail).toContain("openHostDashboard({ eventId: cleanup.id })")
    expect(detail.match(/<EventActionRow\b/g) ?? []).not.toHaveLength(0)
    expect(detail).not.toContain('t("host.request_resources")')
    expect(detail).not.toContain('t("complete.action")')
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

  it("asks for insights only when the viewer may read analytics", () => {
    expect(body).toContain("enabled: can.viewAnalytics")
    expect(body).toContain("{can.viewAnalytics ? (")
  })

  it("refreshes the hero whenever anything about the event changes", () => {
    expect(keys).toContain('eventInsights: (id: string) => ["host", id, "insights"] as const')
    expect(hooks).toContain("void qc.invalidateQueries({ queryKey: queryKeys.eventInsights(cleanupId) })")
  })

  it("covers loading, error and the analytics-less viewer", () => {
    expect(body).toContain("<HeroSkeleton />")
    expect(body).toContain("<TilesSkeleton columns={columns} />")
    expect(body).toContain('title={t("state.insights_error_title")}')
    expect(body).toContain('icon="Lock"')
  })

  it("reads the phase from the server once it arrives, and from the clock until then", () => {
    expect(body).toContain("const phase = insights.data?.phase ?? clockPhase")
    expect(body).toContain("eventPhase(")
  })
})

describe("the panels render only what the phase asked for", () => {
  it("drives every card off hostPanels rather than a second phase table", () => {
    expect(panels).toContain("const panels = hostPanels(phase)")
    expect(panels).toContain("{panels.signups ?")
    expect(panels).toContain("{panels.arrivals ?")
    expect(panels).toContain("{panels.messages ?")
  })

  it("hides the money card unless the server sent money", () => {
    expect(panels).toContain("if (money === null) return null")
  })

  it("hides the ticket-type and sign-up cards when there is nothing to draw", () => {
    expect(panels).toContain("if (insights.byTicketType.length < 2) return null")
    expect(panels).toContain("if (points.length < 2) return null")
    expect(panels).toContain("if (points.length === 0) return null")
    expect(panels).toContain("if (insights.broadcasts.length === 0) return null")
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

  it.each(["HostModeBody.tsx", "HostInsightsPanels.tsx"])("%s", (name) => {
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
