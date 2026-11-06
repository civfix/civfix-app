import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import { installModuleStubs } from "./helpers/moduleHooks.ts"
import { defined } from "./helpers/defined.ts"

const STUBS = new URL("./helpers/calendarShareStubs.ts", import.meta.url)

installModuleStubs({
  "react-native": STUBS,
  "expo-file-system": STUBS,
  // Metro resolves the extensionless sibling; Node needs the file.
  "./calendarFile": new URL("../src/lib/calendarFile.ts", import.meta.url),
})

const { control, events, files, resetCalendarStubs, shared } =
  await import("./helpers/calendarShareStubs.ts")
const { nativeCalendarFile } = await import("../src/lib/nativeCalendarFile.ts")

const ICS = "BEGIN:VCALENDAR\nEND:VCALENDAR\n"
const capability = defined(nativeCalendarFile, "the iOS calendar capability")

beforeEach(resetCalendarStubs)

test("T1: a write that rejects resolves false, shares nothing and deletes the file", async () => {
  control.write = () => Promise.reject(new Error("disk full"))

  const saved = await capability.save({ filename: "cleanup.ics", ics: ICS })

  assert.equal(saved, false)
  assert.equal(shared.length, 0)
  const file = defined(files[0], "the calendar file")
  assert.ok(events.includes("delete"))
  assert.equal(file.exists, false)
})

test("T2: the share starts only once the write has settled", async () => {
  control.write = () =>
    new Promise((resolve) => {
      setImmediate(resolve)
    })

  const saved = await capability.save({ filename: "cleanup.ics", ics: ICS })

  assert.equal(saved, true)
  const file = defined(files[0], "the calendar file")
  assert.deepEqual(shared, [{ url: file.uri }])
  assert.deepEqual(events, ["create", "write", "write settled", "share", "delete"])
})

test("T3: a dismissed share resolves false and still deletes the file", async () => {
  control.share = () => Promise.reject(new Error("dismissed"))

  const saved = await capability.save({ filename: "cleanup.ics", ics: ICS })

  assert.equal(saved, false)
  assert.ok(events.includes("delete"))
  assert.equal(defined(files[0], "the calendar file").exists, false)
})

test("T4: an empty document resolves false without touching the file system", async () => {
  const saved = await capability.save({ filename: "cleanup.ics", ics: "" })

  assert.equal(saved, false)
  assert.equal(files.length, 0)
  assert.equal(events.includes("write"), false)
})
