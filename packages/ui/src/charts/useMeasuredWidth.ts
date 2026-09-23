import { useCallback, useState } from "react"
import type { LayoutChangeEvent } from "react-native"

export interface MeasuredWidth {
  width: number
  onLayout: (event: LayoutChangeEvent) => void
}

export function useMeasuredWidth(): MeasuredWidth {
  const [width, setWidth] = useState(0)
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width)
    setWidth((current) => (current === next ? current : Math.max(0, next)))
  }, [])
  return { width, onLayout }
}
