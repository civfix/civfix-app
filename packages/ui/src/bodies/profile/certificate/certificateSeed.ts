import type { ServiceHoursCertificateDTO } from "@civfix/shared"

/**
 * The newest document still worth showing. `listFor` orders newest-first and INCLUDES revoked rows, so
 * both the server's `status`/`revokedAt` and this session's revocations are filtered out here.
 */
export function latestLiveCertificate(
  rows: readonly ServiceHoursCertificateDTO[],
  revokedCodes: ReadonlySet<string>,
): ServiceHoursCertificateDTO | null {
  return (
    rows.find(
      (row) => row.status !== "revoked" && row.revokedAt == null && !revokedCodes.has(row.code),
    ) ?? null
  )
}
