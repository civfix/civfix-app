import assert from "node:assert/strict"
import { test } from "node:test"
import { hrefFromRoute, resumePathname, shouldReplaceOnSignIn } from "./authResume.ts"
import { toResumeHref } from "./links.ts"

test("the resume pathname drops the query, the hash and a trailing slash", () => {
  assert.equal(resumePathname("/"), "/")
  assert.equal(resumePathname("/pin/abc"), "/pin/abc")
  assert.equal(resumePathname("/pin/abc?focus=1"), "/pin/abc")
  assert.equal(resumePathname("/pin/abc#chat"), "/pin/abc")
  assert.equal(resumePathname("/pin/abc/"), "/pin/abc")
  assert.equal(resumePathname("/settings/?tab=a"), "/settings")
})

test("signing in on the route we are already on never remounts it", () => {
  assert.equal(shouldReplaceOnSignIn("/", "/"), false)
  assert.equal(shouldReplaceOnSignIn("/", "/?ref=push"), false)
  assert.equal(shouldReplaceOnSignIn("/pin/abc", "/pin/abc"), false)
  assert.equal(shouldReplaceOnSignIn("/pin/abc", "/pin/abc?focus=1"), false)
})

test("the sign-in screen still hands off to the resume target", () => {
  assert.equal(shouldReplaceOnSignIn("/auth", "/"), true)
  assert.equal(shouldReplaceOnSignIn("/auth", "/pin/abc"), true)
  assert.equal(shouldReplaceOnSignIn("/", "/cleanups/xyz"), true)
})

test("an unknown current route always replaces", () => {
  assert.equal(shouldReplaceOnSignIn(null, "/"), true)
  assert.equal(shouldReplaceOnSignIn(undefined, "/"), true)
  assert.equal(shouldReplaceOnSignIn("", "/"), true)
  assert.equal(shouldReplaceOnSignIn("/", { pathname: "/" }), true)
})

test("the resume target is the route the tour is standing on, home included", () => {
  assert.equal(hrefFromRoute("/", {}), "/")
  assert.equal(hrefFromRoute("/pin/abc", {}), "/pin/abc")
  assert.equal(hrefFromRoute("/cleanups/xyz", {}), "/cleanups/xyz")
})

test("a deep link keeps its query so the tour resumes on the same screen state", () => {
  assert.equal(hrefFromRoute("/pin/abc", { id: "abc" }), "/pin/abc?id=abc")
  assert.equal(
    hrefFromRoute("/messages/abc", { id: "abc", roomKind: "dm" }),
    "/messages/abc?id=abc&roomKind=dm",
  )
  assert.equal(hrefFromRoute("/people/abc", { q: "a b&c" }), "/people/abc?q=a+b%26c")
  assert.equal(hrefFromRoute("/reports", { tag: ["a", "b"] }), "/reports?tag=a&tag=b")
})

test("a star in a param is percent-encoded so the resume href survives the allowlist", () => {
  assert.equal(hrefFromRoute("/people/abc", { q: "a*b" }), "/people/abc?q=a%2Ab")
  assert.equal(hrefFromRoute("/reports", { tag: ["*", "b*"] }), "/reports?tag=%2A&tag=b%2A")
  assert.equal(toResumeHref(hrefFromRoute("/people/abc", { q: "a*b" })), "/people/abc?q=a%2Ab")
  assert.equal(resumePathname(hrefFromRoute("/people/abc", { q: "a*b" })), "/people/abc")
})

test("params that are not plain strings never leak into the resume href", () => {
  assert.equal(hrefFromRoute("/pin/abc", undefined), "/pin/abc")
  assert.equal(hrefFromRoute("/pin/abc", null), "/pin/abc")
  assert.equal(hrefFromRoute("/pin/abc", { n: 3, ok: undefined, tag: [1, "b"] }), "/pin/abc?tag=b")
})

test("an unusable pathname falls back to the home route, never to a protocol-relative one", () => {
  assert.equal(hrefFromRoute(undefined, {}), "/")
  assert.equal(hrefFromRoute("", {}), "/")
  assert.equal(hrefFromRoute("//evil.example", {}), "/")
  assert.equal(hrefFromRoute("https://evil.example", {}), "/")
})

test("signing in on a deep-linked route derives a next that does not remount it", () => {
  const href = hrefFromRoute("/pin/abc", { id: "abc" })
  assert.equal(shouldReplaceOnSignIn("/pin/abc", href), false)
  assert.equal(resumePathname(href), "/pin/abc")
  assert.equal(shouldReplaceOnSignIn("/", hrefFromRoute("/", {})), false)
})
