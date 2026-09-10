export interface KeyboardReserveOptions {
  enabled?: boolean
  restOffset?: number
}

export interface WebOnlyKeyboardReserveOptions extends KeyboardReserveOptions {
  hostReserved?: boolean
}
