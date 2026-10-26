import { useCallback, useMemo, useState } from "react"
import { outdatedLegalVersions, useLegalDocuments } from "../../../data"
import { consentVersions, type ConsentVersions, type LegalVersionRef } from "./consentModel"

export interface ConsentVersionsState {
  /** Null while the documents load or after they failed; the form waits on it. */
  versions: ConsentVersions | null
  failed: boolean
  retry: () => void
  /** Adopts the versions an outdated CONFLICT names and says whether `err` was one. */
  adoptOutdated: (err: unknown) => boolean
}

/**
 * The versions an event consent sends. An outdated answer's versions win for as long as the form is
 * mounted and stay out of the query cache: they carry no document text.
 */
export function useConsentVersions(enabled: boolean): ConsentVersionsState {
  const documents = useLegalDocuments({ enabled })
  const [current, setCurrent] = useState<readonly LegalVersionRef[] | null>(null)
  const versions = useMemo(() => consentVersions(documents.data, current), [documents.data, current])
  const { refetch } = documents
  const retry = useCallback(() => {
    void refetch()
  }, [refetch])
  const adoptOutdated = useCallback((err: unknown) => {
    const named = outdatedLegalVersions(err)
    if (named === null) return false
    setCurrent(named)
    return true
  }, [])
  const failed = versions === null && !documents.isPending && !documents.isFetching
  return useMemo(() => ({ versions, failed, retry, adoptOutdated }), [versions, failed, retry, adoptOutdated])
}
