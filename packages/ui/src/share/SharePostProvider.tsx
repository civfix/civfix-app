import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { SharePostContext } from "./SharePostContext"
import { SharePostSheet } from "./SharePostSheet"
import type { SharePostHandle, SharePostTarget } from "./types"

export interface SharePostProviderProps {
  children: React.ReactNode
}

const RELEASE_AFTER_CLOSE_MS = 400

export function SharePostProvider({ children }: SharePostProviderProps) {
  const [target, setTarget] = useState<SharePostTarget | null>(null)
  const [visible, setVisible] = useState(false)

  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelRelease = useCallback(() => {
    if (releaseTimer.current === null) return
    clearTimeout(releaseTimer.current)
    releaseTimer.current = null
  }, [])
  useEffect(() => cancelRelease, [cancelRelease])

  const open = useCallback(
    (next: SharePostTarget) => {
      cancelRelease()
      setTarget(next)
      setVisible(true)
    },
    [cancelRelease],
  )

  const close = useCallback(() => {
    setVisible(false)
    cancelRelease()
    releaseTimer.current = setTimeout(() => {
      releaseTimer.current = null
      setTarget(null)
    }, RELEASE_AFTER_CLOSE_MS)
  }, [cancelRelease])

  const value = useMemo<SharePostHandle>(() => ({ open }), [open])

  return (
    <SharePostContext.Provider value={value}>
      {children}
      {target ? <SharePostSheet visible={visible} target={target} onClose={close} /> : null}
    </SharePostContext.Provider>
  )
}
