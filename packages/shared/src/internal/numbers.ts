export function intOr(value: unknown, min: number, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min ? value : fallback
}
