import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"

const source = readFileSync(
  new URL("../src/lib/nativeGeolocation.ts", import.meta.url),
  "utf8",
)

function memberBody(header: string): string {
  const start = source.indexOf(header)
  assert.ok(start > -1, `missing member: ${header}`)
  const open = source.indexOf("{", start + header.length - 1)
  assert.ok(open > -1, `missing body: ${header}`)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1
    else if (source[i] === "}") {
      depth -= 1
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  throw new Error(`unbalanced body: ${header}`)
}

const REQUEST = "requestForegroundPermissionsAsync"
const CHECK = "getForegroundPermissionsAsync"

test("a passive position read only CHECKS the permission - it never prompts", () => {
  const body = memberBody("async getCurrentPosition()")
  assert.doesNotMatch(body, new RegExp(REQUEST))
  assert.match(body, /foregroundPermissionGranted\(\)/)
  assert.match(body, /throw new Error\("location permission denied"\)/)
})

test("the watch only CHECKS too, and stays inactive when the permission is not granted", () => {
  const body = memberBody("watchPosition(onChange")
  assert.doesNotMatch(body, new RegExp(REQUEST))
  assert.match(body, /if \(!\(await foregroundPermissionGranted\(\)\) \|\| cancelled\) return/)
})

test("only the explicit requestPermission action raises the OS dialog", () => {
  const body = memberBody("async requestPermission()")
  assert.match(body, new RegExp(`Location\\.${REQUEST}\\(\\)`))
  assert.match(body, /return status === Location\.PermissionStatus\.GRANTED/)
  assert.equal(source.split(REQUEST).length - 1, 1)
})

test("the permission check itself is the prompt-free expo call", () => {
  const helper = memberBody("async function foregroundPermissionGranted()")
  assert.match(helper, new RegExp(`Location\\.${CHECK}\\(\\)`))
  assert.doesNotMatch(helper, new RegExp(REQUEST))
})
