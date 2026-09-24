export type Translate = (key: string, options?: Record<string, unknown>) => string

/**
 * The FORBIDDEN copy for a write against a suspended org. The backend refuses every org-scoped
 * write while the flag is set (DECISIONS §32); the buttons are disabled too, so this only shows when
 * the suspension landed after the page loaded.
 */
export function suspendedForbiddenCopy(t: Translate): string {
  return t("suspended.error_forbidden", {
    defaultValue: "This organization is suspended, so it can't be changed right now.",
  })
}
