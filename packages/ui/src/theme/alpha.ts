const SHORT_HEX = /^[0-9a-fA-F]{3}$/
const LONG_HEX = /^[0-9a-fA-F]{6}$/

export function alpha(hex: string, amount: number): string {
  const value = hex.trim().replace("#", "")
  const expanded = SHORT_HEX.test(value) ? value.replace(/./g, "$&$&") : value
  if (!LONG_HEX.test(expanded)) return hex
  const int = Number.parseInt(expanded, 16)
  const clamped = Number.isFinite(amount) ? Math.min(1, Math.max(0, amount)) : 1
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${clamped})`
}
