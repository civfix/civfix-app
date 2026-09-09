import * as React from "react"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { FeeBreakdownDTO } from "@civfix/shared"

import { FeeBreakdown } from "./fee-breakdown"

const BREAKDOWN: FeeBreakdownDTO = {
  grossMinor: 2500,
  platformFeeMinor: 125,
  processorFeeMinor: 103,
  processorFeeIsEstimate: true,
  netMinor: 2272,
  platformFeeBps: 500,
  currency: "USD",
}

afterEach(() => {
  cleanup()
})

describe("two fee breakdowns on one document", () => {
  it("emits no duplicate id, so aria-labelledby cannot resolve to the wrong heading", () => {
    render(
      <>
        <FeeBreakdown
          breakdown={BREAKDOWN}
          recipientLegalName="Reach Out Los Angeles"
          authoritative={false}
        />
        <FeeBreakdown
          breakdown={BREAKDOWN}
          recipientLegalName="Reach Out Los Angeles"
          authoritative={true}
          idPrefix="donate-pay-fees"
        />
      </>,
    )
    const ids = [...document.querySelectorAll("[id]")].map((node) => node.id)
    expect(ids.length).toBe(2)
    expect(new Set(ids).size).toBe(ids.length)

    for (const section of document.querySelectorAll("section[aria-labelledby]")) {
      const target = section.getAttribute("aria-labelledby") as string
      expect(document.querySelectorAll(`#${CSS.escape(target)}`).length).toBe(1)
      expect(section.contains(document.getElementById(target))).toBe(true)
    }
  })

  it("keeps the two breakdowns individually addressable", () => {
    render(
      <>
        <FeeBreakdown
          breakdown={BREAKDOWN}
          recipientLegalName="Reach Out Los Angeles"
          authoritative={false}
        />
        <FeeBreakdown
          breakdown={{ ...BREAKDOWN, netMinor: 9999 }}
          recipientLegalName="Reach Out Los Angeles"
          authoritative={true}
          idPrefix="donate-pay-fees"
        />
      </>,
    )
    const cell = (scope: string) =>
      document.querySelector(`[data-fee="net"][data-fee-scope="${scope}"]`)?.textContent?.trim()
    expect(cell("donate-fees")).toBe("$22.72")
    expect(cell("donate-pay-fees")).toBe("$99.99")
  })
})
