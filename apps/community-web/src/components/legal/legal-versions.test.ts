import { createHash } from "node:crypto"
import { readdirSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { LEGAL_DOCUMENTS, currentVersion, isCurrent } from "@civfix/shared/legal"

import { LEGAL_DOC_TYPE, legalVersionFor, type LegalDocId } from "./legal-page"

const appDir = fileURLToPath(new URL("../../..", import.meta.url))
const legalRoutesDir = join(appDir, "src", "app", "legal")

const DOC_IDS = Object.keys(LEGAL_DOC_TYPE) as LegalDocId[]

describe("legal documents, routes and versions", () => {
  it("has a rendered route for every LegalDocId", () => {
    for (const id of DOC_IDS) {
      expect(existsSync(join(legalRoutesDir, id, "page.tsx"))).toBe(true)
    }
  })

  it("has a LegalDocId for every /legal/<slug> route that renders a document", () => {
    const routes = readdirSync(legalRoutesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
    expect([...routes].sort()).toEqual([...DOC_IDS].sort())
  })

  it("maps every doc id onto a type the contract knows", () => {
    const known = new Set(LEGAL_DOCUMENTS.map((document) => document.type))
    for (const id of DOC_IDS) expect(known.has(LEGAL_DOC_TYPE[id])).toBe(true)
  })

  it("renders the contract's current version for each document", () => {
    for (const id of DOC_IDS) {
      const document = legalVersionFor(id)
      expect(document.version).toBe(currentVersion(LEGAL_DOC_TYPE[id]))
      expect(isCurrent(LEGAL_DOC_TYPE[id], document.version)).toBe(true)
      expect(document.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it("renders every versioned document at a /legal route, leaving none unhashable", () => {
    const webTypes = new Set(DOC_IDS.map((id) => LEGAL_DOC_TYPE[id]))
    const unrendered = LEGAL_DOCUMENTS.map((document) => document.type).filter(
      (type) => !webTypes.has(type),
    )
    expect(unrendered).toEqual([])
  })

  it("points each contract url at the route that renders it", () => {
    for (const id of DOC_IDS) {
      expect(legalVersionFor(id).url).toBe(`https://civfix.org/legal/${id}`)
    }
  })

  it("carries no placeholder hash: a consent record must cite text that exists", () => {
    for (const document of LEGAL_DOCUMENTS) {
      const placeholder = createHash("sha256")
        .update(`${document.type}@${document.version}`, "utf8")
        .digest("hex")
      expect(document.sha256).not.toBe(placeholder)
    }
  })
})
