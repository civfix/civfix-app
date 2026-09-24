import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { resolveIncomingPath, type IncomingLink } from "./universalLinks.ts"
import { isExternalUrl, isInternalLink, toInternalHref, toResumeHref } from "./links.ts"
import { loadNavRoutes } from "../../tests/helpers/navRoutes.ts"

const WEB_ORIGIN = "https://civfix.org"

const internal = (path: string): IncomingLink => ({ type: "internal", path })
const external = (url: string): IncomingLink => ({ type: "external", url })
const home: IncomingLink = { type: "home" }

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "app")

function routeFileIn(dir: string, parts: readonly string[]): string | null {
  const [head, ...rest] = parts
  if (head === undefined) return existsSync(join(dir, "index.tsx")) ? join(dir, "index.tsx") : null
  const dynamic = readdirSync(dir)
    .map((name) => name.replace(/\.tsx$/, ""))
    .filter((name) => /^\[[^\]]+\]$/.test(name))
  for (const name of [head, ...new Set(dynamic)]) {
    const file = join(dir, `${name}.tsx`)
    if (rest.length === 0 && existsSync(file)) return file
    const sub = join(dir, name)
    if (existsSync(sub) && statSync(sub).isDirectory()) {
      const found = routeFileIn(sub, rest)
      if (found) return found
    }
  }
  return null
}

function routeFileFor(path: string): string | null {
  const pathname = path.split(/[?#]/)[0] ?? ""
  const found = routeFileIn(APP_DIR, pathname.split("/").filter((part) => part !== ""))
  return found ? relative(APP_DIR, found) : null
}

function forms(path: string): string[] {
  const bare = path.replace(/^\//, "")
  return [`${WEB_ORIGIN}${path}`, path, `civfix://${bare}`, `civfix:${bare}`]
}

const RECOGNISED: readonly (readonly [string, string])[] = [
  ["/map", "/map"],
  ["/search", "/search"],
  ["/about", "/about"],
  ["/profile", "/profile"],
  ["/dashboard", "/dashboard"],
  ["/discover", "/discover"],
  ["/saves", "/saves"],
  ["/report", "/report"],
  ["/compose", "/compose"],
  ["/compose/quote/p1", "/compose"],
  ["/host", "/host-event"],
  ["/host-event", "/host-event"],
  ["/events", "/cleanups"],
  ["/events/e1", "/cleanups/e1"],
  ["/events/e1/anything", "/cleanups/e1"],
  ["/e/beach-day", "/cleanups/beach-day"],
  ["/e/beach-day/anything", "/cleanups/beach-day"],
  ["/orgs/acme", "/orgs/acme"],
  ["/orgs/acme/manage", "/orgs/acme/manage"],
  ["/host/analytics", "/host/analytics"],
  ["/cleanups", "/cleanups"],
  ["/cleanups/c1", "/cleanups/c1"],
  ["/cleanups/c1/edit", "/cleanups/c1/edit"],
  ["/cleanups/c1/host", "/cleanups/c1/host"],
  ["/cleanups/c1/checkin", "/cleanups/c1/checkin"],
  ["/cleanups/c1/team", "/cleanups/c1/team"],
  ["/cleanups/c1/hours", "/cleanups/c1/hours"],
  ["/cleanups/c1/ticket", "/cleanups/c1/ticket"],
  ["/cleanups/c1/ticket/s1", "/cleanups/c1/ticket/s1"],
  ["/cleanups/c1/ticket/s1/anything", "/cleanups/c1/ticket/s1"],
  ["/cleanups/c1/announcements", "/cleanups/c1/announcements"],
  ["/cleanups/c1/announcements/a1", "/cleanups/c1/announcements/a1"],
  ["/cleanups/c1/analytics", "/cleanups/c1/analytics"],
  ["/cleanups/c1/attendees", "/cleanups/c1"],
  ["/cleanups/c1/announce", "/cleanups/c1"],
  ["/reports", "/reports"],
  ["/reports/r1", "/pin/r1"],
  ["/reports/r1/anything", "/pin/r1"],
  ["/pin/p1", "/pin/p1"],
  ["/people", "/people"],
  ["/people/u1", "/people/u1"],
  ["/people/u1/followers", "/people/u1"],
  ["/people/u1/following", "/people/u1"],
  ["/leaderboard/0644000", "/leaderboard/0644000"],
  ["/post/p1", "/post/p1"],
  ["/post/p1/thread", "/post/p1"],
  ["/notifications", "/notifications"],
  ["/notifications/prefs", "/notifications/prefs"],
  ["/settings", "/settings"],
  ["/settings/account", "/settings/account"],
  ["/settings/privacy", "/settings/privacy"],
  ["/settings/blocked", "/settings/blocked"],
  ["/settings/language", "/settings/language"],
  ["/settings/appearance", "/settings/appearance"],
  ["/groups/new", "/messages"],
  ["/groups/g1/info", "/groups/g1/info"],
  ["/channels/new", "/messages"],
  ["/messages", "/messages"],
  ["/messages/abc", "/messages/abc"],
  ["/messages/dm", "/messages"],
  ["/messages/dm/d1", "/messages/dm/d1"],
  ["/messages/report/r1", "/messages/report/r1"],
  ["/messages/group/g1", "/messages/group/g1"],
  ["/messages/members", "/messages"],
  ["/messages/members/dm/d1", "/messages/members/dm/d1"],
  ["/messages/members/cleanup/c1", "/messages/members/cleanup/c1"],
  ["/messages/members/bogus/d1", "/messages"],
  ["/messages/pins/dm/d1", "/messages/dm/d1"],
  ["/messages/pins/report/r1", "/messages/report/r1"],
  ["/messages/pins/group/g1", "/messages/group/g1"],
  ["/messages/pins/cleanup/c1", "/messages/c1"],
  ["/messages/pins/bogus/x", "/messages"],
  ["/cleanups/c1?teamInvite=tok&from=share", "/cleanups/c1?from=share"],
  ["/pin/p1?teamInvite=tok", "/pin/p1"],
  ["/pin/p1?team%49nvite=tok", "/pin/p1"],
  ["/pin/p1?team+Invite=tok", "/pin/p1"],
  ["/pin/p1?a=1&&b=2", "/pin/p1"],
  ["/pin/p1#comments", "/pin/p1"],
  ["/pin/p1?x=%zz", "/pin/p1"],
  ["/reports?tab=saved&x=1", "/reports?tab=saved"],
  ["/pin//p1//", "/pin/p1"],
]

for (const [path, expected] of RECOGNISED) {
  test(`${path} opens ${expected} whether it arrives as a web link, a bare path or either scheme shape`, () => {
    for (const raw of forms(path)) {
      assert.deepEqual(resolveIncomingPath(raw), internal(expected), raw)
    }
  })
}

test("every in-app path a recognised link resolves to has an expo-router route file", () => {
  for (const [, expected] of RECOGNISED) {
    assert.notEqual(routeFileFor(expected), null, expected)
  }
})

const UNROUTED: readonly string[] = [
  "/map/x",
  "/profile/x",
  "/dashboard/x",
  "/report/camera",
  "/e",
  "/orgs",
  "/pin",
  "/leaderboard",
  "/post",
  "/notifications/x",
  "/settings/x",
  "/groups",
  "/groups/g1",
  "/channels",
  "/channels/x",
  "/messages/abc/x",
  "/messages/cleanup/c1",
  "/auth",
  "/auth/otp",
  "/scan",
  "/me",
  "/definitely-not-a-route",
  "/landscape",
  "/skeleton",
  "/bodies",
]

for (const path of UNROUTED) {
  test(`${path} goes home whether it arrives as a web link, a bare path or either scheme shape`, () => {
    for (const raw of forms(path)) {
      assert.deepEqual(resolveIncomingPath(raw), home, raw)
    }
  })
}

const BROWSER_ONLY: readonly string[] = [
  "/guest",
  "/claim?code=ABC123",
  "/service-record/x",
  "/legal/privacy",
  "/.well-known/apple-app-site-association",
  "/manage/events/e1",
  "/unsubscribe?t=tok",
]

for (const path of BROWSER_ONLY) {
  test(`${path} opens in the browser from the web and goes home from a scheme`, () => {
    const bare = path.replace(/^\//, "")
    assert.deepEqual(resolveIncomingPath(`${WEB_ORIGIN}${path}`), external(`${WEB_ORIGIN}${path}`))
    assert.deepEqual(resolveIncomingPath(path), external(`${WEB_ORIGIN}${path}`))
    assert.deepEqual(resolveIncomingPath(`civfix://${bare}`), home)
    assert.deepEqual(resolveIncomingPath(`civfix:${bare}`), home)
  })
}

test("a browser-only web link keeps its exact original URL, host, query, hash and dot segments included", () => {
  for (const raw of [
    "https://www.civfix.org/legal/privacy?x=1#y",
    "https://civfix.org/legal/privacy/../../pin/p1",
    "https://CIVFIX.org:443/unsubscribe?t=1",
  ]) {
    assert.deepEqual(resolveIncomingPath(raw), external(raw))
  }
  assert.deepEqual(
    resolveIncomingPath("/legal/privacy#section"),
    external("https://civfix.org/legal/privacy"),
  )
})

test("the site and scheme roots are the map-home", () => {
  for (const raw of [
    "https://civfix.org",
    "https://civfix.org/",
    "https://civfix.org?x=1",
    "https://civfix.org#x",
    "/",
    "civfix://",
    "civfix:",
    "civfix:///",
  ]) {
    assert.deepEqual(resolveIncomingPath(raw), home, raw)
  }
})

test("a scheme link outside the route table goes home, whatever query or hash it carries", () => {
  for (const raw of [
    "civfix://auth/otp?email=a@b.c&next=/pin/x",
    "civfix://auth?next=/pin/x",
    "civfix://auth/otp?email=a@b.c&teamInvite=t#x",
    "civfix://unknown/deep/path?teamInvite=t&x=1",
    "civfix://scan?session=s",
    "civfix://report/camera?captureId=c",
  ]) {
    assert.deepEqual(resolveIncomingPath(raw), home, raw)
  }
  assert.deepEqual(resolveIncomingPath("civfix://settings/appearance"), internal("/settings/appearance"))
})

test("a link hands the compose route none of the composer's reply parameters", () => {
  for (const raw of [
    "https://civfix.org/compose?mode=reply&targetPostId=p",
    "civfix://compose?mode=reply&targetPostId=p",
  ]) {
    assert.deepEqual(resolveIncomingPath(raw), internal("/compose"))
  }
})

test("a link keeps a message room's kind but drops caller-supplied peer identity", () => {
  for (const raw of [
    "https://civfix.org/messages/abc?roomKind=dm&peerName=X&peerId=Y",
    "civfix://messages/abc?roomKind=dm&peerName=X&peerId=Y",
  ]) {
    assert.deepEqual(resolveIncomingPath(raw), internal("/messages/abc?roomKind=dm"))
  }
})

test("a link drops a resume target instead of passing it through as a query parameter", () => {
  assert.deepEqual(resolveIncomingPath("https://civfix.org/pin/p1?next=https://evil.com"), internal("/pin/p1"))
  assert.deepEqual(resolveIncomingPath("civfix://pin/p1?next=//evil.com"), internal("/pin/p1"))
})

test("currently keeps encoded traversal and encoded slashes inside an id segment", () => {
  for (const [id, expected] of [
    ["..%2Fauth", "/pin/..%2Fauth"],
    ["%2e%2e", "/pin/%2e%2e"],
    ["a%2Fb", "/pin/a%2Fb"],
    ["p%20q", "/pin/p%20q"],
  ] as const) {
    assert.deepEqual(resolveIncomingPath(`https://civfix.org/pin/${id}`), internal(expected))
    assert.deepEqual(resolveIncomingPath(`civfix://pin/${id}`), internal(expected))
  }
})

test("currently takes a literal .. as the id and drops the segments after it", () => {
  assert.deepEqual(resolveIncomingPath("https://civfix.org/pin/../auth"), internal("/pin/.."))
  assert.deepEqual(resolveIncomingPath("civfix://pin/../auth"), internal("/pin/.."))
})

test("currently keeps the first id segment and drops any extra segments after a single-id route", () => {
  assert.deepEqual(resolveIncomingPath("civfix://pin/a/b"), internal("/pin/a"))
  assert.deepEqual(resolveIncomingPath("https://civfix.org/pin/a/b"), internal("/pin/a"))
})

test("a scheme link whose root is encoded traversal goes home", () => {
  for (const raw of ["civfix://..%2F..%2Fauth", "civfix://%2e%2e/auth"]) {
    assert.deepEqual(resolveIncomingPath(raw), home, raw)
  }
})

test("the dev-client launcher and the exp scheme reach the router verbatim in a dev build only", () => {
  for (const raw of [
    "civfix://expo-development-client/?url=http://x",
    "exp+civfix-community://expo-development-client/?url=x",
    "exp://192.168.1.2:8081/--/pin/p1",
  ]) {
    assert.deepEqual(resolveIncomingPath(raw, { isDev: true }), internal(raw), raw)
    assert.deepEqual(resolveIncomingPath(raw), home, raw)
  }
})

test("the bundle-id scheme and a capitalised civfix scheme share the civfix table", () => {
  assert.deepEqual(resolveIncomingPath("org.civfix.community://pin/p1"), internal("/pin/p1"))
  assert.deepEqual(resolveIncomingPath("CIVFIX://pin/p1"), internal("/pin/p1"))
  assert.deepEqual(resolveIncomingPath("civfix:///pin/p1"), internal("/pin/p1"))
})

test("a foreign host, a lookalike host, userinfo, a backslash or a non-https web scheme never routes in", () => {
  for (const raw of [
    "http://civfix.org/pin/p1",
    "https://evil.com/pin/p1",
    "https://civfix.org.evil.com/pin/p1",
    "https://evil.com@civfix.org/pin/p1",
    "https://civfix.org@evil.com/pin/p1",
    "https://user:pw@civfix.org/pin/p1",
    "https://civfix.org\\@evil.com/pin/p1",
    "https://civfix.org:80/pin/p1",
    "https://civfix.dev/pin/p1",
    "civfixx://pin/p1",
    "javascript:alert(1)",
    "JavaScript://%0aalert(1)",
    "data:text/html,x",
    "//evil.com/pin/p1",
    "pin/p1",
    "  /pin/p1",
  ]) {
    assert.deepEqual(resolveIncomingPath(raw), home, raw)
  }
})

test("empty segments collapse on a web or scheme link, but a bare path starting with // is protocol-relative and goes home", () => {
  assert.deepEqual(resolveIncomingPath("https://civfix.org//pin//p1//"), internal("/pin/p1"))
  assert.deepEqual(resolveIncomingPath("civfix:////pin//p1"), internal("/pin/p1"))
  assert.deepEqual(resolveIncomingPath("//pin//p1//"), home)
})

test("an uppercase path root is not recognised", () => {
  assert.deepEqual(resolveIncomingPath("https://civfix.org/PIN/p1"), home)
  assert.deepEqual(resolveIncomingPath("civfix://PIN/p1"), home)
})

test("a non-string link is the map-home", () => {
  for (const raw of [null, undefined, 42, {}, ["/pin/p1"], true]) {
    assert.deepEqual(resolveIncomingPath(raw), home)
  }
})

const { pathForEntry } = await loadNavRoutes<{ pathForEntry: (entry: unknown) => string }>()

const ROUND_TRIP: readonly (readonly [Record<string, unknown>, IncomingLink])[] = [
  [{ kind: "view", view: "map" }, internal("/map")],
  [{ kind: "view", view: "search" }, internal("/search")],
  [{ kind: "view", view: "report" }, internal("/report")],
  [{ kind: "pin", id: "r1" }, internal("/pin/r1")],
  [{ kind: "cleanups" }, internal("/cleanups")],
  [{ kind: "cleanup", id: "c1" }, internal("/cleanups/c1")],
  [{ kind: "edit-cleanup", id: "c1" }, internal("/cleanups/c1/edit")],
  [{ kind: "host-mode", id: "c1" }, internal("/cleanups/c1/host")],
  [{ kind: "host-checkin", id: "c1" }, internal("/cleanups/c1/checkin")],
  [{ kind: "host-announce", id: "c1" }, internal("/cleanups/c1")],
  [{ kind: "host-team", id: "c1" }, internal("/cleanups/c1/team")],
  [{ kind: "host-log-hours", id: "c1" }, internal("/cleanups/c1/hours")],
  [{ kind: "my-ticket", id: "c1" }, internal("/cleanups/c1/ticket")],
  [{ kind: "my-ticket", id: "c1", seatId: "s1" }, internal("/cleanups/c1/ticket/s1")],
  [{ kind: "org", slug: "acme" }, internal("/orgs/acme")],
  [{ kind: "create-cleanup" }, internal("/host-event")],
  [{ kind: "people" }, internal("/people")],
  [{ kind: "person", id: "u1" }, internal("/people/u1")],
  [{ kind: "followers", id: "u1" }, internal("/people/u1")],
  [{ kind: "following", id: "u1" }, internal("/people/u1")],
  [{ kind: "leaderboard", geoid: "06" }, internal("/leaderboard/06")],
  [{ kind: "messages" }, internal("/messages")],
  [{ kind: "thread", id: "d1", roomKind: "dm" }, internal("/messages/dm/d1")],
  [{ kind: "thread", id: "r1", roomKind: "report" }, internal("/messages/report/r1")],
  [{ kind: "thread", id: "g1", roomKind: "group" }, internal("/messages/group/g1")],
  [{ kind: "thread", id: "c1", roomKind: "cleanup" }, internal("/messages/c1")],
  [{ kind: "pinned-messages", id: "d1", roomKind: "dm" }, internal("/messages/dm/d1")],
  [{ kind: "pinned-messages", id: "c1" }, internal("/messages/c1")],
  [{ kind: "members", id: "g1", roomKind: "group" }, internal("/messages/members/group/g1")],
  [{ kind: "members", id: "c1" }, internal("/messages/members/cleanup/c1")],
  [{ kind: "myreports" }, internal("/reports")],
  [{ kind: "activity" }, internal("/notifications")],
  [{ kind: "notification-prefs" }, internal("/notifications/prefs")],
  [{ kind: "profile" }, internal("/profile")],
  [{ kind: "settings" }, internal("/settings")],
  [{ kind: "settings-account" }, internal("/settings/account")],
  [{ kind: "settings-privacy" }, internal("/settings/privacy")],
  [{ kind: "blocked" }, internal("/settings/blocked")],
  [{ kind: "language-settings" }, internal("/settings/language")],
  [{ kind: "event-dashboard" }, internal("/dashboard")],
  [{ kind: "new-group" }, internal("/messages")],
  [{ kind: "new-channel" }, internal("/messages")],
  [{ kind: "group-info", id: "g1" }, internal("/groups/g1/info")],
  [{ kind: "new-msg" }, internal("/messages")],
  [{ kind: "post", id: "p1" }, internal("/post/p1")],
  [{ kind: "post-thread", id: "p1" }, internal("/post/p1")],
  [{ kind: "composer" }, internal("/compose")],
  [{ kind: "composer", composerMode: "quote", targetPostId: "p1" }, internal("/compose")],
  [{ kind: "saves" }, internal("/saves")],
  [{ kind: "drop-pin" }, internal("/map")],
  [{ kind: "announcements", id: "c1" }, internal("/cleanups/c1/announcements")],
  [{ kind: "announcement", id: "c1", announcementId: "a1" }, internal("/cleanups/c1/announcements/a1")],
  [{ kind: "event-analytics", id: "c1" }, internal("/cleanups/c1/analytics")],
  [{ kind: "host-analytics" }, internal("/host/analytics")],
  [{ kind: "org-manage", slug: "acme" }, internal("/orgs/acme/manage")],
  [{ kind: "appearance-settings" }, internal("/settings/appearance")],
]

for (const [entry, expected] of ROUND_TRIP) {
  test(`a shared ${String(entry.kind)} link round-trips from the web URL into a real app route`, () => {
    const link = resolveIncomingPath(`${WEB_ORIGIN}${pathForEntry(entry)}`)
    assert.deepEqual(link, expected)
    if (link.type === "internal") assert.notEqual(routeFileFor(link.path), null, link.path)
  })
}

const PUSH_LINKS: readonly (readonly [string, boolean])[] = [
  ["/", true],
  ["/pin/", true],
  ["/pin/p1", true],
  ["/pin/a?x=1", true],
  ["/pin/p1#x", true],
  ["/cleanups/c1/announcements/a1", true],
  ["/orgs/acme/manage", true],
  ["/people/u1", true],
  ["/post/p1", true],
  ["/leaderboard/06", true],
  ["/reports", true],
  ["/settings#x", true],
  ["/settings?x", true],
  ["/settings/appearance", true],
  ["/notifications/prefs", true],
  ["/reportsx", false],
  ["/auth/otp?email=a", false],
  ["/scan?session=s", false],
  ["/report/camera", false],
  ["/compose?mode=reply", false],
  ["/map", false],
  ["/search", false],
  ["/e/slug", false],
  ["/events/e1", false],
  ["/groups/g1/info", false],
  ["/PIN/p1", false],
  ["//evil.com", false],
  ["/\\evil.com", false],
  ["https://civfix.org/pin/p1", false],
  ["civfix://pin/p1", false],
  ["javascript:alert(1)", false],
  ["", false],
  ["/ ", false],
  [" /pin/p1", false],
]

for (const [link, allowed] of PUSH_LINKS) {
  test(`a push link ${JSON.stringify(link)} is ${allowed ? "accepted" : "refused"}`, () => {
    assert.equal(isInternalLink(link), allowed)
    assert.equal(toInternalHref(link), allowed ? link : null)
  })
}

test("currently accepts push links carrying dot segments, encoded traversal or a trailing newline", () => {
  for (const link of [
    "/pin/../auth",
    "/pin/..%2Fauth",
    "/reports/../auth",
    "/settings/../auth",
    "/notifications/../../auth",
    "/pin/p1\n",
  ]) {
    assert.equal(isInternalLink(link), true, JSON.stringify(link))
    assert.equal(toInternalHref(link), link)
  }
})

test("currently accepts caller-supplied peer identity in a message push link", () => {
  assert.equal(toInternalHref("/messages/abc?roomKind=dm&peerName=X"), "/messages/abc?roomKind=dm&peerName=X")
})

const RESUME_TARGETS: readonly (readonly [string, boolean])[] = [
  ["/", true],
  ["/pin/p1", true],
  ["/reportsx", true],
  ["/auth/otp?email=a", true],
  ["/scan?session=s", true],
  ["/report/camera", true],
  ["/compose?mode=reply", true],
  ["/PIN/p1", true],
  ["/messages/abc?roomKind=dm&peerName=X", true],
  ["/pin/p1#x", true],
  ["//evil.com", false],
  ["/\\evil.com", false],
  ["https://civfix.org/pin/p1", false],
  ["civfix://pin/p1", false],
  ["javascript:alert(1)", false],
  ["/pin/p1\n", false],
  ["", false],
  ["/ ", false],
  [" /pin/p1", false],
]

for (const [target, allowed] of RESUME_TARGETS) {
  test(`a sign-in resume target ${JSON.stringify(target)} is ${allowed ? "kept" : "dropped"}`, () => {
    assert.equal(toResumeHref(target), allowed ? target : null)
  })
}

test("currently keeps a sign-in resume target that climbs out with dot segments", () => {
  for (const target of ["/pin/../auth", "/reports/../auth", "/notifications/../../auth", "/pin/..%2Fauth"]) {
    assert.equal(toResumeHref(target), target)
  }
})

test("a non-string push link, resume target or external url is refused", () => {
  for (const value of [null, undefined, 1, {}, ["/pin/p1"]]) {
    assert.equal(toInternalHref(value), null)
    assert.equal(toResumeHref(value), null)
    assert.equal(isExternalUrl(value), false)
  }
})

const EXTERNAL_URLS: readonly (readonly [string, boolean])[] = [
  ["https://civfix.org", true],
  ["https://civfix.org/", true],
  ["https://a.b/c?d#e", true],
  ["https://a.b:8443/x", true],
  ["HTTPS://A.B", true],
  ["https://192.168.0.1", true],
  ["https://xn--80ak6aa92e.com", true],
  ["https://a.b#", true],
  ["https://a.b?", true],
  ["https://a.b/../x", true],
  ["https://a.b:123456/x", false],
  ["http://a.b", false],
  ["https://localhost", false],
  ["https://a..b", false],
  ["https://-a.b", false],
  ["https://a-.b", false],
  ["https://a_b.com", false],
  ["https://user@a.b", false],
  ["https://a.b@evil.com", false],
  ["https://evil.com\\@a.b", false],
  ["https://a.b\n", false],
  ["javascript:alert(1)", false],
]

for (const [url, allowed] of EXTERNAL_URLS) {
  test(`an external url ${JSON.stringify(url)} is ${allowed ? "opened" : "refused"}`, () => {
    assert.equal(isExternalUrl(url), allowed)
  })
}

test("currently accepts an external url whose path carries a newline after a valid authority", () => {
  assert.equal(isExternalUrl("https://a.b/\njavascript:"), true)
})
