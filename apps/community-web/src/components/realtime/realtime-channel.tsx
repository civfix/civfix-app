"use client"

import { useRealtimeChannel } from "@/hooks/use-realtime-channel"

/** Mounted in the providers so the per-user socket stays open for the app's lifetime while signed in. */
export function RealtimeChannel() {
  useRealtimeChannel()
  return null
}
