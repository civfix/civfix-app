import { useCallback } from "react"
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import type { ApiClient } from "@civfix/contract/client"
import {
  ErrorCode,
  LegalVersionOutdatedDetailsSchema,
  toAppError,
  type AcceptLegalRequest,
  type AcceptLegalResponse,
  type GetLegalDocumentResponse,
  type GetLegalDocumentsResponse,
  type LegalAcceptAction,
  type LegalDocumentDTO,
  type LegalDocumentMetaDTO,
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

/**
 * The server answers an acceptance with the person's new status. Showing it at once closes the prompt or
 * the banner without waiting for the refetch.
 */
function storeLegalStatus(qc: QueryClient, status: AcceptLegalResponse): void {
  qc.setQueryData(queryKeys.myLegalStatus, status)
  void qc.invalidateQueries({ queryKey: queryKeys.myLegalStatus })
}

/** POST /me/legal/accept. A refusal changes nothing on the server, so only a success refetches the status. */
export function useAcceptLegal() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<AcceptLegalResponse, unknown, AcceptLegalRequest>({
    mutationFn: (body) => api.acceptLegal(body),
    onSuccess: (status) => storeLegalStatus(qc, status),
  })
}

type LegalVersionRef = Pick<LegalDocumentMetaDTO, "type" | "version" | "sha256">

type AcceptLegalItem = AcceptLegalRequest["items"][number]

function legalItem({ type, version, sha256 }: LegalVersionRef, action: LegalAcceptAction): AcceptLegalItem {
  return { type, version, sha256, action }
}

/** Accept and continue: every owed version accepted, and every notice acknowledged with it, so no banner follows. */
export function promptAcceptance({
  required,
  notices,
}: Pick<MyLegalStatusResponse, "required" | "notices">): AcceptLegalRequest {
  return {
    items: [
      ...required.map((item) => legalItem(item, "accepted")),
      ...notices.map((item) => legalItem(item, "acknowledged")),
    ],
    surface: "prompt",
  }
}

/** The banner's Got it. */
export function noticeAcknowledgement(notice: LegalVersionRef): AcceptLegalRequest {
  return { items: [legalItem(notice, "acknowledged")], surface: "notice" }
}

// Signing up agrees to the Terms and the Privacy notice; the Cookies notice and the Subprocessors list
// are only shown (D4).
const SIGN_UP_ACTION: Record<LegalDocumentType, LegalAcceptAction> = {
  terms: "accepted",
  privacy: "accepted",
  cookies: "acknowledged",
  subprocessors: "acknowledged",
}

/**
 * First run's record of the documents in effect when its Continue was pressed. A recording that fails,
 * or documents that never loaded, must not keep anyone out of the app they just signed up for: the
 * update prompt asks for what is still owed once first run closes, so the failure ends here.
 */
export async function recordSignUpAcceptance(
  api: ApiClient,
  qc: QueryClient,
  documents: readonly LegalVersionRef[],
): Promise<void> {
  if (documents.length === 0) return
  try {
    const status = await api.acceptLegal({
      items: documents.map((document) => legalItem(document, SIGN_UP_ACTION[document.type])),
      surface: "signup",
    })
    storeLegalStatus(qc, status)
  } catch {
    return
  }
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
