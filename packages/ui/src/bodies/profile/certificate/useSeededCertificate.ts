import { useEffect, useMemo, useRef, useState } from "react"
import type { ServiceHoursCertificateDTO } from "@civfix/shared"
import { useMyServiceHoursCertificates } from "../../../data"
import { latestLiveCertificate } from "./certificateSeed"

export function useSeededCertificate() {
  const myCertificates = useMyServiceHoursCertificates()
  const [certificate, setCertificate] = useState<ServiceHoursCertificateDTO | null>(null)

  /**
   * Codes revoked in THIS session. The revoke mutation invalidates the list, but the cached rows stay
   * readable until the refetch lands - without this the seed effect would immediately re-adopt the
   * document the viewer just killed.
   */
  const revokedCodesRef = useRef<Set<string>>(new Set())

  const latestLive = useMemo(
    () => latestLiveCertificate(myCertificates.data?.certificates ?? [], revokedCodesRef.current),
    [myCertificates.data],
  )

  // Seed only when empty, never over a certificate this session issued: that one still holds a live presigned
  // url, while a listed row carries none (`url: null` -> the card's `expired` state -> "Refresh link").
  useEffect(() => {
    if (!latestLive) return
    setCertificate((prev) => prev ?? latestLive)
  }, [latestLive])

  return { certificate, setCertificate, revokedCodesRef }
}
