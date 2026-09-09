import { test } from "node:test"
import assert from "node:assert/strict"
import {
  MAX_ICS_CHARS,
  calendarDocumentWritable,
  calendarFileName,
  calendarShareSupported,
} from "./calendarFile.ts"

test("the server's filename is kept when it is already safe", () => {
  assert.equal(calendarFileName("civfix-event-abc.ics"), "civfix-event-abc.ics")
})

test("a filename can never escape the cache directory or carry a path", () => {
  assert.equal(calendarFileName("../../etc/passwd"), "passwd.ics")
  assert.equal(calendarFileName("a/b/c.ics"), "c.ics")
  assert.equal(calendarFileName(".hidden"), "hidden.ics")
  assert.equal(calendarFileName(""), "civfix-event.ics")
})

test("a name always ends in .ics, INCLUDING one long enough to be truncated", () => {
  assert.equal(calendarFileName("event"), "event.ics")
  assert.equal(calendarFileName("event.ICS"), "event.ICS")
  const longNoExt = calendarFileName("x".repeat(400))
  const longWithExt = calendarFileName(`${"x".repeat(400)}.ics`)
  for (const name of [longNoExt, longWithExt]) {
    assert.ok(name.toLowerCase().endsWith(".ics"), name.slice(-8))
    assert.ok(name.length <= 120, String(name.length))
  }
})

test("weird characters are replaced rather than written to disk", () => {
  assert.equal(calendarFileName('e"v;e nt.ics'), "e-v-e-nt.ics")
})

test("only iOS claims a file share sheet: Android needs expo-sharing, which is not installed", () => {
  assert.equal(calendarShareSupported("ios"), true)
  assert.equal(calendarShareSupported("android"), false)
  assert.equal(calendarShareSupported("web"), false)
})

test("an empty or implausibly large document is refused before anything is written", () => {
  assert.equal(calendarDocumentWritable(""), false)
  assert.equal(calendarDocumentWritable("x".repeat(MAX_ICS_CHARS + 1)), false)
  assert.equal(calendarDocumentWritable("BEGIN:VCALENDAR"), true)
  assert.equal(calendarDocumentWritable("x".repeat(MAX_ICS_CHARS)), true)
})
