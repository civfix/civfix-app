"use client"

import { Suspense, lazy, useMemo } from "react"
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  ExternalLink,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { OrganizationDTO } from "@civfix/shared"
import { useMyOrganizations } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { ORG_MANAGE_SECTIONS, ORG_SECTIONS, hrefForRoute } from "@/components/console/route"
import type { OrgSection } from "@/components/console/route"
import { useGate } from "@/components/console/query-state"
import { LoadingState, NoAccessState, NotFoundState, StateGate } from "@/components/console/states"
import { Chip } from "@/components/console/chips/chip"

import { ConsoleShell } from "../layout/console-shell"
import { Breadcrumbs } from "../layout/breadcrumbs"
import { OrgSwitcher } from "../layout/org-switcher"
import type { ConsoleNavItem } from "../layout/nav-items"
import { ConsoleOrgProvider, useConsoleNavigation } from "../console-context"
import { OrgOverview } from "./org-overview"
import { OrgEventsSection } from "./org-events-section"
import { MembersScreen } from "./members-screen"
import { publicOrgPath } from "./org-slug"
import { SuspendedBanner } from "./suspended-banner"

const VerificationScreen = lazy(() =>
  import("./verification-screen").then((m) => ({ default: m.VerificationScreen })),
)
const OrgSettingsScreen = lazy(() =>
  import("./org-settings-screen").then((m) => ({ default: m.OrgSettingsScreen })),
)

const SECTION_ICON: Record<OrgSection, LucideIcon> = {
  overview: LayoutDashboard,
  events: CalendarDays,
  members: Users,
  verification: BadgeCheck,
  settings: Settings,
}

const BOTTOM_TAB_ORDER: readonly OrgSection[] = ["overview", "events", "members", "verification", "settings"]

export interface OrgScreenProps {
  orgId: string
  section: OrgSection
}

export function OrgScreen({ orgId, section }: OrgScreenProps) {
  const { t } = useT("host-org")
  const { t: tc } = useT("host-common")
  const { go } = useConsoleNavigation()

  const orgs = useMyOrganizations()
  const gate = useGate(orgs)
  const org: OrganizationDTO | null = (orgs.data ?? []).find((entry) => entry.id === orgId) ?? null

  const canManage = org?.myRole === "owner" || org?.myRole === "admin"

  const navItems = useMemo<ConsoleNavItem[]>(() => {
    const items: ConsoleNavItem[] = [
      {
        id: "portfolio",
        label: t("nav.events"),
        icon: Building2,
        href: hrefForRoute({ kind: "portfolio" }),
      },
    ]
    for (const id of ORG_SECTIONS) {
      if (ORG_MANAGE_SECTIONS.includes(id) && !canManage) continue
      items.push({
        id,
        label: t(`nav.${id}`, {
          defaultValue: { events: "Events", verification: "Verification", settings: "Settings" }[
            id as "events" | "verification" | "settings"
          ],
        }),
        icon: SECTION_ICON[id],
        href: hrefForRoute({ kind: "org", orgId, section: id }),
      })
    }
    return items
  }, [canManage, orgId, t])

  const bottomTabs = useMemo(
    () =>
      BOTTOM_TAB_ORDER.map((id) => navItems.find((item) => item.id === id)).filter(
        (item): item is ConsoleNavItem => item !== undefined,
      ),
    [navItems],
  )

  const allowed = !ORG_MANAGE_SECTIONS.includes(section) || canManage

  return (
    <ConsoleShell
      navItems={navItems}
      bottomTabs={bottomTabs.length > 0 ? bottomTabs : navItems.slice(0, 5)}
      activeId={section}
      title={org?.name ?? tc("state.loading")}
      headerActions={
        <>
          {org ? (
            <a
              href={publicOrgPath(org.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-9 items-center gap-1.5 rounded-sm border border-console-line bg-console-surface px-token-3 text-token-13 font-semibold text-console-ink-2 transition-colors duration-d1 hover:bg-console-surface-alt hover:text-console-ink focus-visible:outline-none focus-visible:shadow-console-ring md:inline-flex"
            >
              <ExternalLink aria-hidden className="h-3.5 w-3.5" />
              {t("header.public_page", { defaultValue: "Public page" })}
            </a>
          ) : null}
          <OrgSwitcher orgId={orgId} section={section} />
        </>
      }
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: t("breadcrumb.events"), href: hrefForRoute({ kind: "portfolio" }) },
            { label: org?.name ?? "…" },
          ]}
        />
      }
      subtitle={
        org ? (
          <>
            <span>{`@${org.slug}`}</span>
            <Chip kind="org-verification" value={org.verifiedStatus} size="sm" />
            {org.verifiedKind ? <Chip kind="org-kind" value={org.verifiedKind} size="sm" /> : null}
            {org.myRole ? <Chip kind="org-role" value={org.myRole} size="sm" /> : null}
          </>
        ) : undefined
      }
    >
      <StateGate
        {...gate}
        onRetry={() => void orgs.refetch()}
        skeleton={<LoadingState count={5} />}
        // Not while a refetch is in flight: right after a create or an invite accept the list is
        // being reloaded, and the stale copy would say "not found" for the length of the round trip.
        notFound={orgs.isSuccess && !orgs.isFetching && org === null}
        notFoundState={
          <NotFoundState
            title={t("not_found_title")}
            body={t("not_found_body")}
            onExit={() => go({ kind: "portfolio" })}
          />
        }
      >
        {org === null ? null : !allowed ? (
          <NoAccessState
            title={t("no_access_title", { defaultValue: "Owners and admins only" })}
            body={t("no_access_body", {
              defaultValue: "Ask an owner or admin of this organization to make the change.",
            })}
            exitLabel={t("nav.overview")}
            onExit={() => go({ kind: "org", orgId, section: "overview" })}
          />
        ) : (
          <ConsoleOrgProvider org={org}>
            {org.suspended ? (
              <div className="mb-token-5">
                <SuspendedBanner />
              </div>
            ) : null}
            <Suspense fallback={<LoadingState count={5} />}>
              <OrgSectionScreen section={section} />
            </Suspense>
          </ConsoleOrgProvider>
        )}
      </StateGate>
    </ConsoleShell>
  )
}

function OrgSectionScreen({ section }: { section: OrgSection }) {
  switch (section) {
    case "overview":
      return <OrgOverview />
    case "events":
      return <OrgEventsSection />
    case "members":
      return <MembersScreen />
    case "verification":
      return <VerificationScreen />
    case "settings":
      return <OrgSettingsScreen />
  }
}
