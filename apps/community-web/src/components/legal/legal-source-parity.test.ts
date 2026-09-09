import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { DONATION_DISCLOSURE_TEMPLATE } from "@civfix/shared/legal"
import { describe, expect, it } from "vitest"

const appDir = fileURLToPath(new URL("../../..", import.meta.url))

function source(...segments: string[]): string {
  return readFileSync(join(appDir, "src", ...segments), "utf8")
}

const consentFlow = source("features", "host", "org", "payments", "consent-agreement-flow.tsx")
const agreementPage = source("app", "legal", "org-donation-agreement", "page.tsx")
const disclosurePage = source("app", "legal", "donation-disclosure", "page.tsx")

describe("§318 agreement: the org accepts the text that is hashed", () => {
  it("renders the same body component on the legal page and in the console sheet", () => {
    for (const file of [agreementPage, consentFlow]) {
      expect(file).toContain('from "@/components/legal/org-donation-agreement-body"')
      expect(file).toContain("<OrgDonationAgreementBody />")
    }
  })

  it("sends the hash of the build's own document, not one fetched separately", () => {
    expect(consentFlow).toContain('import { legalDocument } from "@civfix/shared/legal"')
    expect(consentFlow).toContain("const shownDoc = legalDocument(AGREEMENT_DOCUMENT)")
    expect(consentFlow).toContain("documentSha256: shownDoc.sha256")
    expect(consentFlow).toContain("version: shownDoc.version")
  })

  it("refuses to accept when the server requires a version this build does not render", () => {
    expect(consentFlow).toContain(
      "const staleBuild = requiredVersion !== null && requiredVersion !== shownDoc.version",
    )
    expect(consentFlow).toMatch(/primaryDisabled=\{[^}]*staleBuild/s)
  })

  it("links the published agreement route", () => {
    expect(consentFlow).toContain('const AGREEMENT_PATH = "/legal/org-donation-agreement"')
  })
})

describe("donation disclosures: one template, rendered not retyped", () => {
  it("renders the shared template module", () => {
    expect(disclosurePage).toContain(
      'import { DONATION_DISCLOSURE_TEMPLATE } from "@civfix/shared/legal"',
    )
  })

  it("hardcodes none of the seven disclosure sentences", () => {
    const sentences = [
      DONATION_DISCLOSURE_TEMPLATE.recipient,
      DONATION_DISCLOSURE_TEMPLATE.mayNotReceive,
      DONATION_DISCLOSURE_TEMPLATE.remittanceTiming,
      DONATION_DISCLOSURE_TEMPLATE.feePointer,
      DONATION_DISCLOSURE_TEMPLATE.deductible,
      DONATION_DISCLOSURE_TEMPLATE.notDeductible,
      DONATION_DISCLOSURE_TEMPLATE.merchantOfRecord,
      DONATION_DISCLOSURE_TEMPLATE.defaultRefundPolicy,
      ...DONATION_DISCLOSURE_TEMPLATE.mayNotReceiveReasons,
    ]
    for (const sentence of sentences) expect(disclosurePage).not.toContain(sentence)
  })

  it("renders every template sentence through the module", () => {
    for (const key of [
      "recipient",
      "mayNotReceive",
      "mayNotReceiveReasons",
      "remittanceTiming",
      "feePointer",
      "deductible",
      "notDeductible",
      "merchantOfRecord",
      "defaultRefundPolicy",
    ]) {
      expect(disclosurePage).toContain(`T.${key}`)
    }
  })
})
