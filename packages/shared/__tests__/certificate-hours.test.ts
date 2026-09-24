import { describe, expect, it } from "vitest"
import { formatCertificateHours } from "../src/schemas/certificates.js"

describe("formatCertificateHours", () => {
  it("prints whole hours without decimals and quarter hours with up to two", () => {
    expect(formatCertificateHours(3, "en")).toBe("3")
    expect(formatCertificateHours(2.5, "en")).toBe("2.5")
    expect(formatCertificateHours(2.25, "en")).toBe("2.25")
    expect(formatCertificateHours(1234.75, "en")).toBe("1,234.75")
  })

  it("follows the viewer's locale", () => {
    expect(formatCertificateHours(2.5, "de")).toBe("2,5")
  })

  it("keeps at least one decimal for a fractional total that rounds to a whole number", () => {
    expect(formatCertificateHours(2.999, "en")).toBe("3.0")
  })

  it("never throws on an unsupported locale tag", () => {
    expect(formatCertificateHours(2.5, "not a locale!")).toBe("2.5")
  })
})
