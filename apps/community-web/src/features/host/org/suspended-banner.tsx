"use client"

import { ShieldAlert } from "lucide-react"
import { useT } from "@civfix/ui/i18n"

type Translate = (key: string, options?: Record<string, unknown>) => string

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

/** Shown above every org section while `OrganizationDTO.suspended` is true. */
export function SuspendedBanner() {
  const { t } = useT("host-org")
  return (
    <div
      role="status"
      className="flex items-start gap-token-3 rounded-sm border border-console-sun-strong/40 bg-console-sun-soft px-token-4 py-token-3"
    >
      <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-console-sun-strong" />
      <div className="min-w-0 flex-1">
        <p className="text-token-13 font-bold text-console-ink">
          {t("suspended.title", { defaultValue: "This organization is suspended by civfix." })}
        </p>
        <p className="text-token-12 text-console-ink-2">
          {t("suspended.body", {
            defaultValue:
              "Members can view but not change it. Events, invites, verification and settings are read-only until the suspension is lifted.",
          })}
        </p>
      </div>
    </div>
  )
}
