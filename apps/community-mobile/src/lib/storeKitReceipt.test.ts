import { test } from "node:test"
import assert from "node:assert/strict"
import { RECEIPT_ABSENT, betaInstallFromReceipts, type ReceiptStat } from "./storeKitReceipt.ts"

function present(modifiedAt: number | null): ReceiptStat {
  return { present: true, modifiedAt }
}

test("no sandbox receipt means the build was never handed out through TestFlight", () => {
  assert.equal(betaInstallFromReceipts(RECEIPT_ABSENT, RECEIPT_ABSENT), false)
  assert.equal(betaInstallFromReceipts(present(1_000), RECEIPT_ABSENT), false)
})

test("a sandbox receipt with no store receipt is a TestFlight install", () => {
  assert.equal(betaInstallFromReceipts(RECEIPT_ABSENT, present(1_000)), true)
})

test("with both receipts on disk the newer one wins, in either direction", () => {
  assert.equal(betaInstallFromReceipts(present(1_000), present(2_000)), true)
  assert.equal(betaInstallFromReceipts(present(2_000), present(1_000)), false)
})

test("a tie resolves to the App Store, never to staging", () => {
  assert.equal(betaInstallFromReceipts(present(1_000), present(1_000)), false)
})

test("an unreadable timestamp falls back to the store receipt rather than guessing staging", () => {
  assert.equal(betaInstallFromReceipts(present(null), present(2_000)), false)
  assert.equal(betaInstallFromReceipts(present(1_000), present(null)), false)
  assert.equal(betaInstallFromReceipts(present(null), present(null)), false)
})
