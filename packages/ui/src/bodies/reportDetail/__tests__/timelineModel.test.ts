import type { TFunction } from "i18next"
import { beforeAll, describe, expect, it, vi } from "vitest"
import type { ReportDTO, ReportFilingDTO, ReportTimelineEntryDTO } from "@civfix/contract"
import { loadCatalog } from "../../../i18n/bundledCatalogs"
import { createI18n } from "../../../i18n/config"
import { makeLocaleSwitcher } from "../../../i18n/localeSwitcher"
import { buildTimeline, type TimelineNode } from "../timelineModel"

// The node labels sit beside the node colours, which import react-native through the theme; this
// node-environment run cannot load react-native, and the model never reads a colour.
vi.mock("../../../theme", () => ({ themeFor: () => ({ colors: {} }) }))

const rel = (iso: string) => "rel:" + iso

const t0 = "2026-10-01T10:05:00.000Z"
const t1 = "2026-10-02T09:00:00.000Z"
const t2 = "2026-10-02T09:01:00.000Z"
const t3 = "2026-10-02T09:02:00.000Z"
const t4 = "2026-10-05T12:00:00.000Z"

const F: ReportFilingDTO = {
  jurisdictionName: "City of Los Angeles",
  caseId: null,
  caseUrl: null,
  filedAt: "2026-10-02T09:00:00.000Z",
  linkedExisting: false,
}

const RT: ReportTimelineEntryDTO[] = [
  { status: "published", at: t0 },
  { status: "acknowledged", at: t1, kind: "route", note: "Sent to jurisdiction (311@lacity.org)" },
  { status: "acknowledged", at: t2, kind: "route", note: "Filed with City of Los Angeles · Request 1-2345678901" },
  { status: "acknowledged", at: t3, kind: "route", note: "Linked to City of Los Angeles request 1-2345678901" },
  { status: "resolved", at: t4 },
] as ReportTimelineEntryDTO[]

// buildTimeline reads only these fields; the rest of a ReportDTO is irrelevant to the timeline.
function report(overrides: Record<string, unknown> = {}): ReportDTO {
  return {
    createdAt: "2026-10-01T10:00:00.000Z",
    publishedAt: "2026-10-01T10:05:00.000Z",
    mine: true,
    gov: false,
    linkedEvents: [],
    timeline: [{ status: "published", at: "2026-10-01T10:05:00.000Z" }],
    ...overrides,
  } as unknown as ReportDTO
}

function filed(filing: Partial<ReportFilingDTO> = {}, overrides: Record<string, unknown> = {}): ReportDTO {
  return report({ gov: true, filing: { ...F, ...filing }, ...overrides })
}

const FILED_NODE: TimelineNode = {
  kind: "forwarded",
  when: "rel:2026-10-02T09:00:00.000Z",
  text: "Filed with City of Los Angeles",
}

const FILED_WITH_CASE: TimelineNode = { ...FILED_NODE, caseId: "1-2345678901" }

let t: TFunction

beforeAll(async () => {
  const i18n = createI18n("en")
  expect(await makeLocaleSwitcher(i18n, loadCatalog)("en")).toBe(true)
  t = i18n.getFixedT("en", "report-detail")
})

describe("buildTimeline with a city filing", () => {
  it("T1: puts one filed node in the pending node's slot", () => {
    const nodes = buildTimeline(filed(), t, rel)
    expect(nodes).toHaveLength(2)
    expect(nodes[0]!.text).toBe("You reported this")
    expect(nodes[1]).toEqual(FILED_NODE)
  })

  it("T2: carries the request number", () => {
    const nodes = buildTimeline(filed({ caseId: "1-2345678901" }), t, rel)
    expect(nodes[1]).toEqual(FILED_WITH_CASE)
  })

  it("T3: says the city when the jurisdiction has no name", () => {
    const nodes = buildTimeline(filed({ jurisdictionName: null }), t, rel)
    expect(nodes[1]!.text).toBe("Filed with the city")
    expect(nodes[1]!.kind).toBe("forwarded")
    expect(nodes[1]!.when).toBe("rel:2026-10-02T09:00:00.000Z")
  })

  it("T4: reads as linked to an existing request, with its number and link", () => {
    const nodes = buildTimeline(
      filed({ linkedExisting: true, caseId: "1-2345678901", caseUrl: "https://myla311.lacity.gov/s/" }),
      t,
      rel,
    )
    expect(nodes[1]).toEqual({
      kind: "forwarded",
      when: "rel:2026-10-02T09:00:00.000Z",
      text: "Linked to an existing city request",
      caseId: "1-2345678901",
      caseUrl: "https://myla311.lacity.gov/s/",
    })
  })

  it("T5: reads as linked when the jurisdiction has no name", () => {
    const nodes = buildTimeline(filed({ linkedExisting: true, jurisdictionName: null }), t, rel)
    expect(nodes[1]!.text).toBe("Linked to an existing city request")
  })

  it("T6: carries an https case link", () => {
    const nodes = buildTimeline(filed({ caseUrl: "https://myla311.lacity.gov/s/" }), t, rel)
    expect(nodes[1]!.caseUrl).toBe("https://myla311.lacity.gov/s/")
  })

  it("T7: drops a case link that is not https", () => {
    for (const caseUrl of ["http://myla311.lacity.gov/s/", "javascript:alert(1)"]) {
      const nodes = buildTimeline(filed({ caseUrl }), t, rel)
      expect(nodes[1]!.caseUrl).toBeUndefined()
      expect(nodes[1]).toEqual(FILED_NODE)
    }
  })

  it("T8: renders no route entry as a row, old notes or new", () => {
    const nodes = buildTimeline(filed({}, { timeline: RT }), t, rel)
    expect(nodes).toHaveLength(3)
    expect(nodes[0]!.kind).toBe("submitted")
    expect(nodes[1]).toEqual(FILED_NODE)
    expect(nodes[2]).toEqual({ kind: "resolved", when: "rel:2026-10-05T12:00:00.000Z", text: "Resolved" })
    for (const node of nodes) {
      for (const field of [node.text, node.detail ?? ""]) {
        expect(field).not.toContain("Sent to jurisdiction")
        expect(field).not.toContain("Request 1-2345678901")
        expect(field).not.toContain("Linked to City of Los Angeles")
      }
    }
  })

  it("T9: counts a skipped route entry as the previous status", () => {
    const nodes = buildTimeline(
      filed(
        {},
        {
          timeline: [
            { status: "published", at: t0 },
            { status: "acknowledged", at: t1, kind: "route", note: "Filed with City of Los Angeles" },
            { status: "acknowledged", at: "2026-10-03T08:00:00.000Z", note: "Crew scheduled" },
          ],
        },
      ),
      t,
      rel,
    )
    expect(nodes).toHaveLength(3)
    expect(nodes[2]).toEqual({
      kind: "note",
      when: "rel:2026-10-03T08:00:00.000Z",
      text: "Update",
      detail: "Crew scheduled",
    })
  })

  it("T13: shows a neighbour the same filed node", () => {
    const nodes = buildTimeline(filed({ caseId: "1-2345678901" }, { mine: false }), t, rel)
    expect(nodes[0]!.text).toBe("Reported by a neighbor")
    expect(nodes[1]).toEqual(FILED_WITH_CASE)
  })

  it("T14: renders hidden and reply entries as today", () => {
    const nodes = buildTimeline(
      filed(
        {},
        {
          timeline: [
            { status: "published", at: t0 },
            { status: "published", at: "2026-10-03T08:00:00.000Z", kind: "hidden" },
            {
              status: "acknowledged",
              at: "2026-10-04T08:00:00.000Z",
              kind: "reply",
              note: "From LA Sanitation",
              body: "We scheduled a pickup.",
            },
          ],
        },
      ),
      t,
      rel,
    )
    expect(nodes[2]).toEqual({ kind: "hidden", when: "rel:2026-10-03T08:00:00.000Z", text: "Hidden from the map" })
    expect(nodes[3]).toEqual({
      kind: "forwarded",
      when: "rel:2026-10-04T08:00:00.000Z",
      text: "Reply from the city",
      detail: "From LA Sanitation",
      body: "We scheduled a pickup.",
    })
  })
})

describe("buildTimeline without a city filing", () => {
  const T10_EXPECTED_TAIL: TimelineNode[] = [
    { kind: "pending", when: "rel:2026-10-01T10:00:00.000Z", text: "Pending submission to city", pending: true },
    {
      kind: "forwarded",
      when: "rel:2026-10-02T09:00:00.000Z",
      text: "In progress",
      detail: "Sent to jurisdiction (311@lacity.org)",
    },
    {
      kind: "note",
      when: "rel:2026-10-02T09:01:00.000Z",
      text: "Update",
      detail: "Filed with City of Los Angeles · Request 1-2345678901",
    },
    {
      kind: "note",
      when: "rel:2026-10-02T09:02:00.000Z",
      text: "Update",
      detail: "Linked to City of Los Angeles request 1-2345678901",
    },
    { kind: "resolved", when: "rel:2026-10-05T12:00:00.000Z", text: "Resolved" },
  ]

  it("T10: keeps the pending node and renders route entries as today", () => {
    const nodes = buildTimeline(report({ timeline: RT, filing: null }), t, rel)
    expect(nodes).toHaveLength(6)
    expect(nodes.slice(1)).toEqual(T10_EXPECTED_TAIL)
  })

  it("T11: treats an absent filing field like a null one", () => {
    const withNull = report({ timeline: RT, filing: null })
    const without = report({ timeline: RT, filing: null }) as unknown as Record<string, unknown>
    delete without.filing
    expect(buildTimeline(without as unknown as ReportDTO, t, rel)).toEqual(buildTimeline(withNull, t, rel))
  })

  it("T12: keeps today's forwarded node when gov is set with no filing field", () => {
    const nodes = buildTimeline(report({ gov: true }), t, rel)
    expect(nodes[1]).toEqual({
      kind: "forwarded",
      when: "rel:2026-10-01T10:05:00.000Z",
      text: "Forwarded to the city agency",
    })
  })
})
