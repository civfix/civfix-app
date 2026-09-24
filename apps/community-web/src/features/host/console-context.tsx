"use client"

import { createContext, useCallback, useContext, useMemo } from "react"
import type { ReactNode } from "react"
import type {
  CleanupDTO,
  HostCapability,
  OrganizationDTO,
  OrganizationMemberRole,
} from "@civfix/shared"
import { cleanupHostStanding, hasHostCapability, useAuthState } from "@civfix/ui/data"

import {
  hrefForRoute,
  inviteTokenForPath,
  inviteTokenQuery,
  parseConsoleRoute,
} from "@/components/console/route"
import type { ConsoleRoute } from "@/components/console/route"
import {
  navigateConsole,
  useConsolePathname,
  useConsoleQuery,
} from "@/components/console/url-state"
import type { ConsoleParams } from "@/components/console/url-state"

export interface ConsoleNavigation {
  route: ConsoleRoute
  pathname: string
  go: (route: ConsoleRoute, params?: ConsoleParams) => void
}

const NavigationContext = createContext<ConsoleNavigation | null>(null)

export function ConsoleNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = useConsolePathname()
  const query = useConsoleQuery()
  // The invite token is the only piece of the query a route depends on, so the route (and with it
  // the whole nav context) is keyed on it rather than on the raw query: a tab, search or drawer
  // param change re-renders the screen that reads it, not every consumer of useConsoleNavigation.
  const inviteToken = useMemo(() => inviteTokenForPath(pathname, query), [pathname, query])
  const route = useMemo(
    () => parseConsoleRoute(pathname, inviteTokenQuery(inviteToken)),
    [pathname, inviteToken],
  )
  const go = useCallback((next: ConsoleRoute, params?: ConsoleParams) => {
    navigateConsole(hrefForRoute(next), params ?? {})
  }, [])
  const value = useMemo<ConsoleNavigation>(
    () => ({ route, pathname, go }),
    [route, pathname, go],
  )
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

export function useConsoleNavigation(): ConsoleNavigation {
  const value = useContext(NavigationContext)
  if (!value) throw new Error("useConsoleNavigation must be used inside the console shell")
  return value
}

export interface ConsoleEventContext {
  eventId: string
  event: CleanupDTO | null
  can: (capability: HostCapability) => boolean
}

const EventContext = createContext<ConsoleEventContext | null>(null)

export function ConsoleEventProvider({
  eventId,
  event,
  children,
}: {
  eventId: string
  event: CleanupDTO | null
  children: ReactNode
}) {
  const viewerId = useAuthState().user?.id ?? null
  const value = useMemo<ConsoleEventContext>(() => {
    const standing = cleanupHostStanding(event, viewerId)
    return {
      eventId,
      event,
      can: (capability: HostCapability) => hasHostCapability(standing, capability),
    }
  }, [eventId, event, viewerId])
  return <EventContext.Provider value={value}>{children}</EventContext.Provider>
}

export function useConsoleEvent(): ConsoleEventContext {
  const value = useContext(EventContext)
  if (!value) throw new Error("useConsoleEvent must be used inside an event route")
  return value
}

export interface ConsoleOrgContext {
  orgId: string
  org: OrganizationDTO
  myRole: OrganizationMemberRole | null
  isOwner: boolean
  /** Admin OR owner: profile, verification, invites. */
  isAdmin: boolean
  canManage: boolean
  /**
   * Operator-suspended: members keep reading, but the backend refuses every org-scoped write with
   * FORBIDDEN, so the console disables its submit buttons.
   */
  isSuspended: boolean
}

const OrgContext = createContext<ConsoleOrgContext | null>(null)

export function ConsoleOrgProvider({
  org,
  children,
}: {
  org: OrganizationDTO
  children: ReactNode
}) {
  const value = useMemo<ConsoleOrgContext>(() => {
    const myRole = org.myRole ?? null
    const isOwner = myRole === "owner"
    const isAdmin = isOwner || myRole === "admin"
    return {
      orgId: org.id,
      org,
      myRole,
      isOwner,
      isAdmin,
      canManage: isAdmin,
      isSuspended: org.suspended === true,
    }
  }, [org])
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useConsoleOrg(): ConsoleOrgContext {
  const value = useContext(OrgContext)
  if (!value) throw new Error("useConsoleOrg must be used inside an org route")
  return value
}
