import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { invalidationKeysForTopic } from "@civfix/ui/data"
import { chatSocket } from "@/lib/ws"
import { useAuthStore } from "@/store/authStore"

export function useRealtimeChannel(): void {
  const authed = useAuthStore((s) => s.status === "authed")
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!authed) return

    chatSocket.retain()

    const unsubscribe = chatSocket.subscribe((frame) => {
      if (frame.type !== "signal") return
      for (const queryKey of invalidationKeysForTopic(frame.topic, undefined, frame.id)) {
        void queryClient.invalidateQueries({ queryKey })
      }
    })

    return () => {
      unsubscribe()
      chatSocket.release()
    }
  }, [authed, queryClient])
}
