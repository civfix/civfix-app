"use client"

import { useMyOrganizations } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { hrefForRoute } from "@/components/console/route"

import { ConsoleShell } from "../layout/console-shell"
import { Breadcrumbs } from "../layout/breadcrumbs"
import { OrgSwitcher } from "../layout/org-switcher"
import { useConsoleHomeNav } from "../layout/home-nav"
import { MAX_BOTTOM_TABS } from "../layout/nav-items"
import { useConsoleNavigation } from "../console-context"
import { OrgProfileForm } from "./org-profile-form"

/** The URL flag the overview reads to open with the post-creation "next steps" card expanded. */
const ORG_WELCOME_PARAM = { tab: "welcome" } as const

export function CreateOrgScreen() {
  const { t } = useT("host-org")
  const { go } = useConsoleNavigation()
  const orgs = useMyOrganizations()

  const navItems = useConsoleHomeNav(orgs.data, {
    portfolio: t("nav.events"),
    newOrg: t("nav.new_org", { defaultValue: "New organization" }),
  })

  return (
    <ConsoleShell
      navItems={navItems}
      bottomTabs={navItems.slice(0, MAX_BOTTOM_TABS)}
      activeId="org-new"
      title={t("create.title", { defaultValue: "New organization" })}
      subtitle={t("create.subtitle", {
        defaultValue: "Host events under a shared name, invite teammates and get verified.",
      })}
      headerActions={<OrgSwitcher orgId={null} />}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: t("breadcrumb.events"), href: hrefForRoute({ kind: "portfolio" }) },
            { label: t("create.title", { defaultValue: "New organization" }) },
          ]}
        />
      }
    >
      <div className="mx-auto w-full max-w-3xl">
        <OrgProfileForm
          mode="create"
          onSaved={(org) =>
            go({ kind: "org", orgId: org.id, section: "overview" }, ORG_WELCOME_PARAM)
          }
          onCancel={() => go({ kind: "portfolio" })}
        />
      </div>
    </ConsoleShell>
  )
}
