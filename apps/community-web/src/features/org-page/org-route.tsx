"use client"

import * as React from "react"

import { HomeShell } from "@/components/home/home-shell"

import { OrgPageLoading, OrgPageView } from "./org-page-view"
import { isOrgManagePath } from "./org-page-slug"

export function OrgRoute() {
  const [manage, setManage] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    setManage(isOrgManagePath(window.location.pathname))
  }, [])

  if (manage === null) return <OrgPageLoading />
  return manage ? <HomeShell /> : <OrgPageView />
}
