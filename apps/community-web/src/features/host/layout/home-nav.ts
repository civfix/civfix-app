"use client"

import { useMemo } from "react"
import { Building2, CalendarDays, Plus } from "lucide-react"
import type { OrganizationDTO } from "@civfix/shared"

import { hrefForRoute } from "@/components/console/route"

import type { ConsoleNavItem } from "./nav-items"

export interface ConsoleHomeNavLabels {
  portfolio: string
  /** Appends the "New organization" entry when given. */
  newOrg?: string
}

/** The nav of the screens outside any one org or event: the portfolio, then one entry per org. */
export function useConsoleHomeNav(
  orgs: readonly OrganizationDTO[] | undefined,
  { portfolio, newOrg }: ConsoleHomeNavLabels,
): ConsoleNavItem[] {
  return useMemo<ConsoleNavItem[]>(() => {
    const items: ConsoleNavItem[] = [
      {
        id: "portfolio",
        label: portfolio,
        icon: CalendarDays,
        href: hrefForRoute({ kind: "portfolio" }),
      },
    ]
    for (const org of orgs ?? []) {
      items.push({
        id: `org:${org.id}`,
        label: org.name,
        icon: Building2,
        href: hrefForRoute({ kind: "org", orgId: org.id, section: "overview" }),
      })
    }
    if (newOrg !== undefined) {
      items.push({
        id: "org-new",
        label: newOrg,
        icon: Plus,
        href: hrefForRoute({ kind: "org-new" }),
      })
    }
    return items
  }, [orgs, portfolio, newOrg])
}
