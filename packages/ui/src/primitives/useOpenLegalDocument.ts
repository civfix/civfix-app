import { useCallback } from "react"
import type { LegalDocumentType } from "@civfix/contract"
import { useOpenExternal } from "../capabilities"
import { legalDocumentUrl, presentLegalDocument } from "./legalDocument"

export function useOpenLegalDocument(): (type: LegalDocumentType) => void {
  const openExternal = useOpenExternal()
  return useCallback(
    (type: LegalDocumentType) => {
      if (presentLegalDocument(type)) return
      void openExternal?.open(legalDocumentUrl(type))
    },
    [openExternal],
  )
}
