import { Platform } from "react-native"
import { useKeyboardAnchor } from "./useKeyboardAnchor.native"
import type { KeyboardReserveOptions } from "./useKeyboardReserve.types"

function useZeroReserve(_options: KeyboardReserveOptions = {}): number {
  return 0
}

function useWindowOverlapReserve({
  enabled = true,
  restOffset = 0,
}: KeyboardReserveOptions = {}): number {
  return useKeyboardAnchor({ enabled, restOffset, gap: 0 }).reserved
}

export const useKeyboardReserve: (options?: KeyboardReserveOptions) => number =
  Platform.OS === "ios" ? useZeroReserve : useWindowOverlapReserve

export type { KeyboardReserveOptions, WebOnlyKeyboardReserveOptions } from "./useKeyboardReserve.types"
