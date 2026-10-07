import { describe, expect, it } from "vitest"

import { stripInviteTokenFromUrl } from "./org-invites"

const NEXT_ROUTER_STATE = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ["", {}] }

describe("stripInviteTokenFromUrl", () => {
  it("scrubs the token and hands Next an unmarked entry so its router adopts the scrubbed URL", () => {
    window.history.replaceState(NEXT_ROUTER_STATE, "", "/host/accept-invite/?token=secret-token")

    stripInviteTokenFromUrl()

    expect(`${window.location.pathname}${window.location.search}`).toBe("/host/accept-invite/")
    expect((window.history.state as { __NA?: unknown } | null)?.__NA).toBeUndefined()
  })
})
