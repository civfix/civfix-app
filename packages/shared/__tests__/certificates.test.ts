import { describe, it, expect } from "vitest"
import {
  CERTIFICATE_CODE_ALPHABET,
  CERTIFICATE_CODE_LENGTH,
  CERTIFICATE_CODE_RE,
  CERTIFICATE_GET_URL_TTL_SEC,
  MAX_CERTIFICATE_ENTRIES,
  CertificateCodeSchema,
  CertificateStatusSchema,
  IssueServiceHoursCertificateRequestSchema,
  IssueServiceHoursCertificateResponseSchema,
  ListMyCertificatesResponseSchema,
  RevokeCertificateRequestSchema,
  RevokeCertificateResponseSchema,
  ServiceHoursCertificateDTOSchema,
  VerifyCertificateRequestSchema,
  VerifyCertificateResponseSchema,
  formatCertificateCode,
  normalizeCertificateCode,
} from "../src/schemas/certificates.js"
import { FakeStorage } from "../src/fakes/storage.fake.js"

const CODE = "A1B2C3D4E5F6"
/** A genuine 12-char code that happens to START with the display prefix. */
const CFX_CODE = "CFX123456789"

describe("certificate code alphabet", () => {
  it("is Crockford base32 with the ambiguous letters removed", () => {
    expect(CERTIFICATE_CODE_ALPHABET).toHaveLength(32)
    expect(new Set(CERTIFICATE_CODE_ALPHABET).size).toBe(32)
    for (const c of ["I", "L", "O", "U"]) expect(CERTIFICATE_CODE_ALPHABET).not.toContain(c)
    // The regex and the alphabet must agree, or generation and validation drift apart.
    for (const c of CERTIFICATE_CODE_ALPHABET) {
      expect(CERTIFICATE_CODE_RE.test(c.repeat(CERTIFICATE_CODE_LENGTH))).toBe(true)
    }
  })

  it("exports the entry cap and the presigned-GET TTL", () => {
    expect(MAX_CERTIFICATE_ENTRIES).toBe(1000)
    expect(CERTIFICATE_GET_URL_TTL_SEC).toBe(900)
  })
})

describe("normalizeCertificateCode", () => {
  it("accepts the printed display form", () => {
    expect(normalizeCertificateCode("cfx-a1b2-c3d4-e5f6")).toBe(CODE)
    expect(normalizeCertificateCode("CFX-A1B2-C3D4-E5F6")).toBe(CODE)
  })

  it("accepts the bare form with surrounding whitespace", () => {
    expect(normalizeCertificateCode(" A1B2C3D4E5F6 ")).toBe(CODE)
    expect(normalizeCertificateCode("a1b2 c3d4 e5f6")).toBe(CODE)
  })

  it("folds the ambiguous transcription characters (O->0, I/L->1, U->V)", () => {
    expect(normalizeCertificateCode("A1B2C3D4E5FO")).toBe("A1B2C3D4E5F0")
    expect(normalizeCertificateCode("A1B2C3D4E5FI")).toBe("A1B2C3D4E5F1")
    expect(normalizeCertificateCode("A1B2C3D4E5FL")).toBe("A1B2C3D4E5F1")
    expect(normalizeCertificateCode("A1B2C3D4E5FU")).toBe("A1B2C3D4E5FV")
  })

  it("returns null for input that cannot be a code", () => {
    expect(normalizeCertificateCode("nope")).toBeNull()
    expect(normalizeCertificateCode("")).toBeNull()
    expect(normalizeCertificateCode("A1B2C3D4E5F")).toBeNull() // 11 chars
    expect(normalizeCertificateCode("A1B2C3D4E5F6G")).toBeNull() // 13 chars
  })

  it("leaves a genuine code that begins with CFX unharmed (no unconditional prefix strip)", () => {
    // C, F and X are all valid Crockford symbols, so the BARE form must be tried first.
    expect(normalizeCertificateCode(CFX_CODE)).toBe(CFX_CODE)
    expect(normalizeCertificateCode("cfx123456789")).toBe(CFX_CODE)
    // ...and its display form still round-trips, which is the CFX-stripped branch.
    expect(normalizeCertificateCode(formatCertificateCode(CFX_CODE))).toBe(CFX_CODE)
  })

  it("is idempotent", () => {
    expect(normalizeCertificateCode(normalizeCertificateCode(CODE)!)).toBe(CODE)
  })
})

describe("formatCertificateCode", () => {
  it("renders the CFX-XXXX-XXXX-XXXX display form", () => {
    expect(formatCertificateCode(CODE)).toBe("CFX-A1B2-C3D4-E5F6")
    expect(formatCertificateCode(CFX_CODE)).toBe("CFX-CFX1-2345-6789")
  })

  it("round-trips through normalize", () => {
    for (const code of [CODE, CFX_CODE, "0123456789AB", "ZZZZZZZZZZZZ"]) {
      expect(normalizeCertificateCode(formatCertificateCode(code))).toBe(code)
    }
  })
})

describe("CertificateCodeSchema (loose-in, canonical-out)", () => {
  it("normalizes valid input to the canonical form", () => {
    expect(CertificateCodeSchema.parse("cfx-a1b2-c3d4-e5f6")).toBe(CODE)
    expect(CertificateCodeSchema.parse(" a1b2c3d4e5fo ")).toBe("A1B2C3D4E5F0")
  })

  it("rejects the wrong length", () => {
    expect(CertificateCodeSchema.safeParse("A1B2C3D4E5F").success).toBe(false) // 11
    expect(CertificateCodeSchema.safeParse("A1B2C3D4E5F6G").success).toBe(false) // 13
    expect(CertificateCodeSchema.safeParse("").success).toBe(false)
  })

  it("rejects out-of-alphabet characters", () => {
    expect(CertificateCodeSchema.safeParse("A1B2C3D4E5F$").success).toBe(false)
    expect(CertificateCodeSchema.safeParse("A1B2C3D4E5F*").success).toBe(false)
    expect(CertificateCodeSchema.safeParse("A1B2C3D4E5Fé").success).toBe(false)
  })

  it("rejects a non-string", () => {
    expect(CertificateCodeSchema.safeParse(123456789012).success).toBe(false)
    expect(CertificateCodeSchema.safeParse(null).success).toBe(false)
  })
})

describe("certificate request schemas (.strict())", () => {
  it("issue takes an optional locale and nothing else", () => {
    expect(IssueServiceHoursCertificateRequestSchema.parse({})).toEqual({})
    expect(IssueServiceHoursCertificateRequestSchema.parse({ locale: "es" })).toEqual({
      locale: "es",
    })
    expect(IssueServiceHoursCertificateRequestSchema.safeParse({ locale: "fr" }).success).toBe(
      false,
    )
  })

  it("issue rejects the dropped v1 filters (C2: whole-ledger only)", () => {
    for (const body of [
      { geoid: "0644000" },
      { from: "2026-01-01" },
      { to: "2026-12-31" },
      { recipient: "Lincoln High School" },
    ]) {
      expect(IssueServiceHoursCertificateRequestSchema.safeParse(body).success).toBe(false)
    }
  })

  it("revoke carries the code (the path param is merged in by the route) and normalizes it", () => {
    expect(RevokeCertificateRequestSchema.parse({ code: "cfx-a1b2-c3d4-e5f6" })).toEqual({
      code: CODE,
    })
    expect(RevokeCertificateRequestSchema.safeParse({}).success).toBe(false)
    expect(RevokeCertificateRequestSchema.safeParse({ code: CODE, reason: "x" }).success).toBe(
      false,
    )
  })

  it("verify carries the terminal path param and normalizes it", () => {
    expect(VerifyCertificateRequestSchema.parse({ code: "CFX-A1B2-C3D4-E5F6" })).toEqual({
      code: CODE,
    })
    expect(VerifyCertificateRequestSchema.safeParse({ code: "nope" }).success).toBe(false)
    expect(VerifyCertificateRequestSchema.safeParse({ code: CODE, extra: 1 }).success).toBe(false)
  })
})

const MINIMAL_CERT = {
  code: CODE,
  status: "valid",
  locale: "en",
  issuedAt: "2026-07-27T00:00:00.000Z",
  totalHours: 12.5,
  entryCount: 7,
}

describe("certificate response schemas (tolerant)", () => {
  it("ServiceHoursCertificateDTOSchema parses a minimal legacy payload", () => {
    const parsed = ServiceHoursCertificateDTOSchema.safeParse(MINIMAL_CERT)
    expect(parsed.success).toBe(true)
  })

  it("ServiceHoursCertificateDTOSchema parses the full payload", () => {
    const parsed = ServiceHoursCertificateDTOSchema.safeParse({
      ...MINIMAL_CERT,
      periodStart: "2026-01-01T00:00:00.000Z",
      periodEnd: "2026-07-01T00:00:00.000Z",
      documentSha256: "a".repeat(64),
      byteSize: 45123,
      url: "https://example.test/x.pdf",
      urlExpiresAt: "2026-07-27T00:15:00.000Z",
      revokedAt: null,
    })
    expect(parsed.success).toBe(true)
  })

  it("tolerates a future status value and unknown fields rather than disabling parsing", () => {
    expect(
      ServiceHoursCertificateDTOSchema.safeParse({ ...MINIMAL_CERT, status: "pending" }).success,
    ).toBe(true)
    expect(
      ServiceHoursCertificateDTOSchema.safeParse({ ...MINIMAL_CERT, somethingNew: true }).success,
    ).toBe(true)
    // The narrow enum still exists for the writer side.
    expect(CertificateStatusSchema.safeParse("pending").success).toBe(false)
    expect(CertificateStatusSchema.parse("revoked")).toBe("revoked")
  })

  it("IssueServiceHoursCertificateResponseSchema parses without `reused`", () => {
    expect(
      IssueServiceHoursCertificateResponseSchema.safeParse({ certificate: MINIMAL_CERT }).success,
    ).toBe(true)
    expect(
      IssueServiceHoursCertificateResponseSchema.safeParse({
        certificate: MINIMAL_CERT,
        reused: true,
      }).success,
    ).toBe(true)
  })

  it("ListMyCertificatesResponseSchema parses an empty list", () => {
    expect(ListMyCertificatesResponseSchema.safeParse({ certificates: [] }).success).toBe(true)
    expect(
      ListMyCertificatesResponseSchema.safeParse({ certificates: [MINIMAL_CERT] }).success,
    ).toBe(true)
  })

  it("RevokeCertificateResponseSchema parses a minimal payload", () => {
    expect(
      RevokeCertificateResponseSchema.safeParse({
        certificate: { ...MINIMAL_CERT, status: "revoked" },
      }).success,
    ).toBe(true)
  })

  it("VerifyCertificateResponseSchema parses a minimal legacy payload", () => {
    expect(
      VerifyCertificateResponseSchema.safeParse({
        code: CODE,
        status: "valid",
        issuedAt: "2026-07-27T00:00:00.000Z",
        totalHours: 12.5,
        entryCount: 7,
      }).success,
    ).toBe(true)
  })

  it("VerifyCertificateResponseSchema parses the revoked shape", () => {
    expect(
      VerifyCertificateResponseSchema.safeParse({
        code: CODE,
        status: "revoked",
        holderName: null,
        issuedAt: "2026-07-27T00:00:00.000Z",
        totalHours: 0,
        entryCount: 0,
        revokedAt: "2026-07-27T01:00:00.000Z",
        revokedReason: "account_closed",
      }).success,
    ).toBe(true)
  })

  it("VerifyCertificateResponseSchema exposes NOTHING that is not printed on the document", () => {
    const keys = Object.keys(VerifyCertificateResponseSchema.shape)
    for (const forbidden of ["userId", "url", "r2Key", "snapshot", "email", "entries", "items"]) {
      expect(keys).not.toContain(forbidden)
    }
    expect(keys.sort()).toEqual(
      [
        "code",
        "status",
        "holderName",
        "holderHandle",
        "verifiedHolder",
        "issuedAt",
        "totalHours",
        "entryCount",
        "periodStart",
        "periodEnd",
        "jurisdictionNames",
        "documentSha256",
        "revokedAt",
        "revokedReason",
      ].sort(),
    )
  })
})

describe("FakeStorage contentDisposition", () => {
  it("stores the disposition on put() and surfaces it from head()", async () => {
    const s = new FakeStorage()
    const disposition = `inline; filename="civfix-service-hours-${formatCertificateCode(CODE)}.pdf"`
    await s.put("certificates/service-hours/2026/07/x.pdf", new Uint8Array([1, 2, 3]), {
      contentType: "application/pdf",
      contentDisposition: disposition,
    })
    const head = await s.head("certificates/service-hours/2026/07/x.pdf")
    expect(head).toEqual({
      size: 3,
      contentType: "application/pdf",
      contentDisposition: disposition,
    })
  })

  it("omits the disposition when put() was given none", async () => {
    const s = new FakeStorage()
    await s.put("k", new Uint8Array([1]), { contentType: "image/png" })
    expect(await s.head("k")).toEqual({ size: 1, contentType: "image/png" })
  })
})
