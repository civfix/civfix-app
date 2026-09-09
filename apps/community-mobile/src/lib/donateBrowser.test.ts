import { test } from "node:test"
import assert from "node:assert/strict"
import {
  DEFAULT_DONATE_BROWSER_MODE,
  DONATE_BROWSER_MODES,
  resolveDonateBrowserMode,
} from "./donateBrowser.ts"

test("a donation link opens in the in-app browser unless the build says otherwise", () => {
  assert.equal(DEFAULT_DONATE_BROWSER_MODE, "in-app")
  assert.equal(resolveDonateBrowserMode(undefined), "in-app")
  assert.equal(resolveDonateBrowserMode(""), "in-app")
  assert.equal(resolveDonateBrowserMode(null), "in-app")
  assert.equal(resolveDonateBrowserMode(123), "in-app")
})

test("the App Review escape hatch is one env value away", () => {
  assert.equal(resolveDonateBrowserMode("system"), "system")
  assert.equal(resolveDonateBrowserMode(" SYSTEM "), "system")
  assert.equal(resolveDonateBrowserMode("in-app"), "in-app")
})

test("an unknown mode degrades to the documented default instead of guessing", () => {
  assert.equal(resolveDonateBrowserMode("webview"), "in-app")
  assert.equal(resolveDonateBrowserMode("none"), "in-app")
  assert.deepEqual([...DONATE_BROWSER_MODES], ["in-app", "system"])
})
