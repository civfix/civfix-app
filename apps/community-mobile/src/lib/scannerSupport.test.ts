import { test } from "node:test"
import assert from "node:assert/strict"
import { ANDROID_CODE_SCANNER_IN_NATIVE_BUILD, codeScannerSupported } from "./scannerSupport.ts"

test("iOS scans over the air; Android waits for the store build that compiles MLKit in", () => {
  assert.equal(codeScannerSupported("ios"), true)
  assert.equal(codeScannerSupported("android"), ANDROID_CODE_SCANNER_IN_NATIVE_BUILD)
})

test("a platform with no camera never claims a scanner", () => {
  assert.equal(codeScannerSupported("web"), false)
  assert.equal(codeScannerSupported("windows"), false)
  assert.equal(codeScannerSupported(""), false)
})
