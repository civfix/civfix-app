// Plain index scans, not `/\/+$/`: a backtracking regex retries the slash run from every start
// position, so a long run of slashes that isn't trailing costs quadratic time (CodeQL
// js/polynomial-redos).
export function stripTrailingSlashes(value: string): string {
  let end = value.length
  while (end > 0 && value[end - 1] === "/") end--
  return value.slice(0, end)
}

export function trimSlashes(value: string): string {
  let start = 0
  while (start < value.length && value[start] === "/") start++
  return stripTrailingSlashes(value.slice(start))
}
