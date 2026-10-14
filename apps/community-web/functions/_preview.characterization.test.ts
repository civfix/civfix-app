import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PERVASIVE_HEADERS } from "../src/lib/edge-headers"
import { documentTitle, type LinkPreview, type PreviewKind } from "../src/lib/link-preview"
import {
  API_TIMEOUT_MS,
  HTML_CONTENT_TYPE,
  buildPreview,
  runPreview,
  shouldNoindex,
  type EdgeCache,
  type PreviewContextArg,
  type PreviewEnv,
} from "./_preview-core"
import { handlePreview } from "./_preview"

const SHELL_HTML = "<html><head><title>civfix</title></head><body></body></html>"
const MUST_REVALIDATE = "public, max-age=0, must-revalidate"
const UUID = "8f14e45f-ceea-467a-9b2e-9a1f0d7c1b22"

const HOSTILE =
  `Ada "x" <script>alert(1)</script> & 'q'\n\tnext "><img src=x onerror=alert(1)> ` +
  `&amp; é 🌮 \u2028 end`
const HOSTILE_HANDLE = `ada"><script>alert(1)</script>`
const HOSTILE_MEDIA = `https://cdn.example.org/a"><script>alert(1)</script>&b'c.jpg`

const HOSTILE_PAYLOADS: Record<PreviewKind, { segment: string; id: string; payload: unknown }> = {
  report: {
    segment: "pin",
    id: UUID,
    payload: {
      id: UUID,
      visibility: "public",
      category: "graffiti",
      type: "graffiti",
      status: "in_progress",
      cityName: HOSTILE,
      title: HOSTILE,
      description: HOSTILE,
      media: [{ kind: "image", status: "ready", url: HOSTILE_MEDIA, thumbUrl: HOSTILE_MEDIA }],
    },
  },
  event: {
    segment: "cleanups",
    id: UUID,
    payload: {
      id: UUID,
      visibility: "public",
      title: HOSTILE,
      description: HOSTILE,
      scheduledAt: "2026-09-12T17:00:00.000Z",
      organization: { name: HOSTILE },
      coverUrl: HOSTILE_MEDIA,
    },
  },
  person: {
    segment: "people",
    id: UUID,
    payload: {
      profile: { id: UUID, name: HOSTILE, handle: HOSTILE_HANDLE, bio: HOSTILE, avatarUrl: HOSTILE_MEDIA },
    },
  },
  signup: {
    segment: "e",
    id: "beach-cleanup-may",
    payload: {
      slug: "beach-cleanup-may",
      visibility: "public",
      coverUrl: HOSTILE_MEDIA,
      seo: { title: HOSTILE, description: HOSTILE, noindex: false },
      organization: { name: HOSTILE },
      event: { title: HOSTILE, startsAt: "2026-09-12T17:00:00.000Z", status: "cancelled" },
    },
  },
  org: {
    segment: "orgs",
    id: "river-keepers",
    payload: {
      name: HOSTILE,
      slug: HOSTILE_HANDLE,
      description: HOSTILE,
      logoUrl: HOSTILE_MEDIA,
      verifiedStatus: "verified",
      verifiedKind: "nonprofit",
      eventCount: 3,
    },
  },
  post: {
    segment: "post",
    id: UUID,
    payload: {
      id: UUID,
      body: HOSTILE,
      author: { name: HOSTILE, handle: HOSTILE_HANDLE },
      media: [{ kind: "image", status: "ready", url: HOSTILE_MEDIA, thumbUrl: HOSTILE_MEDIA }],
    },
  },
}

const KINDS = Object.keys(HOSTILE_PAYLOADS) as PreviewKind[]

interface FakeElement {
  tag: "title" | "meta" | "link" | "head"
  attrs: Record<string, string>
  removed: boolean
  inner: { content: string; options: unknown }[]
  appended: { content: string; options: { html?: boolean } | undefined }[]
}

function fakeElement(tag: FakeElement["tag"], attrs: Record<string, string> = {}): FakeElement {
  return { tag, attrs, removed: false, inner: [], appended: [] }
}

interface RewriteRecord {
  selectors: string[]
  elements: FakeElement[]
}

let rewrites: RewriteRecord[] = []

function shellElements(): FakeElement[] {
  return [
    fakeElement("title"),
    fakeElement("meta", { charset: "utf-8" }),
    fakeElement("meta", { name: "viewport", content: "width=device-width" }),
    fakeElement("meta", { name: "description", content: "shell" }),
    fakeElement("meta", { property: "og:title", content: "shell" }),
    fakeElement("meta", { name: "twitter:card", content: "summary" }),
    fakeElement("meta", { name: "robots", content: "index" }),
    fakeElement("link", { rel: "canonical", href: "https://civfix.org/" }),
    fakeElement("link", { rel: "shortcut icon", href: "/favicon.ico" }),
    fakeElement("link", { rel: "stylesheet", href: "/app.css" }),
    fakeElement("link", { rel: "manifest", href: "/manifest.json" }),
    fakeElement("head"),
  ]
}

function selectorMatches(selector: string, element: FakeElement): boolean {
  if (selector === "head > title") return element.tag === "title"
  return selector === element.tag
}

class FakeHTMLRewriter {
  private readonly handlers: [string, { element(element: unknown): void }][] = []

  on(selector: string, handler: { element(element: unknown): void }): this {
    this.handlers.push([selector, handler])
    return this
  }

  transform(response: Response): Response {
    const elements = shellElements()
    rewrites.push({ selectors: this.handlers.map(([selector]) => selector), elements })
    for (const element of elements) {
      for (const [selector, handler] of this.handlers) {
        if (!selectorMatches(selector, element)) continue
        handler.element({
          getAttribute: (name: string) => element.attrs[name] ?? null,
          setInnerContent: (content: string, options?: unknown) => {
            element.inner.push({ content, options })
          },
          append: (content: string, options?: { html?: boolean }) => {
            element.appended.push({ content, options })
          },
          remove: () => {
            element.removed = true
          },
        })
      }
    }
    return new Response(response.body, { status: response.status, headers: response.headers })
  }
}

function makeCache(): EdgeCache & { entries: Map<string, Response> } {
  const entries = new Map<string, Response>()
  return {
    entries,
    async match(request: Request) {
      const hit = entries.get(request.url)
      return hit ? hit.clone() : undefined
    },
    async put(request: Request, response: Response) {
      entries.set(request.url, response)
    },
  }
}

interface Run {
  context: PreviewContextArg
  fetchSpy: ReturnType<typeof vi.fn>
  assets: ReturnType<typeof vi.fn>
  cache: ReturnType<typeof makeCache>
  waited: Promise<unknown>[]
}

function setup(options: {
  url: string
  path?: string[]
  env?: Partial<PreviewEnv>
  upstream?: (request: Request) => Promise<Response>
  asset?: () => Response
}): Run {
  const cache = makeCache()
  vi.stubGlobal("caches", { default: cache })
  const assets = vi.fn(
    async () =>
      options.asset?.() ??
      new Response(SHELL_HTML, { status: 200, headers: { "Content-Type": "text/html" } }),
  )
  const fetchSpy = vi.fn(
    options.upstream ?? (async () => new Response("", { status: 404 })),
  )
  vi.stubGlobal("fetch", fetchSpy)
  const waited: Promise<unknown>[] = []
  return {
    cache,
    assets,
    fetchSpy,
    waited,
    context: {
      request: new Request(options.url),
      env: { ASSETS: { fetch: assets }, ...options.env },
      params: { path: options.path ?? [UUID] },
      waitUntil: (promise) => {
        waited.push(promise)
      },
    },
  }
}

function jsonUpstream(payload: unknown): () => Promise<Response> {
  return async () => new Response(JSON.stringify(payload), { status: 200 })
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
}

const ATTR = `"([^"<>]*)"`
const META_TAG = new RegExp(`^<meta (name|property)=${ATTR} content=${ATTR}>`)
const LINK_TAG = new RegExp(`^<link rel=${ATTR} href=${ATTR}((?: [a-z]+=${ATTR})*)>`)

interface ParsedHead {
  meta: Map<string, string>
  links: Map<string, string>
  tagCount: number
}

function parseAppendedHead(html: string): ParsedHead {
  const meta = new Map<string, string>()
  const links = new Map<string, string>()
  let rest = html
  let tagCount = 0
  while (rest.length > 0) {
    const metaMatch = META_TAG.exec(rest)
    const linkMatch = metaMatch ? null : LINK_TAG.exec(rest)
    const match = metaMatch ?? linkMatch
    if (!match) throw new Error(`unparseable head tail: ${rest.slice(0, 80)}`)
    if (metaMatch) meta.set(unescapeHtml(metaMatch[2] as string), unescapeHtml(metaMatch[3] as string))
    else links.set(unescapeHtml(match[1] as string), unescapeHtml(match[2] as string))
    tagCount += 1
    rest = rest.slice(match[0].length)
  }
  return { meta, links, tagCount }
}

beforeEach(() => {
  rewrites = []
  vi.stubGlobal("HTMLRewriter", FakeHTMLRewriter)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("hostile entity content through the real rewriter", () => {
  for (const kind of KINDS) {
    const { segment, id, payload } = HOSTILE_PAYLOADS[kind]

    it(`escapes every injected meta and link value for a hostile ${kind}`, async () => {
      const origin = "https://civfix.org"
      const run = setup({
        url: `${origin}/${segment}/${id}`,
        path: [id],
        upstream: jsonUpstream(payload),
      })
      const response = await handlePreview(run.context, kind)
      expect(response.status).toBe(200)

      const expected = buildPreview(kind, payload, id, origin) as LinkPreview
      expect(expected).not.toBeNull()
      expect(expected.imageIsBrand).toBe(false)

      expect(rewrites).toHaveLength(1)
      const head = rewrites[0]?.elements.find((element) => element.tag === "head") as FakeElement
      expect(head.appended).toHaveLength(1)
      const appended = head.appended[0] as { content: string; options: { html?: boolean } | undefined }
      expect(appended.options).toEqual({ html: true })

      const html = appended.content
      expect(html).not.toMatch(/<(?!meta |link )/)
      expect(html).not.toMatch(/&(?!amp;|lt;|gt;|quot;|#39;)/)
      expect(html).not.toContain("<script")
      expect(html).not.toContain("\n")

      const parsed = parseAppendedHead(html)
      expect(parsed.tagCount).toBe(parsed.meta.size + parsed.links.size)
      expect(parsed.meta.get("og:title")).toBe(expected.title)
      expect(parsed.meta.get("twitter:title")).toBe(expected.title)
      expect(parsed.meta.get("og:image:alt")).toBe(expected.title)
      expect(parsed.meta.get("twitter:image:alt")).toBe(expected.title)
      expect(parsed.meta.get("description")).toBe(expected.description)
      expect(parsed.meta.get("og:description")).toBe(expected.description)
      expect(parsed.meta.get("twitter:description")).toBe(expected.description)
      expect(parsed.meta.get("og:image")).toBe(HOSTILE_MEDIA)
      expect(parsed.meta.get("og:image:secure_url")).toBe(HOSTILE_MEDIA)
      expect(parsed.meta.get("twitter:image")).toBe(HOSTILE_MEDIA)
      expect(parsed.meta.get("og:url")).toBe(`${origin}/${segment}/${id}`)
      expect(parsed.links.get("canonical")).toBe(`${origin}/${segment}/${id}`)
      expect(expected.title).toMatch(/<script>|"><script>/)
    })

    it(`hands the ${kind} document title to the rewriter as text, never as html`, async () => {
      const run = setup({
        url: `https://civfix.org/${segment}/${id}`,
        path: [id],
        upstream: jsonUpstream(payload),
      })
      await handlePreview(run.context, kind)
      const expected = buildPreview(kind, payload, id, "https://civfix.org") as LinkPreview
      const title = rewrites[0]?.elements.find((element) => element.tag === "title") as FakeElement
      expect(title.inner).toEqual([{ content: documentTitle(expected), options: undefined }])
    })
  }

  it("collapses newlines, tabs and the unicode line separator out of every title and description", () => {
    for (const kind of KINDS) {
      const { id, payload } = HOSTILE_PAYLOADS[kind]
      const preview = buildPreview(kind, payload, id, "https://civfix.org") as LinkPreview
      expect(preview.title, kind).not.toMatch(/[\n\t\u2028]/)
      expect(preview.description, kind).not.toMatch(/[\n\t\u2028]/)
    }
  })

  it("keeps non-ascii text verbatim and double-escapes an entity the author typed", async () => {
    const { id, payload } = HOSTILE_PAYLOADS.post
    const run = setup({ url: `https://civfix.org/post/${id}`, path: [id], upstream: jsonUpstream(payload) })
    await handlePreview(run.context, "post")
    const head = rewrites[0]?.elements.find((element) => element.tag === "head") as FakeElement
    const html = head.appended[0]?.content ?? ""
    expect(html).toContain("&amp;amp; é 🌮 end")
    expect(parseAppendedHead(html).meta.get("description")).toContain("&amp; é 🌮 end")
  })

  it("strips the shell's managed meta and links and leaves charset, viewport, stylesheet and manifest", async () => {
    const { id, payload } = HOSTILE_PAYLOADS.report
    const run = setup({ url: `https://civfix.org/pin/${id}`, path: [id], upstream: jsonUpstream(payload) })
    await handlePreview(run.context, "report")
    const record = rewrites[0] as RewriteRecord
    expect(record.selectors).toEqual(["head > title", "meta", "link", "head"])
    const removed = record.elements
      .filter((element) => element.removed)
      .map((element) => element.attrs.name ?? element.attrs.property ?? element.attrs.rel)
    expect(removed).toEqual([
      "description",
      "og:title",
      "twitter:card",
      "robots",
      "canonical",
      "shortcut icon",
    ])
    const kept = record.elements
      .filter((element) => !element.removed && element.tag !== "title" && element.tag !== "head")
      .map((element) => element.attrs.name ?? element.attrs.rel ?? Object.keys(element.attrs)[0])
    expect(kept).toEqual(["charset", "viewport", "stylesheet", "manifest"])
  })
})

describe("upstream timeout", () => {
  it("builds the upstream request with a 1500 ms AbortSignal.timeout", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout")
    const run = setup({
      url: `https://civfix.org/pin/${UUID}`,
      upstream: jsonUpstream(HOSTILE_PAYLOADS.report.payload),
    })
    await runPreview(run.context, "report", { rewrite: (shell) => shell })
    expect(API_TIMEOUT_MS).toBe(1500)
    expect(timeout).toHaveBeenCalledTimes(1)
    expect(timeout).toHaveBeenCalledWith(1500)
  })

  it("falls back to the indexable default head and a 15s transient entry when the timeout fires", async () => {
    const controller = new AbortController()
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal)
    let seen: Request | undefined
    const run = setup({
      url: `https://civfix.org/pin/${UUID}`,
      upstream: (request) => {
        seen = request
        return new Promise<Response>((_, reject) => {
          request.signal.addEventListener("abort", () => reject(request.signal.reason))
        })
      },
    })
    let rewritten: LinkPreview | undefined
    const pending = runPreview(run.context, "report", {
      rewrite: (shell, preview) => {
        rewritten = preview
        return shell
      },
    })
    await vi.waitFor(() => expect(seen).toBeDefined())
    expect(seen?.signal.aborted).toBe(false)
    controller.abort(new DOMException("The operation timed out.", "TimeoutError"))
    const response = await pending

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe(MUST_REVALIDATE)
    expect(rewritten?.title).toBe("civfix")
    expect(rewritten?.noindex).toBe(false)
    await Promise.all(run.waited)
    const [entry] = [...run.cache.entries.values()]
    expect(entry?.headers.get("x-civfix-preview-miss")).toBe("transient")
    expect(entry?.headers.get("Cache-Control")).toBe("public, max-age=15")
  })
})

describe("Cache-Control on every outcome", () => {
  const outcomes: { label: string; upstream: () => Promise<Response>; entry: string; marker: string | null }[] = [
    {
      label: "a found entity",
      upstream: jsonUpstream(HOSTILE_PAYLOADS.report.payload),
      entry: "public, max-age=300",
      marker: null,
    },
    { label: "a 404", upstream: async () => new Response("", { status: 404 }), entry: "public, max-age=60", marker: "missing" },
    { label: "a 410", upstream: async () => new Response("", { status: 410 }), entry: "public, max-age=60", marker: "missing" },
  ]

  for (const { label, upstream, entry, marker } of outcomes) {
    it(`serves must-revalidate to the client and caches ${label} at the edge as "${entry}"`, async () => {
      const run = setup({ url: `https://civfix.org/pin/${UUID}`, upstream })
      const response = await runPreview(run.context, "report", { rewrite: (shell) => shell })
      expect(response.headers.get("Cache-Control")).toBe(MUST_REVALIDATE)
      await Promise.all(run.waited)
      const [stored] = [...run.cache.entries.values()]
      expect(stored?.headers.get("Cache-Control")).toBe(entry)
      expect(stored?.headers.get("x-civfix-preview-miss")).toBe(marker)
    })
  }

  it("negative-caches a transient upstream failure (5xx, 429, network error) for 15s, shorter than a definite miss", async () => {
    const transient: (() => Promise<Response>)[] = [
      async () => new Response("", { status: 500 }),
      async () => new Response("", { status: 503 }),
      async () => new Response("", { status: 429 }),
      async () => {
        throw new TypeError("network down")
      },
    ]
    for (const upstream of transient) {
      const run = setup({ url: `https://civfix.org/pin/${UUID}`, upstream })
      const response = await runPreview(run.context, "report", { rewrite: (shell) => shell })
      expect(response.headers.get("Cache-Control")).toBe(MUST_REVALIDATE)
      await Promise.all(run.waited)
      const [stored] = [...run.cache.entries.values()]
      expect(stored?.headers.get("Cache-Control")).toBe("public, max-age=15")
      expect(stored?.headers.get("x-civfix-preview-miss")).toBe("transient")
    }
  })

  it("serves must-revalidate on a cache hit too", async () => {
    const run = setup({
      url: `https://civfix.org/pin/${UUID}`,
      upstream: jsonUpstream(HOSTILE_PAYLOADS.report.payload),
    })
    await runPreview(run.context, "report", { rewrite: (shell) => shell })
    await Promise.all(run.waited)
    const again = await runPreview(run.context, "report", { rewrite: (shell) => shell })
    expect(run.fetchSpy).toHaveBeenCalledTimes(1)
    expect(again.headers.get("Cache-Control")).toBe(MUST_REVALIDATE)
  })

  it("overrides the asset server's own Cache-Control and keeps its other headers", async () => {
    const run = setup({
      url: `https://civfix.org/pin/${UUID}`,
      asset: () =>
        new Response(SHELL_HTML, {
          status: 200,
          headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=14400", ETag: '"abc"' },
        }),
    })
    const response = await runPreview(run.context, "report", { rewrite: (shell) => shell })
    expect(response.headers.get("Cache-Control")).toBe(MUST_REVALIDATE)
    expect(response.headers.get("ETag")).toBe('"abc"')
  })
})

describe("security headers on every Function response", () => {
  const cases: {
    label: string
    path: (id: string) => string[]
    asset?: () => Response
    upstream?: (kind: PreviewKind) => () => Promise<Response>
    contentType: string
    status: number
  }[] = [
    { label: "the bare-prefix browse page", path: () => [], contentType: HTML_CONTENT_TYPE, status: 200 },
    { label: "a nested SPA route", path: (id) => [id, "edit"], contentType: HTML_CONTENT_TYPE, status: 200 },
    {
      label: "a shell the asset server could not find",
      path: (id) => [id],
      asset: () => new Response("gone", { status: 404, headers: { "Content-Type": "text/plain" } }),
      contentType: HTML_CONTENT_TYPE,
      status: 404,
    },
    {
      label: "a live entity preview",
      path: (id) => [id],
      upstream: (kind) => jsonUpstream(HOSTILE_PAYLOADS[kind].payload),
      contentType: HTML_CONTENT_TYPE,
      status: 200,
    },
    {
      label: "an upstream failure fallback",
      path: (id) => [id],
      upstream: () => async () => new Response("", { status: 502 }),
      contentType: HTML_CONTENT_TYPE,
      status: 200,
    },
  ]

  for (const kind of KINDS) {
    const { segment, id } = HOSTILE_PAYLOADS[kind]
    for (const testCase of cases) {
      it(`re-applies the /* header block on ${testCase.label} (${kind})`, async () => {
        const run = setup({
          url: `https://civfix.org/${segment}/${id}`,
          path: testCase.path(id),
          asset: testCase.asset,
          upstream: testCase.upstream?.(kind),
        })
        const response = await handlePreview(run.context, kind)
        expect(response.status).toBe(testCase.status)
        for (const [key, value] of Object.entries(PERVASIVE_HEADERS)) {
          expect(response.headers.get(key), key).toBe(value)
        }
        expect(response.headers.get("Content-Type")).toBe(testCase.contentType)
      })
    }
  }

  it("currently sends no X-Robots-Tag on a staging shell or browse response", async () => {
    for (const path of [[], [UUID, "edit"]]) {
      const run = setup({ url: `https://civfix.dev/pin/${UUID}`, path })
      const response = await handlePreview(run.context, "report")
      expect(response.headers.get("X-Robots-Tag")).toBeNull()
    }
  })
})

describe("origin, canonical, noindex and API per hostname", () => {
  const found = jsonUpstream(HOSTILE_PAYLOADS.report.payload)

  async function servedFor(url: string, env: Partial<PreviewEnv> = {}) {
    const run = setup({ url, upstream: found, env })
    let preview: LinkPreview | undefined
    await runPreview(run.context, "report", {
      rewrite: (shell, built) => {
        preview = built
        return shell
      },
    })
    const upstream = run.fetchSpy.mock.calls[0]?.[0] as Request
    return {
      canonical: preview?.url,
      origin: preview?.origin,
      noindex: preview?.noindex,
      api: new URL(upstream.url).origin,
    }
  }

  const table: { host: string; origin: string; noindex: boolean; api: string }[] = [
    { host: "civfix.org", origin: "https://civfix.org", noindex: false, api: "https://api.civfix.org" },
    { host: "www.civfix.org", origin: "https://civfix.org", noindex: false, api: "https://api.civfix.org" },
    { host: "civfix-web.pages.dev", origin: "https://civfix.org", noindex: false, api: "https://api.civfix.org" },
    { host: "civfix.dev", origin: "https://civfix.dev", noindex: true, api: "https://api.civfix.dev" },
    { host: "www.civfix.dev", origin: "https://civfix.dev", noindex: true, api: "https://api.civfix.dev" },
    { host: "staging.civfix-web.pages.dev", origin: "https://civfix.dev", noindex: true, api: "https://api.civfix.dev" },
    { host: "dev.civfix-web.pages.dev", origin: "https://civfix.org", noindex: false, api: "https://api.civfix.org" },
    { host: "a1b2c3d4.civfix-web.pages.dev", origin: "https://civfix.org", noindex: false, api: "https://api.civfix.org" },
    { host: "evil.example", origin: "https://civfix.org", noindex: false, api: "https://api.civfix.org" },
  ]

  for (const { host, origin, noindex, api } of table) {
    it(`serves ${host} with origin ${origin}, noindex ${noindex} and the ${api} API`, async () => {
      expect(await servedFor(`https://${host}/pin/${UUID}`)).toEqual({
        canonical: `${origin}/pin/${UUID}`,
        origin,
        noindex,
        api,
      })
    })
  }

  it("currently canonicalises a non-default-port staging URL to production while still reading the staging API", async () => {
    expect(await servedFor(`https://civfix.dev:8443/pin/${UUID}`)).toEqual({
      canonical: `https://civfix.org/pin/${UUID}`,
      origin: "https://civfix.org",
      noindex: false,
      api: "https://api.civfix.dev",
    })
  })

  it("noindexes a definite miss on production and every outcome off it", () => {
    const matrix: [string, "found" | "missing" | "transient", boolean][] = [
      ["https://civfix.org", "found", false],
      ["https://civfix.org", "transient", false],
      ["https://civfix.org", "missing", true],
      ["https://civfix.dev", "found", true],
      ["https://civfix.dev", "transient", true],
      ["https://civfix.dev", "missing", true],
      ["https://civfix.org/", "found", true],
      ["http://civfix.org", "found", true],
    ]
    for (const [origin, outcome, expected] of matrix) {
      expect(shouldNoindex(origin, outcome), `${origin} ${outcome}`).toBe(expected)
    }
  })
})
