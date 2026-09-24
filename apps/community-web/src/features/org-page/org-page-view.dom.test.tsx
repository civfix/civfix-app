import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen } from "@testing-library/react"

const calls: Array<{ key: string; options?: Record<string, unknown> }> = []
const transProps: Array<Record<string, unknown>> = []
let orgQuery: Record<string, unknown> = {}

vi.mock("@civfix/ui/i18n", () => {
  const t = (key: string, options?: Record<string, unknown>) => {
    calls.push({ key, options })
    return key
  }
  return {
    useT: () => ({ t, i18n: { language: "es" } }),
    Trans: (props: Record<string, unknown>) => {
      transProps.push(props)
      return <>{String(props.i18nKey)}</>
    },
  }
})

vi.mock("@civfix/ui/data", () => ({ useOrganization: () => orgQuery }))

import { OrgPageView } from "@/features/org-page/org-page-view"

const ORG = {
  id: "o1",
  slug: "beach-crew",
  name: "Beach Crew",
  verifiedStatus: "verified",
  verifiedKind: "nonprofit",
  eventCount: 3,
  memberCount: 5,
  donationUrl: "https://give.example.org/",
  description: "We clean beaches.",
  websiteUrl: "https://beach.example.org/",
  socialLinks: {},
  logoUrl: null,
}

async function renderAt(path: string) {
  window.history.replaceState(null, "", path)
  await act(async () => {
    render(<OrgPageView />)
  })
}

afterEach(() => {
  cleanup()
  calls.length = 0
  transProps.length = 0
})

function assertCatalogOnly() {
  expect(calls.filter((call) => call.options && "defaultValue" in call.options)).toEqual([])
  expect(transProps.filter((props) => "defaults" in props)).toEqual([])
}

describe("public organization page copy", () => {
  it("renders every string from the catalog, never an English fallback, on a found page", async () => {
    orgQuery = { isPending: false, isError: false, data: ORG }
    await renderAt("/orgs/beach-crew/")
    expect(screen.getByText("public.kind_nonprofit")).toBeTruthy()
    assertCatalogOnly()
  })

  it("renders the not-found and error states from the catalog too", async () => {
    orgQuery = { isPending: false, isError: true, error: { code: "NOT_FOUND", message: "x" } }
    await renderAt("/orgs/beach-crew/")
    cleanup()
    orgQuery = { isPending: false, isError: true, error: new TypeError("Failed to fetch"), refetch: () => {} }
    await renderAt("/orgs/beach-crew/")
    expect(screen.getByText("public.error_title")).toBeTruthy()
    assertCatalogOnly()
  })
})
