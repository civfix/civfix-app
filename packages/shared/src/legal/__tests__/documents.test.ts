import { describe, expect, it } from "vitest"
import { LegalDocumentTypeSchema, type LegalDocumentType } from "../../schemas/common.js"
import { LEGAL_DOCUMENTS, currentVersion, isCurrent, legalDocument } from "../documents.js"

const ALL: readonly LegalDocumentType[] = LegalDocumentTypeSchema.options

describe("LEGAL_DOCUMENTS", () => {
  it("carries exactly one entry per legal document type", () => {
    expect(LEGAL_DOCUMENTS.map((doc) => doc.type).sort()).toEqual([...ALL].sort())
    expect(new Set(LEGAL_DOCUMENTS.map((doc) => doc.type)).size).toBe(LEGAL_DOCUMENTS.length)
  })

  it("is frozen so no consumer can mutate the legal record", () => {
    expect(Object.isFrozen(LEGAL_DOCUMENTS)).toBe(true)
    for (const doc of LEGAL_DOCUMENTS) expect(Object.isFrozen(doc)).toBe(true)
  })

  it("uses a date-shaped version, an ISO effectiveAt and a 64-hex sha256", () => {
    for (const doc of LEGAL_DOCUMENTS) {
      expect(doc.version).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(doc.effectiveAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(Number.isFinite(Date.parse(doc.effectiveAt))).toBe(true)
      expect(doc.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it("gives every document a distinct https civfix.org URL", () => {
    const urls = LEGAL_DOCUMENTS.map((doc) => doc.url)
    expect(new Set(urls).size).toBe(urls.length)
    for (const url of urls) expect(url.startsWith("https://civfix.org/legal/")).toBe(true)
  })

  it("gives every document a distinct sha256", () => {
    const hashes = LEGAL_DOCUMENTS.map((doc) => doc.sha256)
    expect(new Set(hashes).size).toBe(hashes.length)
  })
})

describe("currentVersion / isCurrent", () => {
  it("returns the version recorded for the type", () => {
    for (const type of ALL) {
      expect(currentVersion(type)).toBe(legalDocument(type).version)
      expect(isCurrent(type, currentVersion(type))).toBe(true)
      expect(isCurrent(type, "1999-01-01")).toBe(false)
      expect(isCurrent(type, "")).toBe(false)
    }
  })

  it("throws on an unknown type rather than silently accepting stale consent", () => {
    expect(() => currentVersion("nope" as LegalDocumentType)).toThrow(RangeError)
    expect(() => legalDocument("nope" as LegalDocumentType)).toThrow(RangeError)
  })
})
