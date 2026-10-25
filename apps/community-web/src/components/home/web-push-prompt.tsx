"use client"

import * as React from "react"
import { PushPromptCard } from "@civfix/ui"
import { usePushPermission } from "@civfix/ui/capabilities"
import { useAuthState } from "@civfix/ui/data"

import { markPushPromptSeen, pushPromptSeen } from "@/lib/push-prompt"

/**
 * Browsers only prompt from a click, and an OAuth sign-in comes back through a full page load, so the ask
 * is a card on the first signed-in page view in a browser that supports push and was never asked.
 */
export function WebPushPrompt() {
  const { isAuthenticated } = useAuthState()
  const [seen, setSeen] = React.useState(pushPromptSeen)

  const finish = React.useCallback(() => {
    markPushPromptSeen()
    setSeen(true)
  }, [])

  if (seen || !isAuthenticated) return null
  return <PushPromptGate onFinish={finish} />
}

// Reads the permission only once the card could show: the read asks the backend for its push key, which
// needs a signed-in session.
function PushPromptGate({ onFinish }: { onFinish: () => void }) {
  const push = usePushPermission()

  const turnOn = React.useCallback(() => {
    void push.request().finally(onFinish)
  }, [push, onFinish])

  if (push.status !== "undetermined") return null
  return <PushPromptCard onTurnOn={turnOn} onNotNow={onFinish} onClose={onFinish} />
}
