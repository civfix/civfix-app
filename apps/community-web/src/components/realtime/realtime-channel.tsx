"use client"

import { useRealtimeChannel } from "@/hooks/use-realtime-channel"

/**
 * Mounts the always-on per-user realtime channel for the app's lifetime (renders nothing). Placed in
 * the providers next to <AuthHydrator/> so the socket is held open while authenticated and per-user
 * signal frames invalidate the relevant queries app-wide. See useRealtimeChannel.
 */
export function RealtimeChannel() {
  useRealtimeChannel()
  return null
}
