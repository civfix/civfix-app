import { useNavStore } from "../nav"

export interface HostDashboardTarget {
  eventId: string
}

export function openHostDashboard(target: HostDashboardTarget): void {
  useNavStore.getState().push({ kind: "host-mode", id: target.eventId })
}
