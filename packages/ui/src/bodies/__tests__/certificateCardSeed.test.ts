/**
 * Guards for the ONE thing that keeps a handed-out certificate code revocable: the card seeds its local
 * state from `useMyServiceHoursCertificates()`.
 *
 * Before 0.38.1 the issued certificate existed only in component state written by `issue.mutate`'s
 * `onSuccess`, so switching off the Hours tab (or reloading) dropped the card back to `idle` - no code,
 * no summary, and no REVOKE, which the card's own comment calls the only control over a code already
 * handed to a registrar. The list hook shipped in the same release and had literally no call site.
 *
 * Two rules the seed has to keep, both of them invisible to typecheck:
 *   1. It never overwrites a certificate THIS session issued (that one holds a live presigned url; a
 *      listed row carries `url: null`, which `certificateCardState` reads as `expired`).
 *   2. A code revoked in this session is never re-adopted from the still-warm list cache.
 *
 * The pure state rules live in `serviceCertificate.test.ts`; this is the wiring, plus the model
 * assertion that a url-less listed row lands in `expired` rather than a lying `ready`.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { certificateCardState } from "../serviceCertificate"

const card = readFileSync(
  new URL("../profile/ServiceHoursCertificateCard.tsx", import.meta.url),
  "utf8",
)

/** Strip comments so the assertions read CODE only - the header prose names these symbols too. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

describe("ServiceHoursCertificateCard seeds from the certificate list", () => {
  const body = code(card)

  it("calls the list hook that previously had no call site anywhere in the package", () => {
    expect(body).toContain("useMyServiceHoursCertificates()")
    expect(body).toContain("myCertificates.data?.certificates")
  })

  it("seeds the newest NON-REVOKED row", () => {
    // `listFor` is newest-first and INCLUDES revoked rows, so both server flags are filtered.
    expect(body).toContain('row.status !== "revoked"')
    expect(body).toContain("row.revokedAt == null")
    expect(body).toMatch(/rows\.find\(/)
  })

  it("never clobbers a certificate this session issued", () => {
    // Functional update, not a bare `setCertificate(row)`: the freshly issued one holds a LIVE url.
    expect(body).toContain("setCertificate((prev) => prev ?? latestLive)")
  })

  it("cannot resurrect a code revoked in this session from the warm list cache", () => {
    expect(body).toContain("revokedCodesRef")
    expect(body).toContain("revokedCodesRef.current.add(code)")
    expect(body).toContain("!revokedCodesRef.current.has(row.code)")
  })

  it("keeps the revoke affordance reachable from a seeded (link-less) certificate", () => {
    // The revoke block is gated on `certificate` alone, NOT on the card being in `ready`.
    expect(body).toContain("{certificate ? (")
    expect(body).toContain("transcript.revoke_a11y")
  })
})

describe("a listed row (no presigned url) lands in the free-to-refresh state", () => {
  const listed = {
    hasCertificate: true,
    isPending: false,
    isError: false,
    totalHours: 12,
    now: Date.now(),
  }

  it("reads a null urlExpiresAt as `expired`, never as a live `ready`", () => {
    expect(certificateCardState({ ...listed, urlExpiresAt: null })).toBe("expired")
    expect(certificateCardState(listed)).toBe("expired")
  })

  it("still reports `ready` once a refresh mints a live link", () => {
    expect(
      certificateCardState({
        ...listed,
        urlExpiresAt: new Date(listed.now + 15 * 60_000).toISOString(),
      }),
    ).toBe("ready")
  })
})
