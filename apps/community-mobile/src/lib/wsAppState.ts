import type { ChatConnState } from "@civfix/ui/data"

/**
 * The mobile chat socket's APP-STATE policy (pure, so it is unit-testable without react-native, expo or
 * a real socket). `src/lib/ws.ts` installs the AppState listener and forwards each transition here.
 *
 * RN's AppStateStatus, restated locally so this module stays free of react-native imports (the union is
 * identical, so the host can pass its `AppStateStatus` straight through).
 */
export type AppLifecycleState = "active" | "background" | "inactive" | "unknown" | "extension"

/** The slice of `ChatSocketCore` this policy drives. */
export interface AppStateSocket {
  getStatus(): ChatConnState
  suspend(): void
  resume(): void
}

/**
 * Apply an app-state transition to the shared socket.
 *
 *  - "background": drop the socket to save battery. The desired rooms + the connection intent survive,
 *    so the foreground resume() reopens and re-joins them.
 *  - "active": come back online IMMEDIATELY.
 *
 * The second half is subtler than it looks. `resume()` only does something when a "background" event
 * previously suspended the core - but iOS fires 'active' after plenty of cycles that never background the
 * app (screen lock while it is frontmost, Control Center / notification shade, an incoming call), and the
 * OS routinely kills the TCP connection during those. The socket is then merely BACKING OFF, and the
 * pre-unification client handled exactly this: on EVERY 'active' with connection intent it reset
 * `attempt`, cleared the pending backoff timer and reconnected at once, instead of letting the user stare
 * at "Offline/Connecting" for the rest of a jittered delay (up to 15 s, and each later gap jittering up
 * to the cap because `attempt` kept climbing).
 *
 * So: when the socket is neither open nor already coming up, cycle suspend()->resume(). That is the only
 * public path to the core's "reset attempt + clear the pending timer + reopen" and it is a NO-OP without
 * connection intent (its reopen is gated on the same intent the old handler checked by hand). The status
 * gate is what keeps it safe:
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
  // A real background->foreground cycle: resume() alone reopens + re-joins with the backoff reset.
  socket.resume()
  if (socket.getStatus() !== "closed") return
  // Foregrounded WITHOUT a preceding background (or resumed into a still-dead socket): kick it now.
  socket.suspend()
  socket.resume()
}
