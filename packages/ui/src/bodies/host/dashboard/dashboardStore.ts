import { create } from "zustand"
import type { DashboardRange, DashboardTab } from "./dashboardModel"
import { DEFAULT_DASHBOARD_RANGE } from "./dashboardModel"

export interface BroadcastPreset {
  eventId: string
  segment: "all_registered"
  email: boolean
}

export interface DashboardState {
  tab: DashboardTab
  orgId: string | null
  range: DashboardRange
  broadcastPreset: BroadcastPreset | null
  setTab: (tab: DashboardTab) => void
  setOrgId: (orgId: string | null) => void
  setRange: (range: DashboardRange) => void
  setBroadcastPreset: (preset: BroadcastPreset | null) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  tab: "personal",
  orgId: null,
  range: DEFAULT_DASHBOARD_RANGE,
  broadcastPreset: null,
  setTab: (tab) => set({ tab }),
  setOrgId: (orgId) => set({ orgId }),
  setRange: (range) => set({ range }),
  setBroadcastPreset: (broadcastPreset) => set({ broadcastPreset }),
}))

export function emailAttendeesPreset(eventId: string): BroadcastPreset {
  return { eventId, segment: "all_registered", email: true }
}
