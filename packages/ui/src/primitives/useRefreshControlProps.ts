import { useMemo } from "react"
import type { RefreshControlProps } from "react-native"
import { useTheme } from "../theme"

export type ThemedRefreshControlProps = Required<
  Pick<RefreshControlProps, "tintColor" | "colors" | "progressBackgroundColor">
>

export function useRefreshControlProps(): ThemedRefreshControlProps {
  const th = useTheme()
  return useMemo(
    () => ({
      tintColor: th.colors.text,
      colors: [th.colors.text],
      progressBackgroundColor: th.colors.surface,
    }),
    [th],
  )
}
