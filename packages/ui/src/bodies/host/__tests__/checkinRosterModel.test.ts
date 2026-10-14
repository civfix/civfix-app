import { describe, expect, it } from "vitest"
import { checkinRosterListed } from "../checkin/checkinRosterModel"

describe("checkinRosterListed", () => {
  const settled = { isLoading: false, isError: false }

  it("lists rows only once the roster has loaded some", () => {
    expect(checkinRosterListed(settled, [{}])).toBe(true)
    expect(checkinRosterListed(settled, [])).toBe(false)
  })

  it("lists nothing while loading or after an error, whatever rows are cached", () => {
    expect(checkinRosterListed({ isLoading: true, isError: false }, [{}])).toBe(false)
    expect(checkinRosterListed({ isLoading: false, isError: true }, [{}])).toBe(false)
  })
})
