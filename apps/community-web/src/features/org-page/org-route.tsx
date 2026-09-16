"use client"

import * as React from "react"

import { HomeShell } from "@/components/home/home-shell"

import { OrgPageView } from "./org-page-view"
import { isOrgManagePath } from "./org-page-slug"

/**
 * The /orgs/[...slug] catch-all serves two surfaces: the standalone PUBLIC organization page, and the
 * in-app management body at /orgs/<slug>/manage, which is a shared @civfix/ui body and therefore needs
 * the app shell around it. Under the static export the shell HTML is emitted once for /orgs/_/, so the
 * choice is made from the live URL after mount - the same deferral OrgPageView already uses to read the
 * slug.
 */
export function OrgRoute() {
  const [manage, setManage] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    setManage(isOrgManagePath(window.location.pathname))
  }, [])

  if (manage === null) return null
  return manage ? <HomeShell /> : <OrgPageView />
}
