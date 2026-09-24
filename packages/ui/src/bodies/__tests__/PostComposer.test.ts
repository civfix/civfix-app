import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { pageBottomReserve } from "../../shell/bodyLayout"
import type { TFunction } from "i18next"
import type { CleanupDTO, PostDTO } from "@civfix/shared"
import {
  POST_COMPOSER_ATTACH_CANDIDATE_CAP,
  activePostMentions,
  buildComposerEventRef,
  buildComposerQuoteRef,
  buildPostComposerAttachPlan,
  buildPostComposerModel,
  resolveComposerEvent,
  shouldClearStaleAttachedEvent,
  shouldClearStaleAttachedReport,
  togglePostComposerAttachmentPanel,
  type PostComposerAttachmentPanel,
} from "../postComposerModel"
import { keyboardDismissModeFor } from "../keyboardDismissMode"

const EN: Record<string, string> = {
  "mode.post.title": "New post",
  "mode.post.placeholder": "Share an update with your neighborhood...",
  "mode.reply.title": "Reply",
  "mode.reply.placeholder": "Write a reply...",
  "mode.quote.title": "Quote post",
  "mode.quote.placeholder": "Add your take...",
  "action.post": "Post",
  "action.reply": "Reply",
}

const t = ((key: string) => {
  const resolved = EN[key]
  if (resolved == null) throw new Error(`missing translation: ${key}`)
  return resolved
}) as unknown as TFunction

const nonAttendingEvent = {
  id: "event-neighborhood-garden",
  title: "Neighborhood garden cleanup",
  eventKind: "cleanup",
  status: "upcoming",
  scheduledAt: "2026-07-25T17:00:00.000Z",
  lat: 34.0522,
  lng: -118.2437,
  going: 18,
  joined: false,
  organizer: { id: "organizer-1", name: "Maya Lopez" },
} as CleanupDTO

function planArgs(overrides: Partial<Parameters<typeof buildPostComposerAttachPlan>[0]> = {}) {
  return {
    mode: "post" as const,
    signedIn: true,
    attachmentPanel: null,
    events: { loaded: true, count: 0, expanded: false, attached: false },
    reports: { loaded: true, count: 0, expanded: false, hasNextPage: false, attached: false },
    ...overrides,
  }
}

describe("PostComposer presentation model", () => {
  it("uses all-neighbor free-form copy", () => {
    expect(buildPostComposerModel("post", t)).toEqual({
      title: "New post",
      submitLabel: "Post",
      placeholder: "Share an update with your neighborhood...",
    })
  })

  it("keeps reply and quote actions distinct", () => {
    expect(buildPostComposerModel("reply", t)).toMatchObject({
      title: "Reply",
      submitLabel: "Reply",
      placeholder: "Write a reply...",
    })
    expect(buildPostComposerModel("quote", t)).toMatchObject({
      title: "Quote post",
      submitLabel: "Post",
      placeholder: "Add your take...",
    })
  })

  it("resolves a selected event snapshot even when the viewer is not attending it", () => {
    const selectedEvent = buildComposerEventRef(
      nonAttendingEvent,
      "2026-07-21T18:30:00.000Z",
    )

    expect(resolveComposerEvent(nonAttendingEvent.id, selectedEvent, [])).toEqual(selectedEvent)
  })

  // The docked reply bar (thread/ReplyComposer) owns its keyboard inset via `useReplyDockInset`, so this
  // plan declares no host inset that native could not honor.
  it("leaves the keyboard plan free of iOS-only scroll insets on every platform", () => {
    expect(keyboardDismissModeFor("ios")).toBe("interactive")
    expect(keyboardDismissModeFor("android")).toBe("on-drag")
    expect(keyboardDismissModeFor("web")).toBe("on-drag")
    const source = readFileSync(new URL("../PostComposer.tsx", import.meta.url), "utf8")
    expect(source).toMatch(/^const KEYBOARD_DISMISS_MODE = keyboardDismissModeFor\(Platform\.OS\)$/m)
    expect(source).toContain("keyboardDismissMode={KEYBOARD_DISMISS_MODE}")
    expect(source).not.toMatch(/automaticallyAdjustKeyboardInsets|contentInset=/)
  })

  it("takes its keyboard-aware host ONLY on the standalone route, and the injected one in the shell", () => {
    const source = readFileSync(new URL("../PostComposer.tsx", import.meta.url), "utf8")
    expect(source).toMatch(
      /^const STANDALONE_SCROLL_HOST = makeKeyboardAwareScrollHost\(PLAIN_SCROLL_HOST\)$/m,
    )
    expect(source).toMatch(/const isStandalone = standalone !== undefined/)
    expect(source).toMatch(
      /const \{ ScrollView: ComposerScrollView \} = isStandalone\s*\n\s*\? STANDALONE_SCROLL_HOST\s*\n\s*: inheritedScrollHost/,
    )
    expect(source).toMatch(/const inheritedScrollHost = useScrollHost\(\)/)
    expect(source).toMatch(/<ComposerScrollView/)
    expect(source).not.toMatch(/automaticallyAdjustKeyboardInsets/)
  })

  it("reads standalone-ness from an explicit host prop, never from a nav guess", () => {
    const source = readFileSync(new URL("../PostComposer.tsx", import.meta.url), "utf8")
    expect(source).toMatch(/export interface PostComposerStandaloneHost \{\s*\n\s*onBack: \(\) => void/)
    expect(source).toMatch(/standalone\?: PostComposerStandaloneHost/)
    expect(source).not.toMatch(/^\s*onBack\?: \(\) => void$/m)
    const route = readFileSync(
      new URL("../../../../../apps/community-mobile/app/compose.tsx", import.meta.url),
      "utf8",
    )
    expect(route).toMatch(/standalone=\{\{ onBack: back \}\}/)
  })

  it("never double-reserves in the shell: the shell reserves for the composer and injects a PLAIN host", () => {
    const layout = readFileSync(new URL("../../shell/bodyLayout.ts", import.meta.url), "utf8")
    expect(layout).toMatch(/surfaceKeyboardAvoidance: active\?\.kind === "composer"/)
    const shell = readFileSync(new URL("../../shell/PortraitShell.shared.tsx", import.meta.url), "utf8")
    expect(shell).toMatch(
      /const overlayScrollHost = frame\.overlay\.keyboardAvoidance\s*\n?\s*\? PLAIN_SCROLL_HOST/,
    )
    expect(shell).toMatch(
      /frame\.overlay\.keyboardAvoidance && keyboardInset > 0 \? \{ paddingBottom: keyboardInset \} : null/,
    )
    const web = readFileSync(new URL("../../shell/KeyboardAwareScroll.web.tsx", import.meta.url), "utf8")
    expect(web).toMatch(/reserveKeyboardPadding/)
    const native = readFileSync(new URL("../../shell/PageStack.native.tsx", import.meta.url), "utf8")
    expect(native).toMatch(
      /const keyboardReserve = useKeyboardReserve\(\{ enabled: keyboardAvoidance && active \}\)/,
    )
    expect(pageBottomReserve("composer")).toBe("box")
    expect(native).toMatch(/const boxReserve = \(reserve === "box" \? paddingBottom : 0\) \+ keyboardReserve/)
    expect(native).toMatch(/paddingBottom: boxReserve, paddingTop/)
  })

  it("keeps the pill panels one-at-a-time via explicit toggles", () => {
    const initial: PostComposerAttachmentPanel = null
    const source = readFileSync(new URL("../usePostComposerAttach.ts", import.meta.url), "utf8")

    expect(source).toContain("useState<PostComposerAttachmentPanel>(null)")
    expect(togglePostComposerAttachmentPanel(initial, "events")).toBe("events")
    expect(togglePostComposerAttachmentPanel("events", "events")).toBeNull()
    expect(togglePostComposerAttachmentPanel("events", "reports")).toBe("reports")
  })
})

describe("attach plan", () => {
  it("hides the attach feature entirely while signed out (both candidate queries are auth-gated)", () => {
    const plan = buildPostComposerAttachPlan(planArgs({
      signedIn: false,
      events: { loaded: true, count: 3, expanded: false, attached: false },
    }))

    expect(plan.variant).toBe("hidden")
    expect(plan.eventPanelVisible).toBe(false)
    expect(plan.reportPanelVisible).toBe(false)
  })

  it("full-screen post/quote render always-visible sections", () => {
    expect(buildPostComposerAttachPlan(planArgs()).variant).toBe("sections")
    expect(buildPostComposerAttachPlan(planArgs({ mode: "quote" })).variant).toBe("sections")
  })

  it("the full-screen reply collapses to pill triggers", () => {
    expect(buildPostComposerAttachPlan(planArgs({ mode: "reply" })).variant).toBe("pills")
    expect(buildPostComposerAttachPlan(planArgs({ mode: "reply", attachmentPanel: "events" }))).toMatchObject({
      eventPanelVisible: true,
      reportPanelVisible: false,
    })
    // Sections mode never opens a pill panel, whatever stale panel state remains.
    expect(buildPostComposerAttachPlan(planArgs({ attachmentPanel: "events" })).eventPanelVisible).toBe(false)
  })

  it("caps a collapsed group at the candidate cap and offers Show more with the hidden count", () => {
    const plan = buildPostComposerAttachPlan(planArgs({
      events: { loaded: true, count: 5, expanded: false, attached: false },
    }))

    expect(plan.events).toEqual({
      state: "list",
      visibleCount: POST_COMPOSER_ATTACH_CANDIDATE_CAP,
      showMoreVisible: true,
      showMoreCount: 5 - POST_COMPOSER_ATTACH_CANDIDATE_CAP,
      showFewerVisible: false,
    })
  })

  it("shows everything expanded, with Show fewer to collapse again", () => {
    const plan = buildPostComposerAttachPlan(planArgs({
      events: { loaded: true, count: 5, expanded: true, attached: false },
    }))

    expect(plan.events).toEqual({
      state: "list",
      visibleCount: 5,
      showMoreVisible: false,
      showMoreCount: null,
      showFewerVisible: true,
    })
  })

  it("keeps Show more visible while more pages exist server-side, even collapsed under the cap", () => {
    // A loaded-only count can lie about the total: 2 loaded rows fit the cap, but pages remain.
    const collapsed = buildPostComposerAttachPlan(planArgs({
      reports: { loaded: true, count: 2, expanded: false, hasNextPage: true, attached: false },
    }))
    expect(collapsed.reports.showMoreVisible).toBe(true)
    // And the "(N)" label is suppressed whenever the total is unknown.
    expect(collapsed.reports.showMoreCount).toBeNull()

    const expanded = buildPostComposerAttachPlan(planArgs({
      reports: { loaded: true, count: 6, expanded: true, hasNextPage: true, attached: false },
    }))
    expect(expanded.reports).toMatchObject({
      state: "list",
      visibleCount: 6,
      showMoreVisible: true,
      showMoreCount: null,
      showFewerVisible: true,
    })
  })

  it("swaps an attached kind's list for the attached card in place (sections), leaving the other group alone", () => {
    const plan = buildPostComposerAttachPlan(planArgs({
      events: { loaded: true, count: 4, expanded: true, attached: true },
      reports: { loaded: true, count: 3, expanded: false, hasNextPage: false, attached: false },
    }))

    expect(plan.events).toMatchObject({ state: "attached", visibleCount: 0, showMoreVisible: false })
    expect(plan.reports).toMatchObject({ state: "list", visibleCount: POST_COMPOSER_ATTACH_CANDIDATE_CAP })
  })

  it("keeps a pills panel a full picker even while its kind is attached (the pill doubles as change)", () => {
    const plan = buildPostComposerAttachPlan(planArgs({
      mode: "reply",
      attachmentPanel: "events",
      events: { loaded: true, count: 3, expanded: false, attached: true },
    }))

    expect(plan.events).toMatchObject({ state: "list", visibleCount: 3 })
  })

  it("reserves space while loading and stays discoverable when empty", () => {
    const plan = buildPostComposerAttachPlan(planArgs({
      events: { loaded: false, count: 0, expanded: false, attached: false },
      reports: { loaded: true, count: 0, expanded: false, hasNextPage: false, attached: false },
    }))

    expect(plan.events.state).toBe("loading")
    expect(plan.reports.state).toBe("empty")
  })
})

describe("stale attached-id hygiene", () => {
  it("clears an event id once the attending list has loaded without resolving it", () => {
    expect(shouldClearStaleAttachedEvent({ attachedEventId: "event-1", resolved: false, loaded: true })).toBe(true)
    expect(shouldClearStaleAttachedEvent({ attachedEventId: "event-1", resolved: false, loaded: false })).toBe(false)
    expect(shouldClearStaleAttachedEvent({ attachedEventId: "event-1", resolved: true, loaded: true })).toBe(false)
    expect(shouldClearStaleAttachedEvent({ attachedEventId: null, resolved: false, loaded: true })).toBe(false)
  })

  it("only proves a report id stale once every page is loaded (it may live on an unfetched page)", () => {
    expect(shouldClearStaleAttachedReport({ attachedReportId: "r1", resolved: false, loaded: true, hasNextPage: false })).toBe(true)
    expect(shouldClearStaleAttachedReport({ attachedReportId: "r1", resolved: false, loaded: true, hasNextPage: true })).toBe(false)
    expect(shouldClearStaleAttachedReport({ attachedReportId: "r1", resolved: false, loaded: false, hasNextPage: false })).toBe(false)
    expect(shouldClearStaleAttachedReport({ attachedReportId: "r1", resolved: true, loaded: true, hasNextPage: false })).toBe(false)
    expect(shouldClearStaleAttachedReport({ attachedReportId: null, resolved: false, loaded: true, hasNextPage: false })).toBe(false)
  })
})

describe("activePostMentions", () => {
  const maria = { id: "person-2", handle: "maria", displayName: "Maria G." }
  const foo = { id: "person-3", handle: "foo", displayName: "Foo B." }

  it("drops a mention whose @handle the author deleted from the body", () => {
    // `onMention` only ever adds, so without this re-filter a post whose "@foo" was deleted would persist
    // (and notify) a stale mention.
    expect(activePostMentions("Fresh trash on 4th.", [foo])).toEqual([])
  })

  it("keeps the mentions whose handles are still written in the body", () => {
    expect(activePostMentions("Thanks @maria!", [maria, foo])).toEqual([maria])
  })

  it("is case-insensitive and ignores a handle that is only a prefix of a longer one", () => {
    expect(activePostMentions("cc @MARIA", [maria])).toEqual([maria])
    expect(activePostMentions("cc @mariana", [maria])).toEqual([])
  })

  it("short-circuits an empty mention list and an empty body", () => {
    expect(activePostMentions("@maria", [])).toEqual([])
    expect(activePostMentions("", [maria])).toEqual([])
  })
})

describe("buildComposerQuoteRef", () => {
  const post = {
    id: "p1",
    author: { id: "u1", name: "Ada", followers: 0, following: 0, isFollowing: false },
    kind: "post",
    body: "Storm drain is blocked again.",
    createdAt: "2026-09-16T12:00:00.000Z",
    counts: { likes: 0, reposts: 0, replies: 0, saves: 0 },
    viewer: { liked: false, reposted: false, saved: false },
    media: [],
    mentions: [],
  } as unknown as PostDTO

  it("carries the body into the excerpt the embed renders", () => {
    expect(buildComposerQuoteRef(post).excerpt).toBe("Storm drain is blocked again.")
  })

  it("normalizes the optional refs a PostRefDTO expects", () => {
    const ref = buildComposerQuoteRef(post)
    expect(ref.organization).toBeNull()
    expect(ref.event).toBeNull()
    expect(ref.report).toBeNull()
    expect(ref.media).toEqual([])
  })

  it("keeps a body-less post renderable", () => {
    const ref = buildComposerQuoteRef({ ...post, body: null } as PostDTO)
    expect(ref.excerpt).toBe("")
    expect(ref.body).toBeNull()
  })
})
