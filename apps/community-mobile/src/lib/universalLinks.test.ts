import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveIncomingPath } from "./universalLinks.ts"

const internal = (path: string) => ({ type: "internal", path }) as const
const external = (url: string) => ({ type: "external", url }) as const
const home = { type: "home" } as const

test("a shared https link keeps its query and loses its trailing slash", () => {
  assert.deepEqual(resolveIncomingPath("https://civfix.org/cleanups/abc/"), internal("/cleanups/abc"))
  assert.deepEqual(
    resolveIncomingPath("https://civfix.org/reports/?tab=mine"),
    internal("/reports?tab=mine"),
  )
  assert.deepEqual(
    resolveIncomingPath("https://civfix.org/pin/abc/?from=share#top"),
    internal("/pin/abc?from=share"),
  )
})

test("the www host is the same app", () => {
  assert.deepEqual(resolveIncomingPath("https://www.civfix.org/people/jane/"), internal("/people/jane"))
  assert.deepEqual(resolveIncomingPath("https://WWW.CIVFIX.ORG/messages/"), internal("/messages"))
})

test("host matching survives casing and an explicit default port", () => {
  assert.deepEqual(resolveIncomingPath("https://CivFix.ORG/pin/abc"), internal("/pin/abc"))
  assert.deepEqual(resolveIncomingPath("https://civfix.org:443/pin/abc"), internal("/pin/abc"))
  assert.deepEqual(resolveIncomingPath("https://WWW.CIVFIX.ORG:443/pin/abc"), internal("/pin/abc"))
  assert.deepEqual(resolveIncomingPath("https://civfix.org:8443/pin/abc"), home)
})

test("a foreign or spoofed host never routes into the app", () => {
  assert.deepEqual(resolveIncomingPath("https://evil.example/pin/abc"), home)
  assert.deepEqual(resolveIncomingPath("https://civfix.org.evil.example/pin/abc"), home)
  assert.deepEqual(resolveIncomingPath("https://civfix.org@evil.example/pin/abc"), home)
  assert.deepEqual(resolveIncomingPath("http://civfix.org/pin/abc"), home)
  assert.deepEqual(resolveIncomingPath("//civfix.org/pin/abc"), home)
})

test("the map-home is the target for the site root", () => {
  assert.deepEqual(resolveIncomingPath("https://civfix.org/"), home)
  assert.deepEqual(resolveIncomingPath("https://civfix.org"), home)
  assert.deepEqual(resolveIncomingPath("/"), home)
})

test("/events is the web alias of the events list", () => {
  assert.deepEqual(resolveIncomingPath("https://civfix.org/events/"), internal("/cleanups"))
  assert.deepEqual(resolveIncomingPath("/events/abc"), internal("/cleanups/abc"))
})

test("/host is the web name of the mobile host-event screen", () => {
  assert.deepEqual(resolveIncomingPath("https://civfix.org/host/"), internal("/host-event"))
  assert.deepEqual(resolveIncomingPath("/host-event"), internal("/host-event"))
})

test("a web report permalink is a mobile pin", () => {
  assert.deepEqual(resolveIncomingPath("https://civfix.org/reports/abc/"), internal("/pin/abc"))
  assert.deepEqual(resolveIncomingPath("/reports"), internal("/reports"))
  assert.deepEqual(resolveIncomingPath("/pin/abc"), internal("/pin/abc"))
})

test("followers and following fall back to the profile that owns them", () => {
  assert.deepEqual(resolveIncomingPath("https://civfix.org/people/jane/followers/"), internal("/people/jane"))
  assert.deepEqual(resolveIncomingPath("/people/jane/following"), internal("/people/jane"))
  assert.deepEqual(resolveIncomingPath("/people"), internal("/people"))
  assert.deepEqual(resolveIncomingPath("/people/jane"), internal("/people/jane"))
})

test("pinned messages fall back to the room they belong to", () => {
  assert.deepEqual(resolveIncomingPath("/messages/pins/dm/abc"), internal("/messages/dm/abc"))
  assert.deepEqual(resolveIncomingPath("/messages/pins/report/abc"), internal("/messages/report/abc"))
  assert.deepEqual(resolveIncomingPath("/messages/pins/group/abc"), internal("/messages/group/abc"))
  assert.deepEqual(resolveIncomingPath("/messages/pins/cleanup/abc"), internal("/messages/abc"))
  assert.deepEqual(resolveIncomingPath("/messages/pins/bogus/abc"), internal("/messages"))
})

test("every real message room keeps its own route", () => {
  assert.deepEqual(resolveIncomingPath("/messages/dm/abc"), internal("/messages/dm/abc"))
  assert.deepEqual(resolveIncomingPath("/messages/group/abc/"), internal("/messages/group/abc"))
  assert.deepEqual(resolveIncomingPath("/messages/report/abc"), internal("/messages/report/abc"))
  assert.deepEqual(resolveIncomingPath("/messages/abc"), internal("/messages/abc"))
  assert.deepEqual(
    resolveIncomingPath("/messages/members/group/abc"),
    internal("/messages/members/group/abc"),
  )
})

test("a post thread permalink lands on the mobile thread screen", () => {
  assert.deepEqual(resolveIncomingPath("https://civfix.org/post/abc/thread/"), internal("/post/abc"))
  assert.deepEqual(resolveIncomingPath("/post/abc"), internal("/post/abc"))
})

test("composer and chat-creation entry points fall back to a real surface", () => {
  assert.deepEqual(resolveIncomingPath("/compose/quote/abc"), internal("/compose"))
  assert.deepEqual(resolveIncomingPath("/compose"), internal("/compose"))
  assert.deepEqual(resolveIncomingPath("/groups/new"), internal("/messages"))
  assert.deepEqual(resolveIncomingPath("/channels/new"), internal("/messages"))
  assert.deepEqual(resolveIncomingPath("/groups/abc/info"), internal("/groups/abc/info"))
})

test("the saved-posts and settings surfaces are addressable", () => {
  assert.deepEqual(resolveIncomingPath("https://civfix.org/saves/"), internal("/saves"))
  assert.deepEqual(resolveIncomingPath("/settings"), internal("/settings"))
  assert.deepEqual(resolveIncomingPath("/settings/privacy"), internal("/settings/privacy"))
  assert.deepEqual(resolveIncomingPath("/settings/nope"), home)
  assert.deepEqual(resolveIncomingPath("/notifications/prefs"), internal("/notifications/prefs"))
  assert.deepEqual(resolveIncomingPath("/leaderboard/0644000"), internal("/leaderboard/0644000"))
})

test("browser-only pages open in the browser with their original URL", () => {
  for (const path of ["/guest", "/claim", "/service-record/ABC123", "/legal/terms", "/.well-known/x"]) {
    assert.deepEqual(resolveIncomingPath(`https://civfix.org${path}/`), external(`https://civfix.org${path}/`))
  }
  assert.deepEqual(
    resolveIncomingPath("https://www.civfix.org/legal/privacy/?lang=es"),
    external("https://www.civfix.org/legal/privacy/?lang=es"),
  )
})

test("a browser-only bare path is rebuilt against the web origin", () => {
  assert.deepEqual(resolveIncomingPath("/legal/terms"), external("https://civfix.org/legal/terms"))
  assert.deepEqual(
    resolveIncomingPath("/service-record/ABC123?print=1"),
    external("https://civfix.org/service-record/ABC123?print=1"),
  )
})

test("the dev harness routes stay in the browser", () => {
  assert.deepEqual(resolveIncomingPath("/landscape"), external("https://civfix.org/landscape"))
  assert.deepEqual(resolveIncomingPath("/skeleton"), external("https://civfix.org/skeleton"))
  assert.deepEqual(resolveIncomingPath("/bodies"), external("https://civfix.org/bodies"))
})

test("a scheme link gets the SAME alias table as a web link", () => {
  assert.deepEqual(resolveIncomingPath("civfix://reports/abc/"), internal("/pin/abc"))
  assert.deepEqual(resolveIncomingPath("civfix://events"), internal("/cleanups"))
  assert.deepEqual(resolveIncomingPath("civfix://host"), internal("/host-event"))
  assert.deepEqual(resolveIncomingPath("civfix://post/abc/thread"), internal("/post/abc"))
  assert.deepEqual(resolveIncomingPath("civfix://people/jane/followers"), internal("/people/jane"))
  assert.deepEqual(resolveIncomingPath("civfix://messages/pins/dm/abc"), internal("/messages/dm/abc"))
  assert.deepEqual(resolveIncomingPath("civfix://compose/quote/abc"), internal("/compose"))
})

test("both scheme URL shapes yield the same path", () => {
  assert.deepEqual(resolveIncomingPath("civfix://cleanups/abc"), internal("/cleanups/abc"))
  assert.deepEqual(resolveIncomingPath("civfix:///cleanups/abc"), internal("/cleanups/abc"))
  assert.deepEqual(resolveIncomingPath("civfix://cleanups/abc/"), internal("/cleanups/abc"))
  assert.deepEqual(resolveIncomingPath("CIVFIX://pin/abc"), internal("/pin/abc"))
  assert.deepEqual(resolveIncomingPath("civfix://reports/abc/?from=push"), internal("/pin/abc?from=push"))
})

test("a scheme link to the app root is the map-home", () => {
  assert.deepEqual(resolveIncomingPath("civfix://"), home)
  assert.deepEqual(resolveIncomingPath("civfix:///"), home)
})

test("a browser-only root reached over a scheme goes home, never to a browser", () => {
  for (const root of ["guest", "claim", "legal/terms", "service-record/ABC123", "landscape"]) {
    assert.deepEqual(resolveIncomingPath(`civfix://${root}`), home)
  }
})

test("the dev-client launcher URL is never rewritten", () => {
  const launcher = "exp+civfix-community://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
  assert.deepEqual(resolveIncomingPath(launcher), internal(launcher))
  assert.deepEqual(
    resolveIncomingPath("civfix://expo-development-client/?url=http%3A%2F%2F192.168.1.5%3A8081"),
    internal("civfix://expo-development-client/?url=http%3A%2F%2F192.168.1.5%3A8081"),
  )
})

test("an unrecognized scheme path stays verbatim so auth and dev URLs keep working", () => {
  assert.deepEqual(resolveIncomingPath("exp://127.0.0.1:8081"), internal("exp://127.0.0.1:8081"))
  assert.deepEqual(
    resolveIncomingPath("org.civfix.community://oauth?code=abc"),
    internal("org.civfix.community://oauth?code=abc"),
  )
})

test("the scheme allowlist is exact, not a prefix match", () => {
  assert.deepEqual(resolveIncomingPath("express://civfix.org/pin/abc"), home)
  assert.deepEqual(resolveIncomingPath("exploit://pin/abc"), home)
  assert.deepEqual(resolveIncomingPath("expo://pin/abc"), home)
  assert.deepEqual(resolveIncomingPath("civfixevil://pin/abc"), home)
  assert.deepEqual(resolveIncomingPath("exp+other-app://pin/abc"), home)
})

test("no other scheme is ever handed back to the router", () => {
  assert.deepEqual(resolveIncomingPath("javascript:alert(1)"), home)
  assert.deepEqual(resolveIncomingPath("file:///etc/passwd"), home)
  assert.deepEqual(resolveIncomingPath("data:text/html,<script>1</script>"), home)
  assert.deepEqual(resolveIncomingPath("itms-apps://apps.apple.com/app/id1"), home)
})

test("garbage and unknown paths go home instead of nowhere", () => {
  assert.deepEqual(resolveIncomingPath(""), home)
  assert.deepEqual(resolveIncomingPath("relative/path"), home)
  assert.deepEqual(resolveIncomingPath("/definitely-not-a-route"), home)
  assert.deepEqual(resolveIncomingPath("/pin"), home)
  assert.deepEqual(resolveIncomingPath("/verify"), home)
  assert.deepEqual(resolveIncomingPath("https://civfix.org/nope/nope/nope"), home)
  assert.deepEqual(resolveIncomingPath(undefined), home)
  assert.deepEqual(resolveIncomingPath(null), home)
  assert.deepEqual(resolveIncomingPath(42), home)
})

test("the host console, the donate flow and unsubscribe belong to the browser, not the app", () => {
  for (const path of ["/manage", "/manage/events/e1", "/donate/acme", "/unsubscribe"]) {
    assert.deepEqual(
      resolveIncomingPath(`https://civfix.org${path}`),
      external(`https://civfix.org${path}`),
    )
  }
  assert.deepEqual(resolveIncomingPath("/manage/events/e1"), external("https://civfix.org/manage/events/e1"))
  assert.deepEqual(resolveIncomingPath("civfix://manage/events/e1"), home)
})

test("an event's host surfaces each keep their own in-app route", () => {
  assert.deepEqual(resolveIncomingPath("https://civfix.org/cleanups/c1/host"), internal("/cleanups/c1/host"))
  assert.deepEqual(
    resolveIncomingPath("https://civfix.org/cleanups/c1/checkin"),
    internal("/cleanups/c1/checkin"),
  )
  assert.deepEqual(resolveIncomingPath("https://civfix.org/cleanups/c1/edit"), internal("/cleanups/c1/edit"))
  assert.deepEqual(resolveIncomingPath("https://civfix.org/cleanups/c1/nope"), internal("/cleanups/c1"))
})

test("a ticket link keeps its seat as a PATH segment, the only form entryFromPath reads", () => {
  assert.deepEqual(resolveIncomingPath("https://civfix.org/cleanups/c1/ticket"), internal("/cleanups/c1/ticket"))
  assert.deepEqual(
    resolveIncomingPath("https://civfix.org/cleanups/c1/ticket/s2"),
    internal("/cleanups/c1/ticket/s2"),
  )
  assert.deepEqual(
    resolveIncomingPath("https://civfix.org/cleanups/c1/ticket/s2?from=email"),
    internal("/cleanups/c1/ticket/s2?from=email"),
  )
})

test("a shared signup page opens the event it belongs to, in the app's own route", () => {
  assert.deepEqual(resolveIncomingPath("https://civfix.org/e/beach-day"), internal("/cleanups/beach-day"))
  assert.deepEqual(resolveIncomingPath("civfix://e/beach-day"), internal("/cleanups/beach-day"))
  assert.deepEqual(resolveIncomingPath("https://civfix.org/e"), home)
})

test("an organization page and the donation history are addressable", () => {
  assert.deepEqual(resolveIncomingPath("https://civfix.org/orgs/acme"), internal("/orgs/acme"))
  assert.deepEqual(resolveIncomingPath("https://civfix.org/orgs"), home)
  assert.deepEqual(resolveIncomingPath("https://civfix.org/me/donations"), internal("/me/donations"))
  assert.deepEqual(resolveIncomingPath("https://civfix.org/me"), home)
  assert.deepEqual(resolveIncomingPath("https://civfix.org/me/anything-else"), home)
})
