import { useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ErrorCode,
  LegalVersionOutdatedDetailsSchema,
  toAppError,
  type AcceptLegalRequest,
  type AcceptLegalResponse,
  type GetLegalDocumentResponse,
  type GetLegalDocumentsResponse,
  type LegalDocumentDTO,
  type LegalDocumentType,
  type LegalVersionOutdatedDetails,
  type MyLegalStatusResponse,
} from "@civfix/contract"
import { useApi, useAuthState } from "../context"
import { queryKeys } from "../keys"

// A new version reaches clients when the backend deploys it; five minutes bounds how long a mounted app
// can offer the previous one, and the server's outdated CONFLICT covers that window.
const LEGAL_STALE_MS = 5 * 60 * 1000

const selectDocuments = (res: GetLegalDocumentsResponse): LegalDocumentDTO[] => res.documents
const selectDocument = (res: GetLegalDocumentResponse): LegalDocumentDTO => res.document

/** GET /legal/documents: the version of every document in effect now, with its text. */
export function useLegalDocuments(options: { enabled?: boolean } = {}) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.legalDocuments,
    queryFn: () => api.getLegalDocuments(),
    select: selectDocuments,
    staleTime: LEGAL_STALE_MS,
    enabled: options.enabled ?? true,
  })
}

/**
 * One legal document: without a version, the type's entry of {@link useLegalDocuments} (the same query,
 * no request of its own); with one, that exact version from GET /legal/documents/:type/:version.
 */
export function useLegalDocument(type: LegalDocumentType, version?: string) {
  const api = useApi()
  const selectType = useCallback(
    (res: GetLegalDocumentsResponse): LegalDocumentDTO | null =>
      res.documents.find((document) => document.type === type) ?? null,
    [type],
  )
  const current = useQuery({
    queryKey: queryKeys.legalDocuments,
    queryFn: () => api.getLegalDocuments(),
    select: selectType,
    staleTime: LEGAL_STALE_MS,
    enabled: version === undefined,
  })
  const pinned = useQuery({
    queryKey: queryKeys.legalDocument(type, version ?? ""),
    queryFn: () => api.getLegalDocument({ type, version: version ?? "" }),
    select: selectDocument,
    staleTime: LEGAL_STALE_MS,
    enabled: version !== undefined,
  })
  return version === undefined ? current : pinned
}

/** GET /me/legal: what the signed-in person still has to accept or acknowledge. */
export function useMyLegalStatus() {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<MyLegalStatusResponse>({
    queryKey: queryKeys.myLegalStatus,
    queryFn: () => api.getMyLegalStatus(),
    staleTime: LEGAL_STALE_MS,
    enabled: isAuthenticated,
  })
}

/** POST /me/legal/accept. A refusal changes nothing on the server, so only a success refetches the status. */
export function useAcceptLegal() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<AcceptLegalResponse, unknown, AcceptLegalRequest>({
    mutationFn: (body) => api.acceptLegal(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.myLegalStatus })
    },
  })
}

/**
 * The versions in effect named by a `legal_version_outdated` CONFLICT, or null for any other error. Read
 * structurally, so an error that crossed a serialization boundary still counts.
 */
export function outdatedLegalVersions(err: unknown): LegalVersionOutdatedDetails["current"] | null {
  const appError = toAppError(err)
  if (appError.code !== ErrorCode.CONFLICT) return null
  const details = LegalVersionOutdatedDetailsSchema.safeParse(appError.details)
  return details.success ? details.data.current : null
}
