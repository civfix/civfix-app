import type { ChatConnState } from "@civfix/ui/data"
import type { AppLifecycleState } from "@/lib/lifecycleTypes"

export interface AppStateSocket {
  getStatus(): ChatConnState
  suspend(): void
  resume(): void
}

/**
 * iOS fires 'active' after cycles that never background the app (screen lock, Control Center, a call) yet
 * still drop the TCP connection, and `resume()` is a no-op without a prior suspend, so the socket would sit
 * out the rest of its jittered backoff. Cycling suspend() then resume() resets the backoff and reopens, and
 * is a no-op without connection intent. The status gate keeps it safe:
 *   - "open"       -> healthy socket; touching it would drop a live connection and re-join every room.
 *   - "connecting" -> a handshake/transport open is already in flight; suspend() there would abandon it
 *                     mid-flight and could race a second socket.
 *   - "closed"     -> mobile's `statusWhileBackingOff`, i.e. exactly the backing-off (or intentless)
 *                     case, where no socket and no in-flight open exist. Safe to kick.
 */
export function applyAppStateTransition(next: AppLifecycleState, socket: AppStateSocket): void {
  if (next === "background") {
    socket.suspend()
    return
  }
  if (next !== "active") return
  socket.resume()
  if (socket.getStatus() !== "closed") return
  socket.suspend()
  socket.resume()
}
