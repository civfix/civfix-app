import { test } from "node:test"
import assert from "node:assert/strict"
import { installModuleStubs } from "../../tests/helpers/moduleHooks.ts"

const STUBS = new URL("../../tests/helpers/secureSessionStubs.ts", import.meta.url)
installModuleStubs({
  "expo-secure-store": STUBS,
  "@/lib/mmkv": STUBS,
  "@/config": STUBS,
  "@/api/client": STUBS,
})
;(globalThis as { __DEV__?: boolean }).__DEV__ = false

const { control, keychain, pendingWrites } =
  await import("../../tests/helpers/secureSessionStubs.ts")
const { getToken, setToken, clearToken } = await import("../auth/storage.ts")
const { sessionCheck } = await import("./sessionCheck.ts")

const DEADLINE_MS = 5000

// Each request reports the credential it was sent with, and answers only when the test releases it.
function holdSessionRequests(): (() => void)[] {
  const answers: (() => void)[] = []
  control.session = async () => {
    const sentWith = await getToken()
    await new Promise<void>((resolve) => answers.push(resolve))
    return { sentWith }
  }
  return answers
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setImmediate(resolve))
}

async function finishWrite(writing: Promise<void>): Promise<void> {
  await settle()
  const pending = pendingWrites.shift()
  assert.ok(pending, "the token write never reached the keychain")
  pending.release()
  await writing
}

for (const [name, write] of [
  ["sign-in", () => setToken("new-token")],
  ["sign-out", () => clearToken()],
] as const) {
  test(`a session check after a ${name} write settles never joins a request sent while it was in flight`, async () => {
    keychain.clear()
    pendingWrites.length = 0
    await finishWrite(setToken("old-token"))
    const answers = holdSessionRequests()

    const writing = write()
    await settle()
    const duringWrite = sessionCheck(DEADLINE_MS)
    await settle()
    await finishWrite(writing)

    const afterWrite = sessionCheck(DEADLINE_MS)
    await settle()
    for (const answer of answers) answer()

    assert.deepEqual(await duringWrite, { sentWith: "old-token" })
    assert.deepEqual(await afterWrite, { sentWith: name === "sign-in" ? "new-token" : null })
  })
}
