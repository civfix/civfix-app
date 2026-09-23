import { describe, expect, it } from "vitest"
import type { CleanupDTO, OrganizationDTO, PostDTO, ReportDTO, UserProfileDTO } from "@civfix/shared"

import {
  clamp,
  defaultPreview,
  documentTitle,
  escapeHtml,
  formatEventWhen,
  isManagedLink,
  isManagedMeta,
  isPublicMediaUrl,
  metaTagsHtml,
  oneLine,
  previewForEvent,
  previewForOrganization,
  previewForPerson,
  previewForPost,
  previewForReport,
  previewForSignupPage,
  withNoindex,
  type EventPreviewInput,
  type OrganizationPreviewInput,
  type PersonPreviewInput,
  type PostPreviewInput,
  type PreviewContext,
  type ReportPreviewInput,
} from "./link-preview"
import { DEFAULT_DESCRIPTION } from "./site-meta"

const ctx: PreviewContext = {
  url: "https://civfix.org/pin/abc",
  origin: "https://civfix.org",
}

const BRAND_IMAGE = "https://civfix.org/og.png"

const SIZED_IMAGE = {
  kind: "image",
  status: "ready",
  url: "https://cdn.x/a.jpg",
  width: 1600,
  height: 1200,
}

const SIZED_THUMBED = { ...SIZED_IMAGE, thumbUrl: "https://cdn.x/a_t.jpg" }

describe("contract shapes", () => {
  it("accepts the published DTOs without a cast", () => {
    const report: ReportPreviewInput = {} as ReportDTO
    const event: EventPreviewInput = {} as CleanupDTO
    const person: PersonPreviewInput = {} as UserProfileDTO
    const org: OrganizationPreviewInput = {} as OrganizationDTO
    const post: PostPreviewInput = {} as PostDTO
    expect([report, event, person, org, post]).toHaveLength(5)
  })
})

describe("escaping and clamping", () => {
  it("escapes every html-significant character", () => {
    expect(escapeHtml(`<script>"x" & 'y'</script>`)).toBe(
      "&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;",
    )
  })

  it("collapses newlines and runs of whitespace into one line", () => {
    expect(oneLine("a\n\nb\t c   d\r\n")).toBe("a b c d")
  })

  it("clamps on a word boundary and appends an ellipsis", () => {
    expect(clamp("the quick brown fox jumps", 12)).toBe("the quick…")
    expect(clamp("short", 12)).toBe("short")
  })

  it("clamps on code points, so an emoji or a CJK supplementary character is never split", () => {
    const emoji = String.fromCodePoint(0x1f600)
    const clamped = clamp(`${"a".repeat(199)}${emoji}${emoji}`, 200)
    expect(clamped).toBe(`${"a".repeat(199)}${emoji}…`)
    expect(clamped).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/)

    const han = "漢字".repeat(150)
    expect(clamp(han, 200)).toBe(`${han.slice(0, 200)}…`)
    const rare = String.fromCodePoint(0x20000)
    expect(clamp(rare.repeat(201), 200)).toBe(`${rare.repeat(200)}…`)
    expect(clamp(rare.repeat(200), 200)).toBe(rare.repeat(200))
  })

  it("never emits an unescaped tag from user content", () => {
    const preview = previewForEvent(
      { title: `<img src=x onerror="alert(1)">`, scheduledAt: "2026-09-12T17:00:00.000Z" },
      ctx,
    )
    const html = metaTagsHtml(preview!)
    expect(html).not.toContain("<img")
    expect(html).toContain("&lt;img")
    expect(html).not.toContain("\n")
  })

  it("recognises the meta tags it manages", () => {
    expect(isManagedMeta("description", null)).toBe(true)
    expect(isManagedMeta(null, "og:image")).toBe(true)
    expect(isManagedMeta("og:title", null)).toBe(true)
    expect(isManagedMeta(null, "og:locale")).toBe(true)
    expect(isManagedMeta(null, "og:image:secure_url")).toBe(true)
    expect(isManagedMeta(null, "og:image:type")).toBe(true)
    expect(isManagedMeta("twitter:image:alt", null)).toBe(true)
    expect(isManagedMeta("viewport", null)).toBe(false)
    expect(isManagedMeta("theme-color", null)).toBe(false)
  })
})

describe("public media urls", () => {
  it("accepts an unsigned https url", () => {
    expect(isPublicMediaUrl("https://cdn.civfix.org/m/1.jpg")).toBe(true)
  })

  it("rejects presigned, http and malformed urls", () => {
    expect(isPublicMediaUrl("https://r2.example.com/m/1.jpg?X-Amz-Signature=deadbeef")).toBe(false)
    expect(isPublicMediaUrl("http://cdn.civfix.org/m/1.jpg")).toBe(false)
    expect(isPublicMediaUrl("not a url")).toBe(false)
    expect(isPublicMediaUrl(null)).toBe(false)
  })
})

describe("previewForReport", () => {
  const base: ReportPreviewInput = {
    visibility: "public",
    category: "graffiti",
    type: "graffiti",
    status: "in_progress",
    cityName: "Los Angeles, CA",
  }

  it("builds an X-style title from the type label and city, and a status-led description", () => {
    const preview = previewForReport(base, ctx)
    expect(preview?.title).toBe("Graffiti in Los Angeles, CA on civfix")
    expect(preview?.description).toBe("Graffiti — In progress · Los Angeles, CA")
    expect(preview?.type).toBe("article")
    expect(preview?.card).toBe("summary_large_image")
  })

  it("carries the resident's title and description, status first", () => {
    const preview = previewForReport(
      {
        ...base,
        title: "Underpass tagging by the skate ramp",
        description: "My neighbour Dana keeps spraying the wall behind 12 Elm.",
      },
      ctx,
    )!
    expect(preview.description).toBe(
      "In progress · Underpass tagging by the skate ramp · My neighbour Dana keeps spraying the wall behind 12 Elm.",
    )
    expect(metaTagsHtml(preview)).toContain("Underpass")
  })

  it("falls back to the category label when the type is unknown", () => {
    expect(previewForReport({ ...base, type: null }, ctx)?.title).toBe(
      "Graffiti in Los Angeles, CA on civfix",
    )
  })

  it("drops the city from the title when the server sent none", () => {
    expect(previewForReport({ ...base, cityName: null }, ctx)?.title).toBe("Graffiti on civfix")
  })

  it("refuses to preview a non-public report", () => {
    expect(previewForReport({ ...base, visibility: "hidden" }, ctx)).toBeNull()
  })

  it("uses the FIRST ready slide of the carousel: a thumbnail, a full image only when it has no thumbnail, and the brand image when that slide is not shareable", () => {
    const withMedia = (media: ReportPreviewInput["media"]) => previewForReport({ ...base, media }, ctx)!
    expect(previewForReport(base, ctx)?.image).toBe(BRAND_IMAGE)

    expect(
      withMedia([
        { kind: "image", status: "validating", url: "https://cdn.x/a.jpg" },
        { kind: "image", status: "ready", url: "https://cdn.x/b.jpg" },
      ]).image,
    ).toBe("https://cdn.x/b.jpg")

    const thumbed = withMedia([
      SIZED_THUMBED,
    ])
    expect(thumbed.image).toBe("https://cdn.x/a_t.jpg")
    expect(thumbed.imageIsBrand).toBe(false)

    const full = withMedia([
      SIZED_IMAGE,
    ])
    expect(full.image).toBe("https://cdn.x/a.jpg")

    expect(
      withMedia([{ kind: "video", status: "ready", url: "https://cdn.x/v.mp4", thumbUrl: "https://cdn.x/v_t.jpg" }]).image,
    ).toBe("https://cdn.x/v_t.jpg")
    expect(withMedia([{ kind: "video", status: "ready", url: "https://cdn.x/v.mp4" }]).image).toBe(
      BRAND_IMAGE,
    )

    const presignedFirst = withMedia([
      { kind: "image", status: "ready", url: "https://cdn.x/a.jpg?sig=1" },
      { kind: "image", status: "ready", url: "https://cdn.x/b.jpg" },
    ])
    expect(presignedFirst.image).toBe(BRAND_IMAGE)
    expect(presignedFirst.imageIsBrand).toBe(true)
  })

  it("never leaks the street address or coordinates", () => {
    const preview = previewForReport(
      {
        ...base,
        addr: "1234 Elm Street, Apt 5",
        lat: 34.0522,
        lng: -118.2437,
      } as ReportPreviewInput,
      ctx,
    )
    const html = metaTagsHtml(preview!)
    expect(html).not.toContain("Elm Street")
    expect(html).not.toContain("34.05")
    expect(html).not.toContain("118.24")
    expect(html).toContain("Los Angeles, CA")
  })
})

describe("previewForEvent", () => {
  const base: EventPreviewInput = {
    title: "Ballona Creek cleanup",
    scheduledAt: "2026-09-12T17:00:00.000Z",
    status: "upcoming",
  }

  it("formats the schedule in the platform time zone", () => {
    expect(formatEventWhen("2026-09-12T17:00:00.000Z")).toBe("Sat, Sep 12, 10:00 AM PDT")
    expect(formatEventWhen("nonsense")).toBe("")
    expect(formatEventWhen(null)).toBe("")
  })

  it("formats the schedule in the EVENT's zone when the row carries one", () => {
    expect(formatEventWhen("2026-09-12T17:00:00.000Z", "America/New_York")).toBe(
      "Sat, Sep 12, 1:00 PM EDT",
    )
  })

  it("falls back to the platform zone for a legacy row or an unusable zone", () => {
    expect(formatEventWhen("2026-09-12T17:00:00.000Z", null)).toBe("Sat, Sep 12, 10:00 AM PDT")
    expect(formatEventWhen("2026-09-12T17:00:00.000Z", "Mars/Olympus")).toBe(
      "Sat, Sep 12, 10:00 AM PDT",
    )
  })

  it("carries the event zone into the shared-link description", () => {
    const preview = previewForEvent({ ...base, timezone: "America/New_York" }, ctx)
    expect(preview?.description).toBe("Sat, Sep 12, 1:00 PM EDT · A volunteer event on civfix")
  })

  it("uses the cover, else the first gallery image, else the brand card", () => {
    const cover = "https://cdn.civfix.org/c/1.jpg"
    const gallery = ["https://cdn.civfix.org/g/1.jpg", "https://cdn.civfix.org/g/2.jpg"]
    const withCover = previewForEvent({ ...base, coverUrl: cover, galleryUrls: gallery }, ctx)
    expect(withCover?.image).toBe(cover)
    expect(withCover?.imageIsBrand).toBe(false)
    expect(previewForEvent({ ...base, galleryUrls: gallery }, ctx)?.image).toBe(gallery[0])
    expect(
      previewForEvent({ ...base, galleryUrls: ["https://cdn.civfix.org/g/1.jpg?sig=1"] }, ctx)?.image,
    ).toBe(BRAND_IMAGE)
    expect(previewForEvent(base, ctx)?.imageIsBrand).toBe(true)
  })

  it("refuses a cover that is not a plain https media url", () => {
    expect(previewForEvent({ ...base, coverUrl: "http://cdn.civfix.org/c/1.jpg" }, ctx)?.imageIsBrand).toBe(true)
    expect(previewForEvent({ ...base, coverUrl: "https://cdn.civfix.org/c/1.jpg?token=x" }, ctx)?.imageIsBrand).toBe(true)
  })

  it("keeps an unlisted event shareable by link with a title + schedule card, no cover, no host text and noindex, and refuses a private one", () => {
    const cover = "https://cdn.civfix.org/c/1.jpg"
    const unlisted = previewForEvent(
      {
        ...base,
        visibility: "unlisted",
        coverUrl: cover,
        galleryUrls: [cover],
        description: "Meet by the blue gate behind the school.",
        organizer: { name: "Ada Rivera", handle: "ada" },
        organization: { name: "River Keepers LA" },
      },
      ctx,
    )!
    expect(unlisted.title).toBe("Ballona Creek cleanup on civfix")
    expect(unlisted.description).toContain("Sat, Sep 12, 10:00 AM PDT")
    expect(unlisted.description).toBe("Sat, Sep 12, 10:00 AM PDT · A volunteer event on civfix")
    expect(unlisted.imageIsBrand).toBe(true)
    expect(unlisted.noindex).toBe(true)
    const unlistedHtml = metaTagsHtml(unlisted)
    for (const leaked of [cover, "blue gate", "Ada Rivera", "@ada", "River Keepers"]) {
      expect(unlistedHtml).not.toContain(leaked)
    }
    expect(previewForEvent({ ...base, visibility: "private", coverUrl: cover }, ctx)).toBeNull()
    const open = previewForEvent({ ...base, visibility: "public", coverUrl: cover }, ctx)
    expect(open?.image).toBe(cover)
    expect(open?.noindex).toBe(false)
  })

  it("treats a missing visibility as public, so an older server keeps its cover", () => {
    const cover = "https://cdn.civfix.org/c/1.jpg"
    expect(previewForEvent({ ...base, coverUrl: cover }, ctx)?.image).toBe(cover)
    expect(previewForEvent({ ...base, visibility: null, coverUrl: cover }, ctx)?.image).toBe(cover)
  })

  it("uses the event title and a date-led description", () => {
    const preview = previewForEvent(base, ctx)
    expect(preview?.title).toBe("Ballona Creek cleanup on civfix")
    expect(preview?.description).toBe("Sat, Sep 12, 10:00 AM PDT · A volunteer event on civfix")
    expect(preview?.imageIsBrand).toBe(true)
  })

  it("carries the host's description after the schedule and caps the headline at 80 chars", () => {
    const preview = previewForEvent(
      { ...base, description: "Bring gloves. Ask for Dana at 12 Elm St, apt 5." },
      ctx,
    )
    expect(preview?.description).toBe(
      "Sat, Sep 12, 10:00 AM PDT · Bring gloves. Ask for Dana at 12 Elm St, apt 5.",
    )
    const long = previewForEvent({ ...base, title: "Cleanup ".repeat(20) }, ctx)!
    expect(long.title.length).toBeLessThanOrEqual(91)
    expect(long.title.endsWith("… on civfix")).toBe(true)
  })

  it("names the host: the organization when there is one, else the organizer", () => {
    expect(
      previewForEvent(
        { ...base, organization: { name: "Reach Out LA" }, organizer: { name: "Ada", handle: "ada" } },
        ctx,
      )?.description,
    ).toBe("Sat, Sep 12, 10:00 AM PDT · Reach Out LA · A volunteer event on civfix")
    expect(
      previewForEvent({ ...base, organizer: { name: "Ada", handle: "ada" } }, ctx)?.description,
    ).toBe("Sat, Sep 12, 10:00 AM PDT · Ada (@ada) · A volunteer event on civfix")
    expect(
      previewForEvent({ ...base, organizer: { name: "Ada", handle: "ada", deleted: true } }, ctx)
        ?.description,
    ).toBe("Sat, Sep 12, 10:00 AM PDT · A volunteer event on civfix")
  })

  it("marks a cancelled event and never exposes the meeting address", () => {
    const preview = previewForEvent(
      { ...base, status: "cancelled", address: "9 Secret Ln" } as EventPreviewInput,
      ctx,
    )
    expect(preview?.description.startsWith("Cancelled · ")).toBe(true)
    expect(metaTagsHtml(preview!)).not.toContain("Secret Ln")
  })

  it("refuses to preview an untitled event", () => {
    expect(previewForEvent({ ...base, title: "" }, ctx)).toBeNull()
  })
})

describe("previewForPerson", () => {
  const base: PersonPreviewInput = {
    name: "Ada Rivera",
    handle: "ada",
    avatarUrl: "https://cdn.civfix.org/a/1.jpg",
  }

  it("builds the display-name and handle title on civfix, as a summary card", () => {
    const preview = previewForPerson(base, ctx)
    expect(preview?.title).toBe("Ada Rivera (@ada) on civfix")
    expect(preview?.description).toBe(DEFAULT_DESCRIPTION)
    expect(preview?.image).toBe("https://cdn.civfix.org/a/1.jpg")
    expect(preview?.card).toBe("summary")
    expect(preview?.type).toBe("profile")
  })

  it("uses the bio as the description", () => {
    const preview = previewForPerson(
      { ...base, bio: "Organizer in Mar Vista. Saturdays at the creek." },
      ctx,
    )!
    expect(preview.description).toBe("Organizer in Mar Vista. Saturdays at the creek.")
    expect(metaTagsHtml(preview)).toContain("Mar Vista")
  })

  it("never reads the account email field", () => {
    const html = metaTagsHtml(
      previewForPerson({ ...base, email: "ada@example.com" } as PersonPreviewInput, ctx)!,
    )
    expect(html).not.toContain("ada@example.com")
  })

  it("falls back to a large brand card when there is no handle or public avatar", () => {
    const preview = previewForPerson({ name: "Ada Rivera", handle: null }, ctx)
    expect(preview?.title).toBe("Ada Rivera on civfix")
    expect(preview?.description).toBe(DEFAULT_DESCRIPTION)
    expect(preview?.image).toBe(BRAND_IMAGE)
    expect(preview?.card).toBe("summary_large_image")
  })

  it("refuses to preview a deleted account", () => {
    expect(previewForPerson({ ...base, deleted: true }, ctx)).toBeNull()
    expect(previewForPerson({ ...base, name: "" }, ctx)).toBeNull()
  })
})

describe("previewForPost", () => {
  const base: PostPreviewInput = {
    kind: "post",
    body: "Cleared the storm drain on Venice Blvd this morning.",
    author: { name: "Ada Rivera", handle: "ada" },
    organization: null,
    media: [],
  }

  it("titles the card with the author's name and handle, on civfix, and uses the body as the description", () => {
    const preview = previewForPost(base, ctx)
    expect(preview?.title).toBe("Ada Rivera (@ada) on civfix")
    expect(preview?.description).toBe("Cleared the storm drain on Venice Blvd this morning.")
    expect(preview?.type).toBe("article")
    expect(preview?.card).toBe("summary_large_image")
    expect(preview?.imageIsBrand).toBe(true)
  })

  it("bylines a post published as an organization with the org, not the author", () => {
    const preview = previewForPost(
      { ...base, organization: { name: "River Keepers LA", slug: "river-keepers" } },
      ctx,
    )
    expect(preview?.title).toBe("River Keepers LA (@river-keepers) on civfix")
  })

  it("uses the first ready slide of the post's media and never carries its stored dimensions", () => {
    const thumbed = previewForPost(
      {
        ...base,
        media: [
          SIZED_THUMBED,
        ],
      },
      ctx,
    )!
    expect(thumbed.image).toBe("https://cdn.x/a_t.jpg")

    const full = previewForPost(
      { ...base, media: [SIZED_IMAGE] },
      ctx,
    )!
    expect(full.image).toBe("https://cdn.x/a.jpg")
    expect(metaTagsHtml(full)).not.toContain("1600")
  })

  it("falls back to the attached report's thumbnail when the post carries no media", () => {
    expect(
      previewForPost({ ...base, report: { title: "Graffiti", thumbUrl: "https://cdn.x/r.jpg" } }, ctx)
        ?.image,
    ).toBe("https://cdn.x/r.jpg")
    expect(
      previewForPost({ ...base, report: { title: "Graffiti", thumbUrl: "https://cdn.x/r.jpg?sig=1" } }, ctx)
        ?.image,
    ).toBe(BRAND_IMAGE)
  })

  it("renders a plain repost as the ORIGINAL post's card", () => {
    const original = {
      kind: "post",
      body: "Fresh mural on the underpass.",
      author: { name: "Bo Kim", handle: "bo" },
      media: [{ kind: "image", status: "ready", thumbUrl: "https://cdn.x/o_t.jpg", url: "https://cdn.x/o.jpg" }],
    }
    for (const input of [
      { ...base, kind: "repost", body: null, repostOf: original },
      { ...base, kind: "post", body: "  ", media: [], repostOf: original },
    ]) {
      const preview = previewForPost(input, ctx)
      expect(preview?.title).toBe("Bo Kim (@bo) on civfix")
      expect(preview?.description).toBe("Fresh mural on the underpass.")
      expect(preview?.image).toBe("https://cdn.x/o_t.jpg")
    }
  })

  it("keeps the quoter's text and media for a quote, borrowing the quoted post's image only when it has none", () => {
    const quoted = {
      kind: "post",
      body: "Original text.",
      author: { name: "Bo Kim", handle: "bo" },
      media: [{ kind: "image", status: "ready", thumbUrl: "https://cdn.x/q_t.jpg", url: "https://cdn.x/q.jpg" }],
    }
    const borrowing = previewForPost({ ...base, kind: "quote", body: "This!", repostOf: quoted }, ctx)
    expect(borrowing?.title).toBe("Ada Rivera (@ada) on civfix")
    expect(borrowing?.description).toBe("This!")
    expect(borrowing?.image).toBe("https://cdn.x/q_t.jpg")

    const own = previewForPost(
      {
        ...base,
        kind: "quote",
        body: "This!",
        media: [{ kind: "image", status: "ready", thumbUrl: "https://cdn.x/mine_t.jpg" }],
        repostOf: quoted,
      },
      ctx,
    )
    expect(own?.image).toBe("https://cdn.x/mine_t.jpg")
  })

  it("describes a bodiless report or event share by the attachment's title", () => {
    expect(
      previewForPost({ ...base, body: null, report: { title: "Overflowing bin on 5th" } }, ctx)
        ?.description,
    ).toBe("Overflowing bin on 5th")
    expect(
      previewForPost({ ...base, body: null, event: { title: "Ballona Creek cleanup" } }, ctx)
        ?.description,
    ).toBe("Ballona Creek cleanup")
    expect(previewForPost({ ...base, body: null }, ctx)?.description).toBe(DEFAULT_DESCRIPTION)
  })

  it("refuses a deleted author, a deleted original and a repost of nothing", () => {
    expect(previewForPost({ ...base, author: { name: "Ada", handle: "ada", deleted: true } }, ctx)).toBeNull()
    expect(
      previewForPost(
        { ...base, kind: "repost", body: null, repostOf: { deleted: true, author: { name: "Bo" } } },
        ctx,
      ),
    ).toBeNull()
    expect(previewForPost({ ...base, kind: "repost", body: null, repostOf: null }, ctx)).toBeNull()
  })

  it("escapes html in the body and never reads viewer, counts or mentions", () => {
    const html = metaTagsHtml(
      previewForPost(
        {
          ...base,
          body: `<img src=x onerror="alert(1)">`,
          viewer: { liked: true, reposted: false, saved: true },
          counts: { likes: 4242, reposts: 0, replies: 0, saves: 0 },
          mentions: [{ id: "u2", handle: "secretfriend", displayName: "Secret Friend" }],
        } as PostPreviewInput,
        ctx,
      )!,
    )
    expect(html).not.toContain("<img")
    expect(html).toContain("&lt;img")
    expect(html).not.toContain("liked")
    expect(html).not.toContain("4242")
    expect(html).not.toContain("secretfriend")
  })

  it("never leaks an attached report's address or coordinates, or an attached event's location or organizer bio", () => {
    const html = metaTagsHtml(
      previewForPost(
        {
          ...base,
          body: null,
          report: {
            title: "Overflowing bin on 5th",
            addr: "1234 Elm Street, Apt 5",
            lat: 34.0522,
            lng: -118.2437,
          },
          event: {
            title: "Ballona Creek cleanup",
            lat: 33.9911,
            lng: -118.4265,
            organizer: { name: "Dana", handle: "dana", bio: "Call me at 555-0199" },
          },
        } as PostPreviewInput,
        ctx,
      )!,
    )
    expect(html).toContain("Overflowing bin on 5th")
    for (const leaked of ["Elm Street", "34.05", "118.24", "33.99", "118.42", "555-0199"]) {
      expect(html).not.toContain(leaked)
    }
  })
})

const personWithAvatar: PersonPreviewInput = {
  name: "Ada",
  handle: "ada",
  avatarUrl: "https://cdn.civfix.org/a/1.jpg",
}

describe("metaTagsHtml", () => {
  it("emits the full open-graph and twitter set with the canonical url", () => {
    const html = metaTagsHtml(previewForPerson({ name: "Ada", handle: "ada" }, ctx)!)
    for (const tag of [
      `<meta name="description" content="${DEFAULT_DESCRIPTION}">`,
      '<meta property="og:site_name" content="civfix">',
      '<meta property="og:type" content="profile">',
      '<meta property="og:locale" content="en_US">',
      '<meta property="og:url" content="https://civfix.org/pin/abc">',
      '<meta property="og:title" content="Ada (@ada) on civfix">',
      `<meta property="og:description" content="${DEFAULT_DESCRIPTION}">`,
      '<meta property="og:image" content="https://civfix.org/og.png">',
      '<meta property="og:image:secure_url" content="https://civfix.org/og.png">',
      '<meta property="og:image:type" content="image/png">',
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      '<meta property="og:image:alt" content="Ada (@ada) on civfix">',
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:title" content="Ada (@ada) on civfix">',
      `<meta name="twitter:description" content="${DEFAULT_DESCRIPTION}">`,
      '<meta name="twitter:image" content="https://civfix.org/og.png">',
      '<meta name="twitter:image:alt" content="Ada (@ada) on civfix">',
      '<link rel="canonical" href="https://civfix.org/pin/abc">',
      '<link rel="icon" href="https://civfix.org/favicon.svg" type="image/svg+xml">',
      '<link rel="apple-touch-icon" href="https://civfix.org/apple-touch-icon.png" sizes="180x180">',
    ]) {
      expect(html).toContain(tag)
    }
  })

  it("builds every absolute url from the preview origin", () => {
    const staging: PreviewContext = {
      url: "https://civfix.dev/people/ada-id",
      origin: "https://civfix.dev",
    }
    const html = metaTagsHtml(previewForPerson({ name: "Ada", handle: "ada" }, staging)!)
    expect(html).toContain('<meta property="og:url" content="https://civfix.dev/people/ada-id">')
    expect(html).toContain('<meta property="og:image" content="https://civfix.dev/og.png">')
    expect(html).toContain(
      '<meta property="og:image:secure_url" content="https://civfix.dev/og.png">',
    )
    expect(html).toContain('<meta name="twitter:image" content="https://civfix.dev/og.png">')
    expect(html).toContain('<link rel="canonical" href="https://civfix.dev/people/ada-id">')
    expect(html).toContain('<link rel="icon" href="https://civfix.dev/favicon.svg"')
    expect(html).toContain('<link rel="apple-touch-icon" href="https://civfix.dev/apple-touch-icon.png"')
    expect(html).not.toContain("civfix.org")
  })

  it("emits a summary card for an avatar and omits the brand dimensions and type", () => {
    const html = metaTagsHtml(previewForPerson(personWithAvatar, ctx)!)
    expect(html).toContain('<meta name="twitter:card" content="summary">')
    expect(html).not.toContain("og:image:width")
    expect(html).not.toContain("og:image:height")
    expect(html).not.toContain("og:image:type")
    expect(html).toContain(
      '<meta property="og:image:secure_url" content="https://cdn.civfix.org/a/1.jpg">',
    )
  })
})

describe("metaTagsHtml image dimensions", () => {
  it("emits width and height only for the brand image, never for entity media, whose stored size may predate its rotation", () => {
    const post: PostPreviewInput = { body: "Hi", author: { name: "Ada", handle: "ada" } }
    const full = metaTagsHtml(
      previewForPost(
        { ...post, media: [SIZED_IMAGE] },
        ctx,
      )!,
    )
    expect(full).toContain('<meta property="og:image" content="https://cdn.x/a.jpg">')
    expect(full).not.toContain("og:image:width")
    expect(full).not.toContain("og:image:height")
    expect(full).not.toContain("og:image:type")

    const thumb = metaTagsHtml(
      previewForPost(
        {
          ...post,
          media: [SIZED_THUMBED],
        },
        ctx,
      )!,
    )
    expect(thumb).not.toContain("og:image:width")
    expect(thumb).not.toContain("og:image:height")
  })
})

describe("defaultPreview", () => {
  it("is the branded card, rendered by the same tag list as an entity", () => {
    const html = metaTagsHtml(defaultPreview(ctx))
    expect(html).toContain('<meta property="og:title" content="civfix">')
    expect(html).toContain('<meta property="og:type" content="website">')
    expect(html).toContain('<meta property="og:site_name" content="civfix">')
    expect(html).toContain('<meta property="og:image" content="https://civfix.org/og.png">')
    expect(html).toContain('<meta property="og:image:width" content="1200">')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
  })

  it("self-canonicalizes on the url it was built for, not the site root", () => {
    const html = metaTagsHtml(defaultPreview(ctx))
    expect(html).toContain('<meta property="og:url" content="https://civfix.org/pin/abc">')
    expect(html).toContain('<link rel="canonical" href="https://civfix.org/pin/abc">')
    expect(
      metaTagsHtml(defaultPreview({ url: "https://civfix.dev/", origin: "https://civfix.dev" })),
    ).toContain('<link rel="canonical" href="https://civfix.dev/">')
  })

  it("emits robots noindex only once withNoindex has been applied", () => {
    expect(metaTagsHtml(defaultPreview(ctx))).not.toContain("robots")
    expect(metaTagsHtml(withNoindex(defaultPreview(ctx)))).toContain(
      '<meta name="robots" content="noindex">',
    )
  })

  it("never marks a real entity preview noindex on its own", () => {
    for (const preview of [
      previewForReport({ visibility: "public", category: "graffiti" }, ctx)!,
      previewForEvent({ title: "Cleanup" }, ctx)!,
      previewForPerson({ name: "Ada" }, ctx)!,
    ]) {
      expect(preview.noindex).toBe(false)
      expect(metaTagsHtml(preview)).not.toContain("robots")
      expect(withNoindex(preview).noindex).toBe(true)
    }
  })
})

describe("withNoindex", () => {
  it("preserves every other field and is idempotent", () => {
    const live = previewForEvent({ title: "Cleanup" }, ctx)!
    const once = withNoindex(live)
    expect(once).toEqual({ ...live, noindex: true })
    expect(withNoindex(once)).toBe(once)
  })
})

describe("robots is a managed meta tag", () => {
  it("lets the rewriter strip a shell-authored robots directive", () => {
    expect(isManagedMeta("robots", null)).toBe(true)
    expect(isManagedMeta("Robots", null)).toBe(true)
    expect(isManagedMeta("googlebot", null)).toBe(false)
  })
})

describe("documentTitle", () => {
  it("suffixes the og:title with the site name", () => {
    expect(
      documentTitle(previewForSignupPage({ event: { title: "Beach cleanup" } }, ctx)!),
    ).toBe("Beach cleanup · civfix")
  })

  it("leaves a title that already ends with \" on civfix\" alone", () => {
    expect(documentTitle(previewForPost({ body: "Hi", author: { name: "Ada", handle: "ada" } }, ctx)!)).toBe(
      "Ada (@ada) on civfix",
    )
  })

  it("never doubles a title that already ends with the site name", () => {
    expect(documentTitle(previewForSignupPage({ event: { title: "Cleanup · civfix" } }, ctx)!)).toBe(
      "Cleanup · civfix",
    )
  })
})

describe("isManagedLink", () => {
  it("owns exactly the head links the preview replaces", () => {
    for (const rel of ["canonical", "icon", "Apple-Touch-Icon", " shortcut icon ", "icon shortcut"]) {
      expect(isManagedLink(rel)).toBe(true)
    }
    for (const rel of ["stylesheet", "preload", "modulepreload", "manifest", "shortcut", "", null]) {
      expect(isManagedLink(rel)).toBe(false)
    }
  })
})

describe("previewForOrganization", () => {
  const base: OrganizationPreviewInput = {
    name: "River Keepers LA",
    slug: "river-keepers",
    description: "We keep the LA River clean, one Saturday at a time.",
    logoUrl: "https://cdn.civfix.org/o/1.jpg",
    verifiedStatus: "verified",
    verifiedKind: "nonprofit",
    eventCount: 12,
  }

  it("builds the name-and-handle title and a verified, counted description", () => {
    const preview = previewForOrganization(base, ctx)
    expect(preview?.title).toBe("River Keepers LA (@river-keepers) on civfix")
    expect(preview?.card).toBe("summary")
    expect(preview?.description).toBe(
      "Verified nonprofit · 12 events · We keep the LA River clean, one Saturday at a time.",
    )
    expect(preview?.image).toBe("https://cdn.civfix.org/o/1.jpg")
    expect(preview?.imageIsBrand).toBe(false)
    expect(preview?.type).toBe("profile")
    expect(preview?.noindex).toBe(false)
  })

  it("never claims verification for a pending or rejected org, and falls back to the brand image", () => {
    const preview = previewForOrganization(
      { ...base, verifiedStatus: "pending", logoUrl: null, description: null, eventCount: 0 },
      ctx,
    )
    expect(preview?.description).toBe("Hosting volunteer events on civfix")
    expect(preview?.image).toBe(BRAND_IMAGE)
    expect(preview?.imageIsBrand).toBe(true)
  })

  it("clamps a long description to the card limit", () => {
    const preview = previewForOrganization({ ...base, description: "word ".repeat(80) }, ctx)
    expect((preview?.description ?? "").length).toBeLessThanOrEqual(200)
  })

  it("refuses to preview an organization without a name", () => {
    expect(previewForOrganization({ ...base, name: "" }, ctx)).toBeNull()
    expect(previewForOrganization({}, ctx)).toBeNull()
  })
})
