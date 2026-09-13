import type { ReactNode } from "react"

export interface ZoomableMediaProps {
  contentWidth: number
  contentHeight: number
  viewportWidth: number
  viewportHeight: number
  resetToken: string | number
  maxScale?: number
  children: ReactNode
}
