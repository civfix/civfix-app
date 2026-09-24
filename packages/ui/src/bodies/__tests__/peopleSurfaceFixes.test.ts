import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { searchBodySource } from "../search/__tests__/searchBodySource"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

const connections = read("../ConnectionsBody.tsx")
const social = read("../SocialBody.tsx")
const search = searchBodySource()

describe("followers / following list", () => {
  it("offers no Follow button on a deleted account or on the viewer's own row", () => {
    expect(connections).toContain("showFollow={!item.deleted && item.id !== viewerId}")
    expect(connections).toMatch(/\{showFollow \? \(\s*<FollowButton/)
  })

  it("lets a filter reach people on pages not loaded yet, and says so when nothing loaded matches", () => {
    expect(connections).toMatch(/filtering && hasNextPage \? \(\s*<Pressable\s*onPress=\{onSearchMore\}/)
    expect(connections).toContain('t(hasNextPage ? "no_matches.body_partial" : "no_matches.body"')
  })

  it("grows the 22pt clear chip to the 44pt floor like the People search field", () => {
    expect(connections).toContain("hitSlop={CLEAR_BTN_HIT_SLOP}")
    expect(connections).toContain("const CLEAR_BTN_HIT_SLOP = (MIN_TOUCH_TARGET - CLEAR_BTN_SIZE) / 2")
    expect(connections).not.toContain("hitSlop={6}")
  })
})

describe("People search for a signed-out visitor", () => {
  it("asks them to sign in instead of claiming no one matched", () => {
    expect(social).toMatch(/\) : !isAuthenticated && !authPending \? \(\s*<SignInPrompt/)
    expect(social).toContain('t("empty.signed_out.title")')
    expect(social).toContain('onSignIn={() => requireAuth(() => {}, { next: "/people" })}')
  })

  it("holds the skeleton while the session is still resolving", () => {
    expect(social).toContain("const searchPending = authPending || search.isLoading")
  })
})

describe("sign-in resumes where the person tapped", () => {
  it("returns a suggested-person Follow to that person's profile", () => {
    for (const src of [social, search]) {
      expect(src).toContain("nextPath={`/people/${person.handle ?? person.id}`}")
      expect(src).not.toContain('nextPath="/"')
    }
  })

  it("returns a Message tap to the recipient's profile", () => {
    expect(social).toMatch(/handle: person\.handle \},\s*`\/people\/\$\{person\.handle\}`,/)
  })
})

describe("search discovery ranks against a live clock", () => {
  it("re-derives now from the shared list tick instead of freezing it at first mount", () => {
    expect(search).toContain("const tick = useListTimeTick()")
    expect(search).toContain("const now = useMemo(() => new Date(tick), [tick])")
    expect(search).not.toContain("useMemo(() => new Date(), [])")
  })
})
