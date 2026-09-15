import { describe, expect, it } from "vitest"
import type { CleanupDTO, OrganizationDTO, ReportDTO, UserProfileDTO } from "@civfix/shared"

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
  previewForReport,
  withNoindex,
  type EventPreviewInput,
  type OrganizationPreviewInput,
  type PersonPreviewInput,
  type PreviewContext,
  type ReportPreviewInput,
} from "./link-preview"

const ctx: PreviewContext = {
  url: "https://civfix.org/pin/abc",
  origin: "https://civfix.org",
}

const BRAND_IMAGE = "https://civfix.org/og.png"

describe("contract shapes", () => {
  it("accepts the published DTOs without a cast", () => {
    const report: ReportPreviewInput = {} as ReportDTO
    const event: EventPreviewInput = {} as CleanupDTO
    const person: PersonPreviewInput = {} as UserProfileDTO
    const org: OrganizationPreviewInput = {} as OrganizationDTO
    expect([report, event, person, org]).toHaveLength(4)
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

  it("builds title and description from controlled vocabulary only", () => {
    const preview = previewForReport(base, ctx)
    expect(preview?.title).toBe("Graffiti · Los Angeles, CA")
    expect(preview?.description).toBe("Graffiti — In progress · Los Angeles, CA")
    expect(preview?.type).toBe("article")
  })

  it("never echoes the resident's own title or body text", () => {
    const html = metaTagsHtml(
      previewForReport(
        {
          ...base,
          title: "Underpass tagging by the skate ramp",
          description: "My neighbour Dana keeps spraying the wall behind 12 Elm.",
        } as ReportPreviewInput,
        ctx,
      )!,
    )
    expect(html).not.toContain("Underpass")
    expect(html).not.toContain("skate ramp")
    expect(html).not.toContain("Dana")
    expect(html).not.toContain("neighbour")
    expect(html).toContain("Graffiti — In progress · Los Angeles, CA")
  })

  it("falls back to the category label when the type is unknown", () => {
    expect(previewForReport({ ...base, type: null }, ctx)?.title).toBe(
      "Graffiti · Los Angeles, CA",
    )
  })

  it("refuses to preview a non-public report", () => {
    expect(previewForReport({ ...base, visibility: "hidden" }, ctx)).toBeNull()
  })

  it("uses the brand image unless a ready public image exists", () => {
    expect(previewForReport(base, ctx)?.image).toBe(BRAND_IMAGE)
    expect(
      previewForReport(
        { ...base, media: [{ kind: "image", status: "validating", url: "https://cdn.x/a.jpg" }] },
        ctx,
      )?.image,
    ).toBe(BRAND_IMAGE)
    expect(
      previewForReport(
        { ...base, media: [{ kind: "image", status: "ready", url: "https://cdn.x/a.jpg?sig=1" }] },
        ctx,
      )?.image,
    ).toBe(BRAND_IMAGE)
    const withImage = previewForReport(
      { ...base, media: [{ kind: "image", status: "ready", url: "https://cdn.x/a.jpg" }] },
      ctx,
    )
    expect(withImage?.image).toBe("https://cdn.x/a.jpg")
    expect(withImage?.imageIsBrand).toBe(false)
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

  it("uses the event title and a date-led fixed description", () => {
    const preview = previewForEvent(base, ctx)
    expect(preview?.title).toBe("Ballona Creek cleanup")
    expect(preview?.description).toBe("Sat, Sep 12, 10:00 AM PDT · A volunteer event on civfix")
    expect(preview?.imageIsBrand).toBe(true)
  })

  it("never echoes the host's description and caps the title at 80 chars", () => {
    const html = metaTagsHtml(
      previewForEvent(
        {
          ...base,
          description: "Bring gloves. Ask for Dana at 12 Elm St, apt 5.",
        } as EventPreviewInput,
        ctx,
      )!,
    )
    expect(html).not.toContain("gloves")
    expect(html).not.toContain("Dana")
    expect(html).not.toContain("Elm St")
    const long = previewForEvent({ ...base, title: "Cleanup ".repeat(20) }, ctx)!
    expect(long.title.length).toBeLessThanOrEqual(81)
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

  it("builds the display-name and handle title", () => {
    const preview = previewForPerson(base, ctx)
    expect(preview?.title).toBe("Ada Rivera (@ada)")
    expect(preview?.description).toBe("Ada Rivera (@ada) · On civfix")
    expect(preview?.image).toBe("https://cdn.civfix.org/a/1.jpg")
    expect(preview?.type).toBe("profile")
  })

  it("never echoes the bio", () => {
    const html = metaTagsHtml(
      previewForPerson(
        { ...base, bio: "Organizer in Mar Vista, reach me at ada@example.com" } as PersonPreviewInput,
        ctx,
      )!,
    )
    expect(html).not.toContain("Mar Vista")
    expect(html).not.toContain("ada@example.com")
    expect(html).not.toContain("Organizer")
  })

  it("falls back when there is no handle or public avatar", () => {
    const preview = previewForPerson({ name: "Ada Rivera", handle: null }, ctx)
    expect(preview?.title).toBe("Ada Rivera")
    expect(preview?.description).toBe("Ada Rivera · On civfix")
    expect(preview?.image).toBe(BRAND_IMAGE)
  })

  it("refuses to preview a deleted account", () => {
    expect(previewForPerson({ ...base, deleted: true }, ctx)).toBeNull()
    expect(previewForPerson({ ...base, name: "" }, ctx)).toBeNull()
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
      '<meta name="description" content="Ada (@ada) · On civfix">',
      '<meta property="og:site_name" content="civfix">',
      '<meta property="og:type" content="profile">',
      '<meta property="og:locale" content="en_US">',
      '<meta property="og:url" content="https://civfix.org/pin/abc">',
      '<meta property="og:title" content="Ada (@ada)">',
      '<meta property="og:description" content="Ada (@ada) · On civfix">',
      '<meta property="og:image" content="https://civfix.org/og.png">',
      '<meta property="og:image:secure_url" content="https://civfix.org/og.png">',
      '<meta property="og:image:type" content="image/png">',
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      '<meta property="og:image:alt" content="Ada (@ada)">',
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:title" content="Ada (@ada)">',
      '<meta name="twitter:description" content="Ada (@ada) · On civfix">',
      '<meta name="twitter:image" content="https://civfix.org/og.png">',
      '<meta name="twitter:image:alt" content="Ada (@ada)">',
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

  it("omits the brand image dimensions and type when a content photo is used", () => {
    const html = metaTagsHtml(previewForPerson(personWithAvatar, ctx)!)
    expect(html).not.toContain("og:image:width")
    expect(html).not.toContain("og:image:height")
    expect(html).not.toContain("og:image:type")
    expect(html).toContain(
      '<meta property="og:image:secure_url" content="https://cdn.civfix.org/a/1.jpg">',
    )
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
    expect(documentTitle(previewForPerson({ name: "Ada", handle: "ada" }, ctx)!)).toBe(
      "Ada (@ada) · civfix",
    )
  })

  it("never doubles a title that already ends with the site name", () => {
    expect(documentTitle(previewForEvent({ title: "Cleanup · civfix" }, ctx)!)).toBe(
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
    expect(preview?.title).toBe("River Keepers LA (@river-keepers)")
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
