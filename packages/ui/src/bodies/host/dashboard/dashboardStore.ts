import { create } from "zustand"

export interface BroadcastPreset {
  eventId: string
  segment: "all_registered"
  email: boolean
}

export interface DashboardState {
  orgId: string | null
  broadcastPreset: BroadcastPreset | null
  setOrgId: (orgId: string | null) => void
  setBroadcastPreset: (preset: BroadcastPreset | null) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  orgId: null,
  broadcastPreset: null,
  setOrgId: (orgId) => set({ orgId }),
  setBroadcastPreset: (broadcastPreset) => set({ broadcastPreset }),
}))

export function emailAttendeesPreset(eventId: string): BroadcastPreset {
  return { eventId, segment: "all_registered", email: true }
}
