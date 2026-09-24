import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const ws = read("../src/lib/ws.ts")
const compose = read("../app/compose.tsx")
const nativeIntent = read("../app/+native-intent.tsx")

function openNativeSocketBody(): string {
  const start = ws.indexOf("function openNativeSocket(")
  assert.ok(start > -1, "ws.ts no longer defines openNativeSocket")
  const end = ws.indexOf("\n}\n", start)
  assert.ok(end > start)
  return ws.slice(start, end)
}

test("the native socket opens only through the ticket transport, so the bearer never rides in the URL", () => {
  assert.match(ws, /import \{ openTicketedSocket \} from "@\/lib\/wsTransport"/)
  const body = openNativeSocketBody()
  assert.match(body, /return openTicketedSocket\(\{/)
  assert.match(body, /connect: \(url\) =>/)
  assert.doesNotMatch(ws, /[?&]token=/)
  assert.match(ws, /transport: \{ open: openNativeSocket,/)
})

test("the compose route takes its mode and target only through composerParams", () => {
  assert.match(compose, /import \{ composerParams \} from "@\/lib\/composerParams"/)
  assert.match(compose, /= composerParams\(useLocalSearchParams</)
  assert.equal(compose.match(/useLocalSearchParams</g)?.length, 1)
})

test("incoming system links resolve with dev-only passthrough tied to the build type", () => {
  assert.match(nativeIntent, /resolveIncomingPath\(path, \{ isDev: __DEV__ \}\)/)
})
