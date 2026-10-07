export interface FormIssue {
  path: readonly PropertyKey[]
  message: string
}

/**
 * "field" keys an issue by its top-level request field, for forms whose inputs map one-to-one onto
 * top-level fields; "path" keys it by the full dotted path, for forms with nested inputs (the org
 * profile's `socialLinks.instagram`). A path-less issue lands on "form" either way.
 */
export type IssueKeyDepth = "field" | "path"

function issueKey(path: readonly PropertyKey[], depth: IssueKeyDepth): string {
  if (depth === "field") return String(path[0] ?? "form")
  return path.length === 0 ? "form" : path.map(String).join(".")
}

/**
 * The first message per key, on top of `seed`: a key the seed already holds keeps its message, so
 * a form's own checks take precedence over the schema's.
 */
export function firstIssueByPath(
  issues: readonly FormIssue[],
  depth: IssueKeyDepth,
  seed: Record<string, string> = {},
): Record<string, string> {
  const out = { ...seed }
  for (const issue of issues) {
    const key = issueKey(issue.path, depth)
    if (!out[key]) out[key] = issue.message
  }
  return out
}
