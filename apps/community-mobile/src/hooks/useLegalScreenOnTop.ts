import { usePathname } from "expo-router"
import { isLegalDocumentPath } from "@/lib/legalRoute"

/**
 * The onboarding and first-run gates cover the whole stack, so a legal document opened from either is
 * pushed underneath them; they step aside while it is on top and come back, as they were, when it closes.
 */
export function useLegalScreenOnTop(): boolean {
  return isLegalDocumentPath(usePathname())
}
