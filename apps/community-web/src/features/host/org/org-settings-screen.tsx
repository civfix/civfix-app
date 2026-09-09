"use client"

import { useT } from "@civfix/ui/i18n"

import { useConsoleNavigation, useConsoleOrg } from "../console-context"
import { OrgProfileForm } from "./org-profile-form"

export function OrgSettingsScreen() {
  const { t } = useT("host-org")
  const { org, orgId, isSuspended } = useConsoleOrg()
  const { go } = useConsoleNavigation()

  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="mb-token-4 text-token-13 text-console-ink-3">
        {t("settings.intro", {
          defaultValue:
            "Changes show on the public page and on every event linked to this organization.",
        })}
      </p>
      <OrgProfileForm
        mode="edit"
        org={org}
        disabled={isSuspended}
        onSaved={() => go({ kind: "org", orgId, section: "overview" })}
      />
    </div>
  )
}
