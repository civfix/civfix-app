import { test } from "node:test"
import assert from "node:assert/strict"
import { mobileDefaultHeaders } from "./clientHeaders.ts"

test("T16: every phone request names the client and the build's platform and version", () => {
  assert.deepEqual(mobileDefaultHeaders("android", "1.4.0"), {
    "X-Client": "mobile",
    "X-Civfix-App-Version": "android/1.4.0",
  })
  assert.deepEqual(mobileDefaultHeaders("ios", "1.4.0"), {
    "X-Client": "mobile",
    "X-Civfix-App-Version": "ios/1.4.0",
  })
})
