import React, { useCallback, useMemo, useRef, useState } from "react"
import { SharePostContext } from "./SharePostContext"
import { SharePostSheet } from "./SharePostSheet"
import type { SharePostHandle, SharePostTarget } from "./types"

export interface SharePostProviderProps {
  children: React.ReactNode
}

export function SharePostProvider({ children }: SharePostProviderProps) {
  const [target, setTarget] = useState<SharePostTarget | null>(null)
  const [visible, setVisible] = useState(false)
  const visibleRef = useRef(false)

  const open = useCallback((next: SharePostTarget) => {
    visibleRef.current = true
    setTarget(next)
    setVisible(true)
  }, [])

  const close = useCallback(() => {
    visibleRef.current = false
    setVisible(false)
  }, [])

  const release = useCallback(() => {
    if (!visibleRef.current) setTarget(null)
  }, [])

  const value = useMemo<SharePostHandle>(() => ({ open }), [open])

  return (
    <SharePostContext.Provider value={value}>
      {children}
      {target ? <SharePostSheet visible={visible} target={target} onClose={close} onClosed={release} /> : null}
    </SharePostContext.Provider>
  )
}
