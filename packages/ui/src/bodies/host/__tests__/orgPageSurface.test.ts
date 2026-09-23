import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { ORG_EVENTS_PAGE_SIZE } from "../../../data/hooks/orgs"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const body = strip(read("../OrgPageBody.tsx"))
const orgHooks = strip(read("../../../data/hooks/orgs.ts"))

describe("the organization page lists events three at a time", () => {
  it("asks the server for a page the size of the visible run, so Load more is a real fetch", () => {
    expect(ORG_EVENTS_PAGE_SIZE).toBe(3)
    expect(orgHooks).toContain("limit: ORG_EVENTS_PAGE_SIZE")
  })

  it("renders every row the pages hold rather than slicing a full list on the client", () => {
    expect(body).toContain("organizationEventRows(query.data?.pages)")
    expect(body).not.toContain(".slice(")
  })

  it("loads the next page from the cursor the infinite query already carries", () => {
    expect(body).toContain("query.hasNextPage")
    expect(body).toContain("query.fetchNextPage()")
    expect(body).toContain("events.load_more")
  })

  it("keeps both windows open: no collapse toggle, no enabled gate, no expanded state", () => {
    expect(body).not.toContain("collapsible")
    expect(body).not.toContain("accessibilityState={{ expanded")
    expect(body).not.toContain("ChevronDown")
    expect(body).toContain('<OrgEventsSection slug={slug} when="upcoming" />')
    expect(body).toContain('<OrgEventsSection slug={slug} when="past" />')
  })

  it("keeps an empty window explained rather than blank", () => {
    expect(body).toContain("events.empty_upcoming")
    expect(body).toContain("events.empty_past")
  })
})

describe("the organization page header", () => {
  it("carries the share affordance as an icon beside the name, and nowhere else", () => {
    expect(body).toContain("function OrgHeader({ org, onShare }")
    expect(body).toContain("<OrgHeader org={org} onShare={onShare} />")
    expect(body).toContain("icon={iconMap.Share}")
    expect(body.match(/actions\.share_a11y/g)).toHaveLength(1)
    expect(body).not.toContain("actions.share\"")
  })

  it("no longer seals an organization with a verified check", () => {
    expect(body).not.toContain("VerifiedBadge")
  })
})

describe("the Manage button", () => {
  it("fills the width on a compact window and stays inline on a wide one", () => {
    expect(body).toContain('const compact = useLayoutMode() === "compact"')
    expect(body).toContain('size={compact ? "md" : "sm"}')
    expect(body).toContain("{...(compact ? { style: styles.manageBlock } : {})}")
  })
})
