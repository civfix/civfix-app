import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import type {
  AcceptLegalRequest,
  AcceptLegalResponse,
  LegalDocumentDTO,
  LegalDocumentType,
  LegalVersionOutdatedDetails,
  MyLegalStatusResponse,
} from "@civfix/contract"

export function useLegalDocuments(_options: { enabled?: boolean } = {}): UseQueryResult<LegalDocumentDTO[]> {
  throw new Error("not implemented")
}

export function useLegalDocument(_type: LegalDocumentType, _version?: string): UseQueryResult<LegalDocumentDTO | null> {
  throw new Error("not implemented")
}

export function useMyLegalStatus(): UseQueryResult<MyLegalStatusResponse> {
  throw new Error("not implemented")
}

export function useAcceptLegal(): UseMutationResult<AcceptLegalResponse, unknown, AcceptLegalRequest> {
  throw new Error("not implemented")
}

export function outdatedLegalVersions(_err: unknown): LegalVersionOutdatedDetails["current"] | null {
  throw new Error("not implemented")
}
