import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  findViolations,
  isLicenseAllowed,
  parseLicenseExpression,
  parseLicenseReport,
} from "./check-licenses.mjs"

describe("parseLicenseExpression", () => {
  it("binds AND tighter than OR and honours parentheses", () => {
    assert.deepEqual(parseLicenseExpression("MIT OR Apache-2.0 AND BSD-3-Clause"), {
      or: [{ id: "MIT" }, { and: [{ id: "Apache-2.0" }, { id: "BSD-3-Clause" }] }],
    })
    assert.deepEqual(parseLicenseExpression("(MIT OR Apache-2.0) AND BSD-3-Clause"), {
      and: [{ or: [{ id: "MIT" }, { id: "Apache-2.0" }] }, { id: "BSD-3-Clause" }],
    })
  })

  it("parses a WITH exception", () => {
    assert.deepEqual(parseLicenseExpression("Apache-2.0 WITH LLVM-exception"), {
      with: { id: "Apache-2.0" },
      exception: "LLVM-exception",
    })
  })

  it("rejects malformed expressions", () => {
    for (const bad of ["(MIT", "MIT)", "MIT OR", "AND MIT", "MIT WITH", "Commons Clause"]) {
      assert.throws(() => parseLicenseExpression(bad), `expected "${bad}" to be rejected`)
    }
  })
})

describe("isLicenseAllowed", () => {
  it("allows AGPL-compatible licenses", () => {
    for (const license of [
      "MIT",
      "ISC",
      "BSD-2-Clause",
      "Apache-2.0",
      "LGPL-3.0-or-later",
      "AGPL-3.0-only",
      "mit",
    ]) {
      assert.equal(isLicenseAllowed(license), true, license)
    }
  })

  it("denies incompatible, unknown and missing licenses", () => {
    for (const license of [
      "SSPL-1.0",
      "BUSL-1.1",
      "CC-BY-NC-4.0",
      "UNLICENSED",
      "Unknown",
      "GPL-2.0-only",
      "BSD-4-Clause",
      "BSD-3-Clause-No-Military-License",
      "LGPL-anything",
      "",
      undefined,
    ]) {
      assert.equal(isLicenseAllowed(license), false, String(license))
    }
  })

  it("accepts a choice when any option is allowed, a conjunction only when all are", () => {
    assert.equal(isLicenseAllowed("(MIT OR SSPL-1.0)"), true)
    assert.equal(isLicenseAllowed("MIT AND SSPL-1.0"), false)
  })

  it("denies a Commons Clause exception on an otherwise allowed license", () => {
    assert.equal(isLicenseAllowed("Apache-2.0 WITH Commons-Clause"), false)
    assert.equal(isLicenseAllowed("Apache-2.0 WITH LLVM-exception"), true)
  })
})

describe("findViolations", () => {
  const report = {
    MIT: [{ name: "ok", versions: ["1.0.0"], license: "MIT" }],
    Unknown: [{ name: "mislabelled", versions: ["2.0.0"], license: "Unknown" }],
  }

  it("reports every package with a disallowed license", () => {
    assert.deepEqual(findViolations(report, {}), [
      { name: "mislabelled", versions: ["2.0.0"], license: "Unknown" },
    ])
  })

  it("skips an allow-listed package only while it reports the recorded license", () => {
    assert.deepEqual(
      findViolations(report, { mislabelled: { license: "Unknown", reason: "MIT upstream" } }),
      [],
    )
    assert.equal(
      findViolations(report, { mislabelled: { license: "MIT", reason: "MIT upstream" } }).length,
      1,
    )
  })

  it("falls back to the report's grouping key when a package names no license", () => {
    assert.deepEqual(
      findViolations({ UNLICENSED: [{ name: "private", versions: ["0.1.0"] }] }, {}),
      [{ name: "private", versions: ["0.1.0"], license: "UNLICENSED" }],
    )
  })
})

describe("parseLicenseReport", () => {
  it("keeps a well-formed report, with and without a per-package license", () => {
    const report = {
      MIT: [{ name: "a", versions: ["1.0.0"], license: "MIT", paths: ["/x"] }],
      Unknown: [{ name: "b", versions: ["2.0.0"] }],
    }
    assert.deepEqual(parseLicenseReport(report), {
      MIT: [{ name: "a", versions: ["1.0.0"], license: "MIT" }],
      Unknown: [{ name: "b", versions: ["2.0.0"] }],
    })
  })

  it("fails on a shape it does not understand instead of passing the gate", () => {
    for (const bad of [
      null,
      [],
      { MIT: "a" },
      { MIT: [{ versions: ["1.0.0"] }] },
      { MIT: [{ name: "a", versions: [1] }] },
    ]) {
      assert.throws(() => parseLicenseReport(bad), JSON.stringify(bad))
    }
  })
})
