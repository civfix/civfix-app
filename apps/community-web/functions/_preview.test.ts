import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PERVASIVE_HEADERS } from "../src/lib/edge-headers"
import {
  documentTitle,
  isManagedLink,
  metaTagsHtml,
  type LinkPreview,
} from "../src/lib/link-preview"
import {
  API_TIMEOUT_MS,
  HTML_CONTENT_TYPE,
  PREVIEW_CACHE_TTL_SEC,
  PREVIEW_NEGATIVE_CACHE_TTL_SEC,
  apiBaseFor,
  buildPreview,
  buildUpstreamRequest,
  cacheTtlSeconds,
  cacheablePayloadResponse,
  isNegativeCacheEntry,
  isValidPreviewId,
  negativeCacheOutcome,
  negativeCacheResponse,
  parsePreviewRoute,
  previewCacheKey,
  runPreview,
  shouldFallback,
  shouldNoindex,
  upstreamOutcome,
  withPervasiveHeaders,
  type EdgeCache,
  type PreviewContextArg,
  type PreviewEnv,
} from "./_preview-core"
import type { PreviewKind } from "../src/lib/link-preview"

const SHELL_HTML = "<html><head><title>civfix</title></head><body></body></html>"
const UUID = "8f14e45f-ceea-467a-9b2e-9a1f0d7c1b22"
const REPORT_PAYLOAD = {
  id: "8f14e45f-ceea-467a-9b2e-9a1f0d7c1b22",
  visibility: "public",
  category: "graffiti",
  type: "graffiti",
  status: "in_progress",
  title: "Underpass tagging by the bus stop",
  description: "Tags across the underpass wall near the bus stop.",
  cityName: "Los Angeles, CA",
}

function shellResponse(): Response {
  return new Response(SHELL_HTML, { status: 200, headers: { "Content-Type": "text/html" } })
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

interface Harness {
  context: PreviewContextArg
  rewrite: ReturnType<typeof vi.fn>
  fetchSpy: ReturnType<typeof vi.fn>
  assets: ReturnType<typeof vi.fn>
  waited: Promise<unknown>[]
}

function harness(options: {
  path?: string | string[]
  method?: string
  url?: string
  env?: Partial<PreviewEnv>
  upstream?: () => Promise<Response>
} = {}): Harness {
  const assets = vi.fn(async () => shellResponse())
  const fetchSpy = vi.fn(options.upstream ?? (async () => new Response(JSON.stringify(REPORT_PAYLOAD), { status: 200 })))
  vi.stubGlobal("fetch", fetchSpy)
  const waited: Promise<unknown>[] = []
  const rewrite = vi.fn((shell: Response, preview: LinkPreview) => {
    const html = SHELL_HTML.replace("<title>civfix</title>", `<title>${documentTitle(preview)}</title>`)
      .replace("</head>", `${metaTagsHtml(preview)}</head>`)
    return new Response(html, { status: shell.status, headers: shell.headers })
  })
  return {
    assets,
    fetchSpy,
    rewrite,
    waited,
    context: {
      request: new Request(options.url ?? "https://civfix.org/pin/abc", {
        method: options.method ?? "GET",
        headers: { cookie: "civfix_session=secret", authorization: "Bearer secret" },
      }),
      env: { ASSETS: { fetch: assets }, ...options.env },
      params: { path: options.path ?? ["8f14e45f-ceea-467a-9b2e-9a1f0d7c1b22"] },
      waitUntil: (promise) => {
        waited.push(promise)
      },
    },
  }
}

beforeEach(() => {
  vi.stubGlobal("caches", { default: makeCache() })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("parsePreviewRoute", () => {
  it("only ever previews a GET", () => {
    expect(parsePreviewRoute("report", "HEAD", [UUID])).toEqual({ action: "passthrough" })
    expect(parsePreviewRoute("report", "POST", [UUID])).toEqual({ action: "passthrough" })
    expect(parsePreviewRoute("report", "OPTIONS", [UUID])).toEqual({ action: "passthrough" })
    expect(parsePreviewRoute("report", "get", [UUID])).toEqual({ action: "preview", id: UUID })
  })

  it("serves the browse page for the bare prefix", () => {
    expect(parsePreviewRoute("report", "GET", undefined)).toEqual({ action: "browse" })
    expect(parsePreviewRoute("report", "GET", [])).toEqual({ action: "browse" })
    expect(parsePreviewRoute("report", "GET", [""])).toEqual({ action: "browse" })
  })

  it("leaves nested SPA routes such as /pin/<id>/edit untouched", () => {
    expect(parsePreviewRoute("report", "GET", [UUID, "edit"])).toEqual({ action: "shell" })
    expect(parsePreviewRoute("report", "GET", [UUID, "chat", "1"])).toEqual({ action: "shell" })
  })

  it("accepts exactly the id shapes each kind's API resolves, case intact", () => {
    const matrix: Record<PreviewKind, { ok: readonly string[]; bad: readonly string[] }> = {
      report: {
        ok: [UUID, "GR-12-000001", "DU-4970-000001"],
        bad: ["gr-12-000001", "EVENT-12-000045", "XX-1-000001", "GR-12-1"],
      },
      event: {
        ok: [UUID, "EVENT-12-000045", "beach-cleanup-may"],
        bad: ["Event-12-000045", "EVENT-12-45", "GR-12-000001", "Beach-Cleanup", "ab"],
      },
      person: {
        ok: [UUID, "ada", "Ada_Rivera"],
        bad: ["ab", "ada.r", "a".repeat(21), "ada-r"],
      },
      org: { ok: ["river-keepers"], bad: ["River-Keepers", "ab", "a".repeat(41)] },
      signup: { ok: ["beach-cleanup-may"], bad: ["a".repeat(61)] },
      post: { ok: [UUID], bad: ["GR-12-000001", "ada"] },
    }
    const hostile = ["a.b", "..%2F", "../secret", "a/b", "a b", "a?b", "%2e%2e", "-leading", ""]
    for (const [kind, { ok, bad }] of Object.entries(matrix) as [PreviewKind, (typeof matrix)[PreviewKind]][]) {
      for (const id of ok) expect(isValidPreviewId(kind, id), `${kind} ${id}`).toBe(true)
      for (const id of [...bad, ...hostile]) {
        expect(isValidPreviewId(kind, id), `${kind} ${id}`).toBe(false)
      }
    }
  })
})

describe("buildUpstreamRequest", () => {
  it("forwards no cookie or authorization and aborts at 1.5s", () => {
    const request = buildUpstreamRequest("report", "abc", "https://api.civfix.org")
    expect(request.method).toBe("GET")
    expect(request.url).toBe("https://api.civfix.org/v1/reports/abc")
    expect(request.headers.get("cookie")).toBeNull()
    expect(request.headers.get("authorization")).toBeNull()
    expect(request.headers.get("accept")).toBe("application/json")
    expect(request.signal).toBeTruthy()
    expect(API_TIMEOUT_MS).toBe(1500)
  })

  it("forwards a reference code and a mixed-case handle upstream unchanged", () => {
    const base = "https://api.civfix.org"
    expect(buildUpstreamRequest("report", "GR-12-000001", base).url).toBe(
      "https://api.civfix.org/v1/reports/GR-12-000001",
    )
    expect(buildUpstreamRequest("event", "EVENT-12-000045", base).url).toBe(
      "https://api.civfix.org/v1/cleanups/EVENT-12-000045",
    )
    expect(buildUpstreamRequest("person", "Ada_Rivera", base).url).toBe(
      "https://api.civfix.org/v1/people/Ada_Rivera",
    )
    expect(buildUpstreamRequest("post", UUID, base).url).toBe(
      `https://api.civfix.org/v1/posts/${UUID}`,
    )
  })

  it("percent-encodes the id into the upstream path", () => {
    expect(buildUpstreamRequest("event", "a-b_c", "https://api.civfix.dev").url).toBe(
      "https://api.civfix.dev/v1/cleanups/a-b_c",
    )
    expect(buildUpstreamRequest("person", "abc", "https://api.civfix.org").url).toBe(
      "https://api.civfix.org/v1/people/abc",
    )
  })
})

describe("apiBaseFor", () => {
  const assets = { fetch: async () => shellResponse() }

  it("defaults to the production API", () => {
    expect(apiBaseFor("https://civfix.org/pin/abc", { ASSETS: assets })).toBe("https://api.civfix.org")
  })

  it("uses the staging API only for an exactly-matching staging host", () => {
    expect(apiBaseFor("https://civfix.dev/pin/abc", { ASSETS: assets })).toBe("https://api.civfix.dev")
    expect(apiBaseFor("https://dev.civfix-web.pages.dev/pin/abc", { ASSETS: assets })).toBe(
      "https://api.civfix.dev",
    )
    expect(apiBaseFor("https://civfix.dev.evil.com/pin/abc", { ASSETS: assets })).toBe(
      "https://api.civfix.org",
    )
    expect(apiBaseFor("https://dev.attacker.example/pin/abc", { ASSETS: assets })).toBe(
      "https://api.civfix.org",
    )
  })

  it("honours only an https override on an allowlisted hostname", () => {
    const base = (CIVFIX_API_URL: string) =>
      apiBaseFor("https://civfix.org/pin/abc", { ASSETS: assets, CIVFIX_API_URL })
    expect(base("https://api.civfix.dev")).toBe("https://api.civfix.dev")
    expect(base("https://api.civfix.org/")).toBe("https://api.civfix.org")
    expect(base("http://api.civfix.org")).toBe("https://api.civfix.org")
    expect(base("https://api.civfix.org.evil.com")).toBe("https://api.civfix.org")
    expect(base("https://attacker.example")).toBe("https://api.civfix.org")
    expect(base("not a url")).toBe("https://api.civfix.org")
  })
})

describe("cache policy", () => {
  const assets = { fetch: async () => shellResponse() }
  const hostOf = (requestUrl: string) => new URL(apiBaseFor(requestUrl, { ASSETS: assets })).hostname

  it("keys by api host, kind and validated id", () => {
    expect(previewCacheKey("report", "abc", "api.civfix.org")).toBe(
      "https://link-preview.civfix.internal/api.civfix.org/report/abc",
    )
    expect(previewCacheKey("event", "abc", "api.civfix.org")).toBe(
      "https://link-preview.civfix.internal/api.civfix.org/event/abc",
    )
    expect(previewCacheKey("person", "abc", "api.civfix.org")).toBe(
      "https://link-preview.civfix.internal/api.civfix.org/person/abc",
    )
  })

  it("gives two request origins two distinct keys and one origin one stable key", () => {
    const prod = previewCacheKey("report", "abc", hostOf("https://civfix.org/pin/abc"))
    const staging = previewCacheKey("report", "abc", hostOf("https://civfix.dev/pin/abc"))
    expect(prod).not.toBe(staging)
    expect(prod).toBe(previewCacheKey("report", "abc", hostOf("https://www.civfix.org/pin/abc")))
    expect(staging).toBe(
      previewCacheKey("report", "abc", hostOf("https://dev.civfix-web.pages.dev/pin/abc")),
    )
  })

  it("uses a 300s positive and a 60s negative TTL", () => {
    expect(cacheTtlSeconds(true)).toBe(PREVIEW_CACHE_TTL_SEC)
    expect(cacheTtlSeconds(false)).toBe(PREVIEW_NEGATIVE_CACHE_TTL_SEC)
    expect(cacheablePayloadResponse("{}").headers.get("Cache-Control")).toBe("public, max-age=300")
    expect(negativeCacheResponse("missing").headers.get("Cache-Control")).toBe("public, max-age=60")
    expect(isNegativeCacheEntry(negativeCacheResponse("missing"))).toBe(true)
    expect(isNegativeCacheEntry(negativeCacheResponse("transient"))).toBe(true)
    expect(isNegativeCacheEntry(cacheablePayloadResponse("{}"))).toBe(false)
  })

  it("noindexes a definite miss anywhere, and everything off the production origin", () => {
    expect(shouldNoindex("https://civfix.org", "found")).toBe(false)
    expect(shouldNoindex("https://civfix.org", "transient")).toBe(false)
    expect(shouldNoindex("https://civfix.org", "missing")).toBe(true)
    for (const outcome of ["found", "transient", "missing"] as const) {
      expect(shouldNoindex("https://civfix.dev", outcome)).toBe(true)
    }
  })

  it("carries the upstream outcome through the negative entry", () => {
    expect(upstreamOutcome(200)).toBe("found")
    for (const status of [404, 410]) expect(upstreamOutcome(status)).toBe("missing")
    for (const status of [403, 429, 500, 502, 503]) expect(upstreamOutcome(status)).toBe("transient")
    expect(negativeCacheOutcome(negativeCacheResponse("missing"))).toBe("missing")
    expect(negativeCacheOutcome(negativeCacheResponse("transient"))).toBe("transient")
    expect(negativeCacheOutcome(cacheablePayloadResponse("{}"))).toBeNull()
  })

  it("treats every non-2xx upstream status as a fallback", () => {
    for (const status of [404, 429, 500, 502, 503, 301, 401]) expect(shouldFallback(status)).toBe(true)
    expect(shouldFallback(200)).toBe(false)
  })

  it("populates the cache through waitUntil and serves the next hit from it", async () => {
    const first = harness()
    await runPreview(first.context, "report", { rewrite: first.rewrite })
    expect(first.waited).toHaveLength(1)
    await Promise.all(first.waited)
    expect(first.fetchSpy).toHaveBeenCalledTimes(1)

    const second = harness()
    await runPreview(second.context, "report", { rewrite: second.rewrite })
    expect(second.fetchSpy).not.toHaveBeenCalled()
    expect(second.rewrite).toHaveBeenCalledTimes(1)
  })

  it("caches a miss so a 404 is not re-fetched within the negative TTL", async () => {
    const first = harness({ upstream: async () => new Response("", { status: 404 }) })
    await runPreview(first.context, "report", { rewrite: first.rewrite })
    await Promise.all(first.waited)

    const second = harness()
    const response = await runPreview(second.context, "report", { rewrite: second.rewrite })
    expect(second.fetchSpy).not.toHaveBeenCalled()
    expect(await response.text()).toContain('<meta property="og:title" content="civfix">')
  })

  it("never serves a staging negative entry to a production request", async () => {
    const id = "8f14e45f-ceea-467a-9b2e-9a1f0d7c1b22"
    const staging = harness({
      url: `https://civfix.dev/pin/${id}`,
      upstream: async () => new Response("", { status: 404 }),
    })
    await runPreview(staging.context, "report", { rewrite: staging.rewrite })
    await Promise.all(staging.waited)

    const prod = harness({ url: `https://civfix.org/pin/${id}` })
    const response = await runPreview(prod.context, "report", { rewrite: prod.rewrite })
    expect(prod.fetchSpy).toHaveBeenCalledTimes(1)
    const html = await response.text()
    expect(html).toContain('<meta property="og:title" content="Graffiti in Los Angeles, CA on civfix">')
    expect(html).not.toContain("robots")
  })
})

describe("withPervasiveHeaders", () => {
  it("re-applies the whole /* header block Cloudflare skips for Functions", () => {
    const headers = withPervasiveHeaders(new Response("x")).headers
    for (const [key, value] of Object.entries(PERVASIVE_HEADERS)) {
      expect(headers.get(key)).toBe(value)
    }
    expect(headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate")
  })
})

describe("runPreview", () => {
  it("passes a non-GET straight to the asset server without touching the API", async () => {
    const h = harness({ method: "POST" })
    const response = await runPreview(h.context, "report", { rewrite: h.rewrite })
    expect(h.fetchSpy).not.toHaveBeenCalled()
    expect(h.rewrite).not.toHaveBeenCalled()
    expect(h.assets).toHaveBeenCalledWith(h.context.request)
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate")
  })

  it("serves the browse shell for the bare prefix without an API call", async () => {
    const h = harness({ path: [], url: "https://civfix.org/cleanups/" })
    await runPreview(h.context, "event", { rewrite: h.rewrite })
    expect(h.fetchSpy).not.toHaveBeenCalled()
    expect(String(h.assets.mock.calls[0]?.[0])).toBe("https://civfix.org/__spa/cleanups/")
  })

  it("leaves /pin/<id>/edit as the plain SPA shell", async () => {
    const h = harness({ path: ["8f14e45f-ceea", "edit"] })
    const response = await runPreview(h.context, "report", { rewrite: h.rewrite })
    expect(h.fetchSpy).not.toHaveBeenCalled()
    expect(h.rewrite).not.toHaveBeenCalled()
    expect(await response.text()).toBe(SHELL_HTML)
  })

  it("never lets a hostile id reach upstream", async () => {
    for (const bad of [
      "..%2F",
      "../secret",
      "a.b",
      "ABCDEF",
      "a".repeat(65),
      "gr-12-000001",
      "EVENT-12-000045",
      "Ada",
    ]) {
      const h = harness({ path: [bad] })
      const response = await runPreview(h.context, "report", { rewrite: h.rewrite })
      expect(h.fetchSpy).not.toHaveBeenCalled()
      expect(await response.text()).toBe(SHELL_HTML)
    }
  })

  it("previews a report shared by its reference code", async () => {
    const cache = makeCache()
    vi.stubGlobal("caches", { default: cache })
    const h = harness({ url: "https://civfix.org/pin/GR-12-000001", path: ["GR-12-000001"] })
    const html = await (await runPreview(h.context, "report", { rewrite: h.rewrite })).text()
    expect(h.fetchSpy.mock.calls[0]?.[0]?.url).toBe(
      "https://api.civfix.org/v1/reports/GR-12-000001",
    )
    await Promise.all(h.waited)
    expect([...cache.entries.keys()].some((key) => key.includes("/report/GR-12-000001"))).toBe(true)
    expect(html).toContain(`<meta property="og:url" content="https://civfix.org/pin/${UUID}">`)
  })

  it("falls back to the branded default head on 404, 500, 429 and a timeout", async () => {
    const upstreams = [
      async () => new Response("", { status: 404 }),
      async () => new Response("", { status: 500 }),
      async () => new Response("", { status: 429 }),
      async () => {
        throw new DOMException("The operation was aborted", "TimeoutError")
      },
    ]
    for (const upstream of upstreams) {
      vi.stubGlobal("caches", { default: makeCache() })
      const h = harness({ upstream })
      const response = await runPreview(h.context, "report", { rewrite: h.rewrite })
      const html = await response.text()
      expect(html).toContain("<title>civfix</title>")
      expect(html).toContain('<meta property="og:title" content="civfix">')
      expect(html).toContain('<meta property="og:image" content="https://civfix.org/og.png">')
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
      expect(response.status).toBe(200)
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate")
      expect(response.headers.get("Content-Security-Policy")).toBe(
        PERVASIVE_HEADERS["Content-Security-Policy"],
      )
    }
  })

  it("noindexes a definitely-missing entity and leaves a transient failure indexable", async () => {
    for (const status of [404, 410]) {
      vi.stubGlobal("caches", { default: makeCache() })
      const h = harness({ upstream: async () => new Response("", { status }) })
      const response = await runPreview(h.context, "report", { rewrite: h.rewrite })
      expect(response.status).toBe(200)
      const html = await response.text()
      expect(html).toContain('<meta name="robots" content="noindex">')
      expect(html).toContain('<meta property="og:title" content="civfix">')
    }

    const transient: (() => Promise<Response>)[] = [
      async () => new Response("", { status: 503 }),
      async () => new Response("", { status: 500 }),
      async () => new Response("", { status: 429 }),
      async () => new Response("", { status: 403 }),
      async () => {
        throw new DOMException("The operation was aborted", "TimeoutError")
      },
    ]
    for (const upstream of transient) {
      vi.stubGlobal("caches", { default: makeCache() })
      const h = harness({ upstream })
      const html = await (await runPreview(h.context, "report", { rewrite: h.rewrite })).text()
      expect(html).not.toContain("robots")
      expect(html).toContain(
        '<link rel="canonical" href="https://civfix.org/pin/8f14e45f-ceea-467a-9b2e-9a1f0d7c1b22">',
      )
    }
  })

  it("replays the cached outcome so a repeat miss keeps its noindex decision", async () => {
    const missed = harness({ upstream: async () => new Response("", { status: 404 }) })
    await runPreview(missed.context, "report", { rewrite: missed.rewrite })
    await Promise.all(missed.waited)
    const replayMiss = harness()
    const missHtml = await (
      await runPreview(replayMiss.context, "report", { rewrite: replayMiss.rewrite })
    ).text()
    expect(replayMiss.fetchSpy).not.toHaveBeenCalled()
    expect(missHtml).toContain('<meta name="robots" content="noindex">')

    vi.stubGlobal("caches", { default: makeCache() })
    const failed = harness({ upstream: async () => new Response("", { status: 503 }) })
    await runPreview(failed.context, "report", { rewrite: failed.rewrite })
    await Promise.all(failed.waited)
    const replayFailure = harness()
    const failureHtml = await (
      await runPreview(replayFailure.context, "report", { rewrite: replayFailure.rewrite })
    ).text()
    expect(replayFailure.fetchSpy).not.toHaveBeenCalled()
    expect(failureHtml).not.toContain("robots")
  })

  it("noindexes every card served off a non-production origin, live entity included", async () => {
    const id = "8f14e45f-ceea-467a-9b2e-9a1f0d7c1b22"
    for (const host of ["civfix.dev", "www.civfix.dev", "dev.civfix-web.pages.dev"]) {
      vi.stubGlobal("caches", { default: makeCache() })
      const h = harness({ url: `https://${host}/pin/${id}` })
      const html = await (await runPreview(h.context, "report", { rewrite: h.rewrite })).text()
      expect(html).toContain('<meta name="robots" content="noindex">')
      expect(html).toContain('<meta property="og:title" content="Graffiti in Los Angeles, CA on civfix">')
    }
  })

  it("leaves a live entity on the production origin indexable", async () => {
    const id = "8f14e45f-ceea-467a-9b2e-9a1f0d7c1b22"
    for (const host of ["civfix.org", "www.civfix.org", "civfix-web.pages.dev"]) {
      vi.stubGlobal("caches", { default: makeCache() })
      const h = harness({ url: `https://${host}/pin/${id}` })
      const html = await (await runPreview(h.context, "report", { rewrite: h.rewrite })).text()
      expect(html).not.toContain("robots")
      expect(html).toContain('<meta property="og:title" content="Graffiti in Los Angeles, CA on civfix">')
    }
  })

  it("falls back to the branded default head when the upstream body is not JSON", async () => {
    const h = harness({ upstream: async () => new Response("<html>nope", { status: 200 }) })
    const response = await runPreview(h.context, "report", { rewrite: h.rewrite })
    const html = await response.text()
    expect(html).toContain('<meta property="og:title" content="civfix">')
    expect(html).toContain(
      '<meta property="og:url" content="https://civfix.org/pin/8f14e45f-ceea-467a-9b2e-9a1f0d7c1b22">',
    )
    expect(html).toContain(
      '<link rel="canonical" href="https://civfix.org/pin/8f14e45f-ceea-467a-9b2e-9a1f0d7c1b22">',
    )
  })

  it("keeps the branded default head on the request origin when the entity is gone", async () => {
    for (const status of [403, 404, 410]) {
      vi.stubGlobal("caches", { default: makeCache() })
      const h = harness({
        url: "https://civfix.dev/cleanups/8f14e45f-ceea-467a-9b2e-9a1f0d7c1b22",
        upstream: async () => new Response("", { status }),
      })
      const html = await (await runPreview(h.context, "event", { rewrite: h.rewrite })).text()
      expect(html).toContain('<meta property="og:title" content="civfix">')
      expect(html).toContain('<meta property="og:site_name" content="civfix">')
      expect(html).toContain('<meta property="og:type" content="website">')
      expect(html).toContain('<meta property="og:image" content="https://civfix.dev/og.png">')
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
      expect(html).toContain("<title>civfix</title>")
      expect(html).toContain(
        '<link rel="canonical" href="https://civfix.dev/cleanups/8f14e45f-ceea-467a-9b2e-9a1f0d7c1b22">',
      )
      expect(html).not.toContain("civfix.org")
    }
  })

  it("rewrites a hit and still serves the shared must-revalidate cache-control", async () => {
    const h = harness()
    const response = await runPreview(h.context, "report", { rewrite: h.rewrite })
    expect(h.rewrite).toHaveBeenCalledTimes(1)
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate")
    const html = await response.text()
    expect(html).toContain('<meta property="og:title" content="Graffiti in Los Angeles, CA on civfix">')
  })
})

describe("canonical url", () => {
  it("comes from the serving origin and the DTO id", () => {
    const preview = buildPreview("report", REPORT_PAYLOAD, "route-fallback-id", "https://civfix.dev")
    expect(preview?.url).toBe("https://civfix.dev/pin/8f14e45f-ceea-467a-9b2e-9a1f0d7c1b22")
    expect(metaTagsHtml(preview!)).toContain(
      '<link rel="canonical" href="https://civfix.dev/pin/8f14e45f-ceea-467a-9b2e-9a1f0d7c1b22">',
    )
  })

  it("falls back to the validated route id when the payload id is unusable", () => {
    const origin = "https://civfix.org"
    expect(buildPreview("report", { ...REPORT_PAYLOAD, id: "../evil" }, "safe-id", origin)?.url).toBe(
      "https://civfix.org/pin/safe-id",
    )
    expect(buildPreview("report", { ...REPORT_PAYLOAD, id: 7 }, "safe-id", origin)?.url).toBe(
      "https://civfix.org/pin/safe-id",
    )
  })

  it("reads the person id out of the profile envelope", () => {
    const preview = buildPreview(
      "person",
      { profile: { id: "5b2d7e1c-3f4a-4b6c-8d9e-0a1b2c3d4e5f", name: "Ada Rivera", handle: "ada" } },
      "route-id",
      "https://civfix.org",
    )
    expect(preview?.url).toBe("https://civfix.org/people/5b2d7e1c-3f4a-4b6c-8d9e-0a1b2c3d4e5f")
  })
})

describe("preview head on the staging host", () => {
  const EVENT_PAYLOAD = {
    id: "3c1e0b6a-7b5f-4a41-9d2e-0f7a1c3b5d90",
    title: "Ballona Creek cleanup",
    scheduledAt: "2026-09-12T17:00:00.000Z",
    status: "upcoming",
    description: "Bring gloves. Ask for Dana at 12 Elm St, apt 5.",
    address: "9 Secret Ln",
  }

  async function renderEvent(url: string): Promise<{ html: string; response: Response }> {
    vi.stubGlobal("caches", { default: makeCache() })
    const h = harness({
      url,
      path: [EVENT_PAYLOAD.id],
      upstream: async () => new Response(JSON.stringify(EVENT_PAYLOAD), { status: 200 }),
    })
    const response = await runPreview(h.context, "event", { rewrite: h.rewrite })
    return { html: await response.text(), response }
  }

  it("emits every tag iMessage, WhatsApp, Slack, Telegram and LinkedIn read, on the request origin", async () => {
    const { html, response } = await renderEvent(
      `https://civfix.dev/cleanups/${EVENT_PAYLOAD.id}`,
    )
    const description = "Sat, Sep 12, 10:00 AM PDT · Bring gloves. Ask for Dana at 12 Elm St, apt 5."
    const title = "Ballona Creek cleanup on civfix"

    expect(response.headers.get("Content-Type")).toBe(HTML_CONTENT_TYPE)
    for (const tag of [
      `<title>${title}</title>`,
      `<meta name="description" content="${description}">`,
      '<meta property="og:site_name" content="civfix">',
      '<meta property="og:type" content="article">',
      '<meta property="og:locale" content="en_US">',
      `<meta property="og:url" content="https://civfix.dev/cleanups/${EVENT_PAYLOAD.id}">`,
      `<meta property="og:title" content="${title}">`,
      `<meta property="og:description" content="${description}">`,
      '<meta property="og:image" content="https://civfix.dev/og.png">',
      '<meta property="og:image:secure_url" content="https://civfix.dev/og.png">',
      '<meta property="og:image:type" content="image/png">',
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      `<meta property="og:image:alt" content="${title}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${title}">`,
      `<meta name="twitter:description" content="${description}">`,
      '<meta name="twitter:image" content="https://civfix.dev/og.png">',
      `<meta name="twitter:image:alt" content="${title}">`,
      `<link rel="canonical" href="https://civfix.dev/cleanups/${EVENT_PAYLOAD.id}">`,
      '<link rel="icon" href="https://civfix.dev/favicon.svg" type="image/svg+xml">',
      '<link rel="apple-touch-icon" href="https://civfix.dev/apple-touch-icon.png" sizes="180x180">',
    ]) {
      expect(html).toContain(tag)
    }
    expect(html).not.toContain("civfix.org")
  })

  it("carries the host's description but never the address field", async () => {
    const { html } = await renderEvent(`https://civfix.dev/cleanups/${EVENT_PAYLOAD.id}`)
    expect(html).toContain("gloves")
    expect(html).not.toContain("Secret Ln")
  })

  it("takes the origin from the served host only, never from a client-supplied header", async () => {
    const spoofed = harness({
      url: `https://civfix.dev/cleanups/${EVENT_PAYLOAD.id}`,
      path: [EVENT_PAYLOAD.id],
      upstream: async () => new Response(JSON.stringify(EVENT_PAYLOAD), { status: 200 }),
    })
    spoofed.context.request.headers.set("x-forwarded-host", "evil.example")
    spoofed.context.request.headers.set("x-forwarded-proto", "http")
    const spoofedHtml = await (
      await runPreview(spoofed.context, "event", { rewrite: spoofed.rewrite })
    ).text()
    expect(spoofedHtml).toContain('<meta property="og:url" content="https://civfix.dev/cleanups/')
    expect(spoofedHtml).not.toContain("evil.example")

    const { html } = await renderEvent(`https://evil.example/cleanups/${EVENT_PAYLOAD.id}`)
    expect(html).toContain(
      `<meta property="og:url" content="https://civfix.org/cleanups/${EVENT_PAYLOAD.id}">`,
    )
    expect(html).toContain('<meta property="og:image" content="https://civfix.org/og.png">')
    expect(html).not.toContain("evil.example")
  })
})

describe("head links the rewriter owns", () => {
  it("replaces the shell's canonical and icon links and leaves the rest alone", () => {
    for (const rel of ["canonical", "icon", "apple-touch-icon"]) {
      expect(isManagedLink(rel)).toBe(true)
    }
    for (const rel of ["stylesheet", "preload", "manifest"]) {
      expect(isManagedLink(rel)).toBe(false)
    }
  })
})

const SIGNUP_PAYLOAD = {
  slug: "beach-cleanup-may",
  status: "published",
  visibility: "public",
  noindex: false,
  coverUrl: "https://media.civfix.org/pages/cover.jpg",
  seo: { title: null, description: null, noindex: false },
  event: {
    id: "evt_1",
    title: "Beach cleanup at Dockweiler",
    startsAt: "2026-05-10T17:00:00.000Z",
    status: "upcoming",
    address: "Dockweiler State Beach",
  },
  organization: { id: "org_1", slug: "reach-out-la", name: "Reach Out LA", verified: true },
}

function signupHarness(payload: unknown, slug = "beach-cleanup-may"): Harness {
  return harness({
    url: `https://civfix.org/e/${slug}`,
    path: [slug],
    upstream: async () => new Response(JSON.stringify(payload), { status: 200 }),
  })
}

describe("signup page previews (/e/:slug)", () => {
  it("reads the page from the public page endpoint, keyed on the slug", async () => {
    const h = signupHarness(SIGNUP_PAYLOAD)
    await runPreview(h.context, "signup", { rewrite: h.rewrite })
    expect(h.assets.mock.calls[0]?.[0]?.toString()).toContain("/e/_/")
    expect(h.fetchSpy.mock.calls[0]?.[0]?.url).toBe(
      "https://api.civfix.org/v1/pages/beach-cleanup-may",
    )
  })

  it("canonicalizes to /e/<slug>, not to the shell", () => {
    const preview = buildPreview("signup", SIGNUP_PAYLOAD, "beach-cleanup-may", "https://civfix.org")
    expect(preview?.url).toBe("https://civfix.org/e/beach-cleanup-may")
  })

  it("uses the cover image only when the page is public", () => {
    const publicPreview = buildPreview("signup", SIGNUP_PAYLOAD, "s", "https://civfix.org")
    expect(publicPreview?.image).toBe("https://media.civfix.org/pages/cover.jpg")
    expect(publicPreview?.imageIsBrand).toBe(false)

    const unlisted = buildPreview(
      "signup",
      { ...SIGNUP_PAYLOAD, visibility: "unlisted" },
      "s",
      "https://civfix.org",
    )
    expect(unlisted?.image).toBe("https://civfix.org/og.png")
    expect(unlisted?.imageIsBrand).toBe(true)
    expect(unlisted?.noindex).toBe(true)
  })

  it("refuses a presigned cover, because an og:image is cached and mirrored forever", () => {
    const signed = buildPreview(
      "signup",
      { ...SIGNUP_PAYLOAD, coverUrl: "https://media.civfix.org/pages/cover.jpg?X-Amz-Signature=abc" },
      "s",
      "https://civfix.org",
    )
    expect(signed?.image).toBe("https://civfix.org/og.png")
    expect(signed?.imageIsBrand).toBe(true)
  })

  it("noindexes an unlisted or private page while keeping the link shareable", () => {
    for (const visibility of ["unlisted", "private"]) {
      const preview = buildPreview(
        "signup",
        { ...SIGNUP_PAYLOAD, visibility },
        "s",
        "https://civfix.org",
      )
      expect(preview?.noindex).toBe(true)
      expect(preview?.title).toBe("Beach cleanup at Dockweiler")
    }
  })

  it("honors the host's own noindex flag on an otherwise public page", () => {
    expect(
      buildPreview("signup", { ...SIGNUP_PAYLOAD, noindex: true }, "s", "https://civfix.org")
        ?.noindex,
    ).toBe(true)
    expect(
      buildPreview(
        "signup",
        { ...SIGNUP_PAYLOAD, seo: { noindex: true } },
        "s",
        "https://civfix.org",
      )?.noindex,
    ).toBe(true)
  })

  it("prefers the host's SEO title and description over the event's", () => {
    const preview = buildPreview(
      "signup",
      { ...SIGNUP_PAYLOAD, seo: { title: "Come clean the beach", description: "Gloves provided." } },
      "s",
      "https://civfix.org",
    )
    expect(preview?.title).toBe("Come clean the beach")
    expect(preview?.description).toBe("Gloves provided.")
  })

  it("says a cancelled event is cancelled in the card itself", () => {
    const preview = buildPreview(
      "signup",
      { ...SIGNUP_PAYLOAD, event: { ...SIGNUP_PAYLOAD.event, status: "cancelled" } },
      "s",
      "https://civfix.org",
    )
    expect(preview?.description).toContain("Cancelled")
  })

  it("falls back to the branded default when the page has no title at all", () => {
    expect(buildPreview("signup", { ...SIGNUP_PAYLOAD, event: null, seo: null }, "s", "https://civfix.org")).toBe(
      null,
    )
  })

  it("serves the branded default and noindexes when the API is unreachable", async () => {
    const h = harness({
      url: "https://civfix.org/e/beach-cleanup-may",
      path: ["beach-cleanup-may"],
      upstream: async () => new Response("", { status: 503 }),
    })
    await runPreview(h.context, "signup", { rewrite: h.rewrite })
    const preview = h.rewrite.mock.calls[0]?.[1] as LinkPreview
    expect(preview.title).toBe("civfix")
    expect(preview.imageIsBrand).toBe(true)
  })

  it("serves the placeholder shell for a bare /e/ visit rather than a 404", async () => {
    const h = harness({ url: "https://civfix.org/e/", path: [] })
    const response = await runPreview(h.context, "signup", { rewrite: h.rewrite })
    expect(response.status).toBe(200)
    expect(h.assets.mock.calls[0]?.[0]?.toString()).toContain("/e/_/")
    expect(h.rewrite).not.toHaveBeenCalled()
  })
})

const POST_ID = "0c9a4f3e-2b1d-4e6f-9a8b-7c6d5e4f3a2b"
const POST_PAYLOAD = {
  id: POST_ID,
  kind: "post",
  body: "Cleared the storm drain on Venice Blvd this morning.",
  author: { id: "a1", name: "Ada Rivera", handle: "ada", email: "ada@example.com" },
  organization: null,
  media: [
    {
      id: "m1",
      kind: "image",
      status: "ready",
      url: "https://cdn.civfix.dev/media/m1.jpg",
      thumbUrl: "https://cdn.civfix.dev/media/m1_thumb.jpg",
      width: 3024,
      height: 4032,
    },
  ],
  viewer: { liked: true, reposted: false, saved: true },
}

function postHarness(options: { path?: string[]; upstream?: () => Promise<Response> } = {}): Harness {
  return harness({
    url: `https://civfix.dev/post/${POST_ID}`,
    path: options.path ?? [POST_ID],
    upstream: options.upstream ?? (async () => new Response(JSON.stringify(POST_PAYLOAD), { status: 200 })),
  })
}

describe("post previews (/post/:id)", () => {
  it("reads the post from /v1/posts/<id> and serves the /post/_/ shell", async () => {
    const h = harness({
      url: `https://civfix.org/post/${POST_ID}`,
      path: [POST_ID],
      upstream: async () => new Response(JSON.stringify(POST_PAYLOAD), { status: 200 }),
    })
    await runPreview(h.context, "post", { rewrite: h.rewrite })
    expect(String(h.assets.mock.calls[0]?.[0])).toBe("https://civfix.org/post/_/")
    expect(h.fetchSpy.mock.calls[0]?.[0]?.url).toBe(`https://api.civfix.org/v1/posts/${POST_ID}`)
  })

  it("canonicalizes to /post/<id> from the DTO", () => {
    const preview = buildPreview("post", POST_PAYLOAD, "route-id", "https://civfix.org")
    expect(preview?.url).toBe(`https://civfix.org/post/${POST_ID}`)
  })

  it("emits the author byline, body, first image and article type on the staging origin", async () => {
    const h = postHarness()
    const html = await (await runPreview(h.context, "post", { rewrite: h.rewrite })).text()
    const title = "Ada Rivera (@ada) on civfix"
    const body = POST_PAYLOAD.body
    const thumb = "https://cdn.civfix.dev/media/m1_thumb.jpg"
    for (const tag of [
      `<title>${title}</title>`,
      '<meta name="robots" content="noindex">',
      `<meta name="description" content="${body}">`,
      '<meta property="og:type" content="article">',
      `<meta property="og:url" content="https://civfix.dev/post/${POST_ID}">`,
      `<meta property="og:title" content="${title}">`,
      `<meta property="og:description" content="${body}">`,
      `<meta property="og:image" content="${thumb}">`,
      `<meta property="og:image:secure_url" content="${thumb}">`,
      `<meta property="og:image:alt" content="${title}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${title}">`,
      `<meta name="twitter:description" content="${body}">`,
      `<meta name="twitter:image" content="${thumb}">`,
      `<link rel="canonical" href="https://civfix.dev/post/${POST_ID}">`,
    ]) {
      expect(html).toContain(tag)
    }
    expect(html).not.toContain("og:image:width")
    expect(html).not.toContain("ada@example.com")
  })

  it("serves the branded default, noindexed, when the API answers 404 — a hidden post is indistinguishable from a missing one", async () => {
    const h = harness({
      url: `https://civfix.org/post/${POST_ID}`,
      path: [POST_ID],
      upstream: async () => new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404 }),
    })
    const html = await (await runPreview(h.context, "post", { rewrite: h.rewrite })).text()
    expect(html).toContain('<meta property="og:title" content="civfix">')
    expect(html).toContain('<meta name="robots" content="noindex">')
    expect(html).toContain(`<link rel="canonical" href="https://civfix.org/post/${POST_ID}">`)
  })

  it("leaves /post/<id>/thread as the SPA shell and rejects a non-uuid id before any upstream call", async () => {
    for (const path of [[POST_ID, "thread"], ["GR-12-000001"], ["ada"], [POST_ID.toUpperCase()]]) {
      const h = postHarness({ path })
      const response = await runPreview(h.context, "post", { rewrite: h.rewrite })
      expect(h.fetchSpy).not.toHaveBeenCalled()
      expect(h.rewrite).not.toHaveBeenCalled()
      expect(await response.text()).toBe(SHELL_HTML)
    }
  })
})
