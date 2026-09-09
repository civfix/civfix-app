import { test } from "node:test"
import assert from "node:assert/strict"
import {
  ALLOWED_LINK_PREFIXES,
  isExternalUrl,
  isInternalLink,
  toInternalHref,
  toResumeHref,
} from "./links.ts"

test("accepts a whole-route prefix exactly", () => {
  assert.equal(isInternalLink("/reports"), true)
  assert.equal(isInternalLink("/notifications"), true)
  assert.equal(isInternalLink("/settings"), true)
})

test("accepts a whole-route prefix followed by a segment boundary", () => {
  assert.equal(isInternalLink("/reports/abc"), true)
  assert.equal(isInternalLink("/reports?tab=mine"), true)
  assert.equal(isInternalLink("/notifications#top"), true)
})

test("rejects a sibling route that merely shares the prefix text", () => {
  assert.equal(isInternalLink("/reportsfoo"), false)
  assert.equal(isInternalLink("/notificationsevil"), false)
  assert.equal(isInternalLink("/settingsevil"), false)
})

test("accepts trailing-slash prefixes whatever the segment is", () => {
  assert.equal(isInternalLink("/people/jane_doe"), true)
  assert.equal(isInternalLink("/people/9f1c0f6e-0000-4000-8000-000000000000"), true)
  assert.equal(isInternalLink("/pin/abc"), true)
})

test("accepts a leaderboard link whatever the geoid segment is", () => {
  assert.equal(isInternalLink("/leaderboard/0644000"), true)
  assert.equal(isInternalLink("/leaderboard/06"), true)
  assert.equal(isInternalLink("/leaderboard/06037"), true)
  assert.equal(toInternalHref("/leaderboard/0644000"), "/leaderboard/0644000")
})

test("rejects a bare /leaderboard and a sibling that shares its prefix text", () => {
  assert.equal(isInternalLink("/leaderboard"), false)
  assert.equal(isInternalLink("/leaderboards/evil"), false)
})

test("does not allowlist the certificate path", () => {
  assert.equal(isInternalLink("/service-record/ABCD1234EFGH"), false)
  assert.equal(
    ALLOWED_LINK_PREFIXES.some((p) => p.startsWith("/service-record")),
    false,
  )
})

test("accepts every child of the settings hub", () => {
  for (const child of ["account", "privacy", "blocked", "language"]) {
    assert.equal(isInternalLink(`/settings/${child}`), true)
  }
  assert.equal(isInternalLink("/settings?from=profile"), true)
})

test("rejects external, protocol-relative and unknown targets", () => {
  assert.equal(isInternalLink("https://evil.example/reports"), false)
  assert.equal(isInternalLink("//evil.example"), false)
  assert.equal(isInternalLink("https://evil.example/settings"), false)
})

test("toInternalHref narrows only validated strings", () => {
  assert.equal(toInternalHref("/reports/abc"), "/reports/abc")
  assert.equal(toInternalHref("/reportsfoo"), null)
  assert.equal(toInternalHref(42), null)
  assert.equal(toInternalHref(undefined), null)
})

test("a resume target keeps every REAL in-app route the sign-in gate hands it", () => {
  assert.equal(toResumeHref("/"), "/")
  assert.equal(toResumeHref("/messages"), "/messages")
  assert.equal(toResumeHref("/profile"), "/profile")
  assert.equal(toResumeHref("/host"), "/host")
  assert.equal(toResumeHref("/notifications/prefs"), "/notifications/prefs")
  assert.equal(toResumeHref("/settings"), "/settings")
  assert.equal(toResumeHref("/settings/account"), "/settings/account")
  assert.equal(toResumeHref("/settings/privacy"), "/settings/privacy")
  assert.equal(toResumeHref("/pin/9f1c0f6e-0000-4000-8000-000000000000"), "/pin/9f1c0f6e-0000-4000-8000-000000000000")
  assert.equal(toResumeHref("/reports?tab=mine"), "/reports?tab=mine")
})

test("a deep-linked resume target can never leave the app", () => {
  assert.equal(toResumeHref("https://evil.example/steal"), null)
  assert.equal(toResumeHref("//evil.example"), null)
  assert.equal(toResumeHref("javascript:alert(1)"), null)
  assert.equal(toResumeHref("civfix://pin/abc"), null)
  assert.equal(toResumeHref("/\\evil.example"), null)
  assert.equal(toResumeHref("relative/path"), null)
  assert.equal(toResumeHref(""), null)
  assert.equal(toResumeHref(" /reports"), null)
  assert.equal(toResumeHref(42), null)
  assert.equal(toResumeHref(undefined), null)
})

test("openExternal targets must be real https URLs", () => {
  assert.equal(isExternalUrl("https://civfix.org/legal/terms"), true)
  assert.equal(isExternalUrl("https://cal.com/romanaytur/meet-with-roman"), true)
  assert.equal(isExternalUrl("https://media.civfix.org:8443/cert.pdf?sig=abc"), true)
  assert.equal(isExternalUrl("https://civfix.org"), true)
})

test("no scheme other than https ever reaches Linking.openURL", () => {
  assert.equal(isExternalUrl("javascript:alert(1)"), false)
  assert.equal(isExternalUrl("JavaScript:alert(1)"), false)
  assert.equal(isExternalUrl("civfix://pin/abc"), false)
  assert.equal(isExternalUrl("http://civfix.org"), false)
  assert.equal(isExternalUrl("file:///etc/passwd"), false)
  assert.equal(isExternalUrl("itms-apps://apps.apple.com/app/id1"), false)
  assert.equal(isExternalUrl("data:text/html,<script>1</script>"), false)
})

test("malformed authorities and host-spoofing shapes are rejected", () => {
  assert.equal(isExternalUrl("https://"), false)
  assert.equal(isExternalUrl("https:/civfix.org"), false)
  assert.equal(isExternalUrl("https://civfix.org@evil.example/"), false)
  assert.equal(isExternalUrl("https://\\evil.example"), false)
  assert.equal(isExternalUrl("https://localhost"), false)
  assert.equal(isExternalUrl(" https://civfix.org"), false)
})

test("a non-string target is never opened", () => {
  assert.equal(isExternalUrl(undefined), false)
  assert.equal(isExternalUrl(null), false)
  assert.equal(isExternalUrl(42), false)
})

test("an organization page and the donation history are push-link targets", () => {
  assert.equal(isInternalLink("/orgs/acme"), true)
  assert.equal(isInternalLink("/orgs/acme?tab=events"), true)
  assert.equal(isInternalLink("/orgs"), false)
  assert.equal(isInternalLink("/orgsomething"), false)
  assert.equal(isInternalLink("/me/donations"), true)
  assert.equal(isInternalLink("/me/donations?cursor=x"), true)
  assert.equal(isInternalLink("/me"), false)
  assert.equal(isInternalLink("/me/donationsomething"), false)
})

test("the host console and the donate page are never push-link targets", () => {
  assert.equal(isInternalLink("/manage/events/e1"), false)
  assert.equal(isInternalLink("/donate/acme"), false)
  assert.equal(isInternalLink("/unsubscribe"), false)
})

test("every host surface of an event stays inside the cleanups prefix", () => {
  assert.equal(isInternalLink("/cleanups/c1/host"), true)
  assert.equal(isInternalLink("/cleanups/c1/checkin"), true)
  assert.equal(isInternalLink("/cleanups/c1/ticket/s1"), true)
})
