const LEGAL_DOCUMENT_PATH = /^\/legal\/[^/]+$/

/** The in-app legal screen's route, `app/legal/[type]`, whatever type it names. */
export function isLegalDocumentPath(pathname: string): boolean {
  return LEGAL_DOCUMENT_PATH.test(pathname)
}
