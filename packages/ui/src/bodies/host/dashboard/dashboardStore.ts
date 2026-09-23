import { create } from "zustand"

export interface DashboardState {
  orgId: string | null
  setOrgId: (orgId: string | null) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  orgId: null,
  setOrgId: (orgId) => set({ orgId }),
}))
