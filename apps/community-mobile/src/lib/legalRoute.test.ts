import assert from "node:assert/strict"
import { test } from "node:test"
import { isLegalDocumentPath } from "./legalRoute.ts"

test("T20: the in-app legal screen's routes are the ones the gates step aside for", () => {
  for (const path of ["/legal/terms", "/legal/privacy", "/legal/cookies", "/legal/subprocessors", "/legal/nope"]) {
    assert.equal(isLegalDocumentPath(path), true, path)
  }
  for (const path of ["/", "/legal", "/legal/", "/legal/terms/extra", "/about", "/settings/privacy", "/xlegal/terms"]) {
    assert.equal(isLegalDocumentPath(path), false, path)
  }
})
