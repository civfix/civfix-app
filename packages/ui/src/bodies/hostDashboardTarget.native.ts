import { useNavStore } from "../nav"
import type { HostDashboardTarget } from "./hostDashboardTarget.types"

export function openHostDashboard(target: HostDashboardTarget): void {
  useNavStore.getState().push({ kind: "host-mode", id: target.eventId })
}
