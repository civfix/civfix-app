import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { TFunction } from "i18next"
import type { MediaDTO, PostDTO } from "@civfix/shared"
import { buildPostCardModel, splitPostBodyMentions } from "../postCardModel"

/**
 * Stand-in for the `home-feed` namespace (plus the shared `enums:` labels) bound by useT: interpolates
 * {{vars}} so the assertions below read like the shipped English copy without booting i18next.
 */
const EN: Record<string, string> = {
  "post_card.repost_attribution": "{{name}} reposted",
  "post_card.reported_by": "Reported by {{name}}",
  "post_card.cleared_at": "Cleared at the {{title}}",
  "post_card.open_thread_a11y": "Open {{name}}'s post",
  "post_card.permalink_a11y": "Posted {{time}} ago. Open this post",
  "post_card.replying_to": "Replying to {{handle}}",
  "enums:reportType.dump": "Dump",
  "enums:reportType.pavement": "Pavement distress",
  "enums:category.trash": "Trash",
  "enums:category.hazard": "Hazard",
}

const t = ((key: string, options: Record<string, unknown> = {}) => {
  const resolved = EN[key]
  if (resolved == null) throw new Error(`missing translation: ${key}`)
  return resolved.replace(/{{(\w+)}}/g, (_m, name: string) => String(options[name] ?? ""))
}) as unknown as TFunction

const author: PostDTO["author"] = {
  id: "person-1",
  name: "Friends of Ballona",
  handle: "friendsofballona",
  avatar: ["#F0685C", "#E4574A"],
  avatarUrl: null,
  followers: 42,
  following: 7,
  isFollowing: false,
}

const media = (id: string): MediaDTO => ({
  id,
  kind: "image",
  url: `https://example.com/${id}.jpg`,
  thumbUrl: null,
  width: 1200,
  height: 900,
  status: "ready",
})

const basePost = (overrides: Partial<PostDTO> = {}): PostDTO => ({
  id: "post-1",
  author,
  kind: "post",
  body: "Join @maria at Saturday's cleanup.",
  createdAt: "2026-07-20T12:00:00.000Z",
  editedAt: null,
  counts: { likes: 12, reposts: 2, replies: 4, saves: 1 },
  viewer: { liked: false, reposted: false, saved: false },
  media: [],
  mentions: [{ id: "person-2", handle: "maria", displayName: "Maria G." }],
  event: null,
  report: null,
  repostOf: null,
  replyToId: null,
  threadRootId: null,
  ...overrides,
})

const event = {
  id: "event-1",
  title: "Playa del Rey Beach Cleanup",
  eventKind: "cleanup" as const,
  status: "upcoming" as const,
  scheduledAt: "2026-07-25T16:00:00.000Z",
  lat: 33.95,
  lng: -118.45,
  going: 18,
  organizer: author,
  linkedAt: "2026-07-20T12:00:00.000Z",
}

const resolvedReport = {
  id: "report-1",
  category: "hazard" as const,
  type: "pavement" as const,
  title: "Pothole on Sunset Blvd",
  status: "resolved" as const,
  lat: 34.09,
  lng: -118.28,
  addr: "Sunset Blvd, Echo Park",
  thumbUrl: null,
  linkedAt: "2026-07-20T12:00:00.000Z",
}

describe("PostCard model", () => {
  it("models an organizer event-promo post and mention body", () => {
    const post = basePost({ event })
    const model = buildPostCardModel(post, t, { neighborhood: "Playa del Rey" })

    expect(model.variant).toBe("event")
    expect(model.showOrganizerBadge).toBe(true)
    expect(model.metaLabel).toContain("Playa del Rey")
    expect(splitPostBodyMentions(post.body ?? "", post.mentions)).toEqual([
      { kind: "text", text: "Join " },
      { kind: "mention", text: "@maria", userId: "person-2", handle: "maria" },
      { kind: "text", text: " at Saturday's cleanup." },
    ])
  })

  it("models a repost attribution and embedded source preview", () => {
    const post = basePost({
      kind: "repost",
      body: null,
      repostOf: {
        id: "post-original",
        author: { ...author, id: "person-2", name: "Maria G." },
        kind: "post",
        media: [],
        excerpt: "We still need ten volunteers.",
        createdAt: "2026-07-19T12:00:00.000Z",
      },
    })
    const model = buildPostCardModel(post, t)

    expect(model.variant).toBe("repost")
    expect(model.repostAttribution).toBe("Friends of Ballona reposted")
    expect(model.embeddedPost?.excerpt).toBe("We still need ten volunteers.")
  })

  it("models a quote with its own body and embedded source preview", () => {
    const post = basePost({
      kind: "quote",
      body: "This is worth joining.",
      repostOf: {
        id: "post-original",
        author: { ...author, id: "person-2", name: "Maria G." },
        kind: "post",
        media: [],
        excerpt: "We still need ten volunteers.",
        createdAt: "2026-07-19T12:00:00.000Z",
      },
    })

    expect(buildPostCardModel(post, t)).toMatchObject({
      variant: "quote",
      embeddedPost: { id: "post-original", excerpt: "We still need ten volunteers." },
    })
  })

  it("models a fix-confirmed before/after post", () => {
    const model = buildPostCardModel(
      basePost({ report: resolvedReport, media: [media("before"), media("after")] }),
      t,
      { neighborhood: "Echo Park", reportedBy: "Maria G.", resolutionLabel: "Fixed in 6 days" },
    )

    expect(model).toMatchObject({
      variant: "fix-confirmed",
      fixLayout: "before-after",
      categoryLabel: "Pavement distress",
      reportedByLabel: "Reported by Maria G",
      resolutionLabel: "Fixed in 6 days",
    })
  })

  it("normalizes report attribution for the compact dot-separated fix header", () => {
    const model = buildPostCardModel(basePost({ report: resolvedReport }), t, {
      neighborhood: "Echo Park",
      reportedBy: "Maria G...",
    })

    expect(model.reportedByLabel).toBe("Reported by Maria G")
  })

  it("models a fix-confirmed cleared post linked to an event", () => {
    const report = { ...resolvedReport, category: "trash" as const, type: "dump" as const }
    const model = buildPostCardModel(basePost({ report, event, media: [media("cleared")] }), t)

    expect(model).toMatchObject({
      variant: "fix-confirmed",
      fixLayout: "cleared",
      categoryLabel: "Dump",
      resolutionLabel: "Cleared at the Playa del Rey Beach Cleanup",
    })
  })

  // The fix showcase is an ATTACHMENT on the row, never a replacement for it: a post's linked report
  // resolves on the CITY's schedule, so a card that swapped out the author + body would make an ordinary
  // post mutate days after publication. `showFixShowcase` is the only fix-driven render switch, and the
  // author row / body / handle / tap-through are unconditional. See postCardModel's invariant note.
  it("keeps the fix treatment additive - the post itself is never replaced", () => {
    const model = buildPostCardModel(
      basePost({ report: resolvedReport, media: [media("before"), media("after")] }),
      t,
    )

    expect(model.showFixShowcase).toBe(true)
    // Everything the old fix-confirmed header deleted is still modelled.
    expect(model.handleLabel).toBe("@friendsofballona")
    expect(model.timeLabel).not.toBe("")
  })

  it("does not render the showcase for a resolved report with no media", () => {
    const model = buildPostCardModel(basePost({ report: resolvedReport, media: [] }), t)

    expect(model.showFixShowcase).toBe(false)
  })

  it("splits the meta line into handle, timestamp and context", () => {
    const model = buildPostCardModel(basePost(), t, { neighborhood: "Playa del Rey" })

    expect(model.handleLabel).toBe("@friendsofballona")
    expect(model.contextLabel).toBe("Playa del Rey")
    // metaLabel stays the joined form for the surfaces that still render one string.
    expect(model.metaLabel).toBe(`${model.timeLabel} · Playa del Rey`)
  })

  it("has a null handle label when the author has no handle", () => {
    const model = buildPostCardModel(
      basePost({ author: { ...author, handle: null } }),
      t,
    )

    expect(model.handleLabel).toBeNull()
  })

  it("yields the handle to the ORGANIZER badge, so the NAME is never the thing that gets crushed", () => {
    // MEASURED REGRESSION (bodies gallery, 375x812). The meta row holds name + handle + "·" + timestamp +
    // the 75pt ORGANIZER pill + the 44pt overflow button inside a 257pt content column. Every other child
    // is rigid, so the name/handle group is the only thing flexbox can shrink - it collapsed to 99pt and
    // rendered "Ann Rivera" as "Ann ..." with "@ann...". Dropping the handle frees ~74pt against a ~70pt
    // deficit, so the full name fits. Assert BOTH directions, because the whole point is that the two
    // labels are mutually exclusive rather than merely both present.
    const organizer = buildPostCardModel(basePost({ event }), t)
    expect(organizer.showOrganizerBadge).toBe(true)
    expect(organizer.handleLabel).toBeNull()

    // A non-organizer post keeps its handle: there is no badge competing for the space.
    const guest = buildPostCardModel(
      basePost({ event: { ...event, organizer: { ...author, id: "person-9" } } }),
      t,
    )
    expect(guest.showOrganizerBadge).toBe(false)
    expect(guest.handleLabel).toBe("@friendsofballona")
  })

  it("strips a leading @ so the handle is never rendered as @@name", () => {
    const model = buildPostCardModel(basePost({ author: { ...author, handle: "@ballona" } }), t)

    expect(model.handleLabel).toBe("@ballona")
  })

  // The clamp decision is made from the STRING, not from layout: onTextLayout never fires on
  // react-native-web, so a layout-derived answer would be unavailable on half our surfaces.
  it("marks only long bodies as expandable", () => {
    expect(buildPostCardModel(basePost({ body: "Short one." }), t).bodyExpandable).toBe(false)
    expect(buildPostCardModel(basePost({ body: "x".repeat(341) }), t).bodyExpandable).toBe(true)
  })

  it("marks a many-line body as expandable even when it is short", () => {
    const model = buildPostCardModel(basePost({ body: "a\n".repeat(10) }), t)

    expect(model.bodyExpandable).toBe(true)
  })

  it("treats an empty body as not expandable", () => {
    expect(buildPostCardModel(basePost({ body: null }), t).bodyExpandable).toBe(false)
  })
})

/**
 * The "Replying to @x" line. A reply no longer reaches the HOME feed, but it still surfaces on its author's
 * profile, in Saved and at its own permalink - where without a parent reference the row reads as a
 * non-sequitur exactly as it did in the feed. Every "say nothing" case has to stay silent rather than
 * degrade to something vague.
 */
describe("PostCard replying-to line", () => {
  const parent = (over: Partial<NonNullable<PostDTO["replyTo"]>> = {}) => ({
    id: "post-parent",
    author: { ...author, id: "person-9", name: "Maria G.", handle: "mariag" },
    kind: "post" as const,
    media: [],
    excerpt: "The corner has been like this for weeks.",
    createdAt: "2026-07-19T12:00:00.000Z",
    ...over,
  })

  it("names the parent author's handle", () => {
    const model = buildPostCardModel(
      basePost({ kind: "reply", replyToId: "post-parent", replyTo: parent() }),
      t,
    )

    expect(model.replyingToLabel).toBe("Replying to @mariag")
  })

  it("falls back to the display name when the parent author has no handle", () => {
    const model = buildPostCardModel(
      basePost({
        kind: "reply",
        replyToId: "post-parent",
        replyTo: parent({ author: { ...author, id: "person-9", name: "Maria G.", handle: null } }),
      }),
      t,
    )

    // Never a bare "@" - PersonDTO.handle is nullable and every surface has to guard against it.
    expect(model.replyingToLabel).toBe("Replying to Maria G.")
  })

  it("says nothing for a non-reply", () => {
    expect(buildPostCardModel(basePost(), t).replyingToLabel).toBeNull()
  })

  // An OLDER server sends replyToId but no replyTo projection. Printing "Replying to someone" would be
  // worse than silence.
  it("says nothing when the server sent no parent projection", () => {
    const model = buildPostCardModel(basePost({ kind: "reply", replyToId: "post-parent" }), t)

    expect(model.replyingToLabel).toBeNull()
  })

  // The parent is unreadable (deleted, or a block in either direction) - the server nulls `replyTo`, and
  // naming it anyway would leak that a hidden post exists.
  it("says nothing when the parent is unreadable to this viewer", () => {
    const model = buildPostCardModel(
      basePost({ kind: "reply", replyToId: "post-parent", replyTo: null }),
      t,
    )

    expect(model.replyingToLabel).toBeNull()
  })

  it("says nothing when the parent author is deleted", () => {
    const model = buildPostCardModel(
      basePost({ kind: "reply", replyToId: "post-parent", replyTo: parent({ author: null }) }),
      t,
    )

    expect(model.replyingToLabel).toBeNull()
  })

  it("does NOT treat a resolved-report post with zero media as a fix", () => {
    const model = buildPostCardModel(basePost({ report: resolvedReport, media: [] }), t)

    expect(model.variant).toBe("post")
    expect(model.fixLayout).toBeNull()
  })

  it("never reports variant fix-confirmed without a fixLayout", () => {
    const cases: PostDTO[] = [
      basePost({ report: resolvedReport, media: [] }),
      basePost({ report: resolvedReport, media: [media("cleared")] }),
      basePost({ report: resolvedReport, media: [media("before"), media("after")] }),
      basePost({ report: { ...resolvedReport, status: "published" as const }, media: [media("a")] }),
    ]
    for (const post of cases) {
      const model = buildPostCardModel(post, t)
      if (model.variant === "fix-confirmed") expect(model.fixLayout).not.toBeNull()
    }
  })
})

/**
 * THE ROW'S WEB AFFORDANCES, asserted by SOURCE because this package has no RN renderer (the house pattern
 * - see PostActionBar.test.ts's header for why a grep is the right instrument for "which element carries
 * which prop"). Each block below is a defect that shipped once and cannot be expressed as a pure value.
 */
describe("PostCard's link-role controls answer the keyboard", () => {
  const SRC = readFileSync(new URL("../PostCard.tsx", import.meta.url), "utf8")

  /** The JSX props block of the Pressable whose `accessibilityLabel` matches, so a grep is per control. */
  const pressableWith = (marker: string): string => {
    const at = SRC.indexOf(marker)
    expect(at, `${marker} is gone from PostCard.tsx - re-scope the guard, do not delete it`).toBeGreaterThan(-1)
    const open = SRC.lastIndexOf("<Pressable", at)
    const close = SRC.indexOf(">", SRC.indexOf("style=", open))
    return SRC.slice(open, close)
  }

  it("hands Enter AND Space back to every role=link control, not just the row", () => {
    // react-native-web activates `role="link"` with NEITHER key (PressResponder.isValidKeyPress accepts
    // Space only for a button-ish element; the keyup handler skips onPress for a link, assuming a browser
    // click that only ever comes from a real <a href>). The first cut of this fix taught the ROW and
    // stopped there, leaving the name link - which is the ANNOUNCED profile affordance, since the avatar
    // deliberately leaves the tab order - and the timestamp permalink as keyboard-dead tab stops.
    expect(SRC).toContain("export function linkKeyProps")
    for (const marker of [
      'accessibilityLabel={t("post_card.profile_a11y", { name: post.author.name })}', // MetaRow name
      'accessibilityLabel={t("post_card.permalink_a11y", { time: model.timeLabel })}', // MetaRow timestamp
      "accessibilityLabel={model.replyingToLabel}", // the reply's parent link
    ]) {
      expect(pressableWith(marker), `${marker} lost its keyboard activation`).toContain("linkKeyProps(")
    }
    // EVERY link-role Pressable in the file, not just the three named above: role and keys arrive
    // together or the control is a dead tab stop. (A link-role `Text` - the body's @mentions - is NOT a
    // tab stop: RNW gives a Text no tabIndex, so it is reached by pointer only and is out of scope here.)
    const pressables = SRC.split("<Pressable").slice(1).map((block) => block.slice(0, block.indexOf("</Pressable>")))
    const linkPressables = pressables.filter((block) => /accessibilityRole="link"/.test(block))
    expect(linkPressables.length).toBeGreaterThanOrEqual(5)
    for (const block of linkPressables) {
      expect(block, `a role=link Pressable has no keyboard activation:\n${block.slice(0, 200)}`).toContain(
        "linkKeyProps(",
      )
    }
    // ...and the ROW itself, whose role is the platform-branched `ROW_ROLE` constant.
    expect(SRC).toContain("const rowKeyProps = linkKeyProps(")
  })

  it("stops Space scrolling the feed under the focused link, and ignores keys from nested controls", () => {
    const helper = SRC.slice(SRC.indexOf("function activateOnLinkKey"), SRC.indexOf("export function linkKeyProps"))
    expect(helper).toContain('e.key !== "Enter"')
    expect(helper).toContain("e.target !== e.currentTarget")
    expect(helper).toContain("e.preventDefault?.()")
  })
})

describe("PostCard's row fill answers a POINTER, and never a touch", () => {
  const SRC = readFileSync(new URL("../PostCard.tsx", import.meta.url), "utf8")

  it("reads the pointer pair with RNW's own touch guard, not the mouse pair", () => {
    // React's mouse-compat events fire for a tap and never fire the matching leave, so tapping Like left
    // the whole row painted in the hover fill - reading as selected - until the reader touched elsewhere.
    // RNW's own useHover skips `getPointerType(e) === 'touch'` in three places; this is that guard.
    const block = SRC.slice(SRC.indexOf("const rowHoverProps"), SRC.indexOf("const rowKeyProps"))
    expect(block).toContain("onPointerEnter")
    expect(block).toContain('event?.pointerType !== "touch"')
    expect(block).toContain("onPointerLeave")
    expect(block).toContain("onPointerCancel")
    expect(block).not.toContain("onMouseEnter")
  })
})

describe("the flat row's focus ring is drawn INSIDE its own box", () => {
  const SRC = readFileSync(new URL("../PostCard.tsx", import.meta.url), "utf8")

  it("insets the ring by its own footprint so the scroller cannot clip it", () => {
    // The row is exactly the width of an `overflow: hidden auto` scroller and the next row's opaque
    // background is a later sibling, so an outside ring lost its left, right AND bottom strokes - the
    // indicator was one coral bar ABOVE the row, i.e. pointing at the row above it.
    expect(SRC).toContain("outlineOffset: -RING_FOOTPRINT")
    expect(SRC).toMatch(/RING_FOOTPRINT = Number\.parseFloat\(.*tokens\.shadow\.ring/s)
  })

  it("passes it as a PLAIN style object, which is the only form that wins the cascade", () => {
    // RNW compiles StyleSheet entries into atomic CLASSES (specificity 0,1,0) and the ring rule is
    // `[data-focus-ring]:focus-visible` (0,2,0) - so as a StyleSheet entry the inset silently loses and
    // the ring stays outside. A plain object is written inline, which outranks any stylesheet rule.
    expect(SRC).toMatch(/const WEB_ROW_FOCUS_INSET: ViewStyle = IS_WEB/)
    const rowFlat = SRC.slice(SRC.indexOf("rowFlat: {"), SRC.indexOf("rowFlatHovered"))
    expect(rowFlat).not.toContain("WEB_ROW_FOCUS_INSET")
    expect(SRC).toContain("isFlat ? WEB_ROW_FOCUS_INSET : null")
  })
})
