/**
 * API versioning model: the single source of truth for the version->wire-path mapping.
 *
 * Every endpoint declares a `version`; the wire path is computed centrally by `versionedPath` so the
 * typed client and the backend route helper derive identical paths by construction. Versioned
 * endpoints are served under a `/<version>` URL prefix (today only `/v1`); a small set of endpoints
 * are deliberately `"unversioned"` (e.g. `/healthz`, the web-redirect OAuth start/callback routes).
 */

export type ApiVersion = "v1"
export type EndpointVersion = ApiVersion | "unversioned"

/** The ONE place version->path lives; the backend route() helper imports this too. */
export function versionedPath(ep: { version: EndpointVersion; path: string }): string {
  return ep.version === "unversioned" ? ep.path : `/${ep.version}${ep.path}`
}
