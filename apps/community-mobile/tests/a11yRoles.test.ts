import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

test("the wordmark is one focusable header, not six letters", () => {
  const wordmark = read("../src/components/Wordmark.tsx")
  const row = wordmark.slice(wordmark.indexOf("<View"), wordmark.indexOf(">", wordmark.indexOf("<View")))
  assert.match(row, /\baccessible\b/)
  assert.match(row, /accessibilityRole="header"/)
  assert.match(row, /accessibilityLabel=\{t\("a11y\.brand_logo"\)\}/)
})

test("screen titles are exposed as headers", () => {
  const routeHeader = read("../src/components/ui/RouteHeader.tsx")
  assert.match(routeHeader, /<Text accessibilityRole="header" style=\{styles\.title\}>\s*\{title\}/)

  const groupInfo = read("../app/groups/[id]/info.tsx")
  assert.match(groupInfo, /<RouteHeader title=\{t\("title\.group_info"\)\}/)

  const members = read("../app/messages/members/[roomKind]/[id].tsx")
  assert.match(members, /<RouteHeader\s+title=\{t\(roomKind/)

  const header = read("../src/components/ui/ScreenHeader.tsx")
  const title = header.slice(header.indexOf("{title ? ("), header.indexOf("{title}"))
  assert.match(title, /accessibilityRole="header"/)
})

test("the welcome options appear without the spring when the user asked for reduced motion", () => {
  const gate = read("../src/components/AuthGate.tsx")
  assert.match(gate, /const reduceMotion = useReducedMotion\(\) === true/)
  assert.match(
    gate,
    /if \(!revealed\) return\s*fall\.value = reduceMotion \? 1 : withSpring\(1, [^)]+\)\s*\}, \[revealed, reduceMotion, fall\]\)/,
  )
})
