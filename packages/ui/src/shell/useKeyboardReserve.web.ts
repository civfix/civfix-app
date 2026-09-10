import { useKeyboardAnchor } from "./useKeyboardAnchor.web"
import type { WebOnlyKeyboardReserveOptions } from "./useKeyboardReserve.types"

export function useKeyboardReserve({
  enabled = true,
  restOffset = 0,
  hostReserved = false,
}: WebOnlyKeyboardReserveOptions = {}): number {
  return useKeyboardAnchor({ enabled, restOffset, gap: 0, hostReserved }).reserved
}

export type { KeyboardReserveOptions, WebOnlyKeyboardReserveOptions } from "./useKeyboardReserve.types"
