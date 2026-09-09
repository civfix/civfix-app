"use client"

import { useEffect, useState } from "react"
import { DEFAULT_COLOR_SCHEME, resolveSchemeName } from "@civfix/ui/theme/schemes"
import type { ColorSchemeName } from "@civfix/ui/theme/schemes"

export function readColorScheme(): ColorSchemeName {
  if (typeof document === "undefined") return DEFAULT_COLOR_SCHEME
  return resolveSchemeName(document.documentElement.classList.contains("dark") ? "dark" : "light")
}

export function useColorScheme(): ColorSchemeName {
  const [scheme, setScheme] = useState<ColorSchemeName>(DEFAULT_COLOR_SCHEME)

  useEffect(() => {
    if (typeof document === "undefined") return
    const apply = () => setScheme(readColorScheme())
    apply()
    if (typeof MutationObserver === "undefined") return
    const observer = new MutationObserver(apply)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [])

  return scheme
}
