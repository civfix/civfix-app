"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { invalidationKeysForTopic } from "@civfix/ui/data"

import { chatSocket } from "@/lib/ws"
import { useIsAuthenticated } from "@/hooks/use-auth"

const HOST_SIGNAL_EXTRA_KEYS = { host: [["hosted-events"] as const] } as const

export function useRealtimeChannel(): void {
  const isAuthenticated = useIsAuthenticated()
  const queryClient = useQueryClient()

  React.useEffect(() => {
    if (!isAuthenticated) {
      chatSocket.disconnect()
      return
    }

    chatSocket.connect()

    const unsubscribe = chatSocket.subscribe((frame) => {
      if (frame.type !== "signal") return
      for (const queryKey of invalidationKeysForTopic(frame.topic, HOST_SIGNAL_EXTRA_KEYS, frame.id)) {
        void queryClient.invalidateQueries({ queryKey })
      }
    })

    return () => {
      unsubscribe()
    }
  }, [isAuthenticated, queryClient])
}
