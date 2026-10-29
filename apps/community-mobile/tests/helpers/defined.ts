import { AssertionError } from "node:assert/strict"

export function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new AssertionError({ message: `expected ${what} to be defined` })
  return value
}
