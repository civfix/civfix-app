/**
 * Forward-email template palette + interpolation. A jurisdiction can override the subject/body of the
 * email civfix forwards to a routing contact (PatchJurisdictionRequest.forwardSubjectTemplate /
 * forwardBodyTemplate; the stored override lives on JurisdictionDirectoryDTO). Operators author the
 * template using `{curly}` tokens. This module is the single source of truth for which tokens exist
 * (FORWARD_TEMPLATE_VARIABLES — rendered as the clickable chip legend in the admin editor) and the pure
 * function that renders a template against a value map (interpolateForwardTemplate — used for the live
 * preview in the admin editor and by the backend when it actually sends the mail).
 */

/** One substitution variable available in a forward-email template. */
export interface ForwardTemplateVariable {
  /** The exact token the operator types, in `{curly}` form (e.g. `{referenceCode}`). */
  token: string
  /** Short human label for the chip legend. */
  label: string
  /** One-line description of what the token expands to. */
  description: string
}

/**
 * The full palette of substitution variables for a forward-email template, in editor-legend order.
 * Each `token` is the literal `{curly}` string the operator types; interpolateForwardTemplate replaces
 * exactly these (any other `{token}` is left untouched so typos surface in the live preview).
 */
export const FORWARD_TEMPLATE_VARIABLES: readonly ForwardTemplateVariable[] = [
  {
    token: "{referenceCode}",
    label: "Reference code",
    description: "The report's public reference code (e.g. CVX-2K4P).",
  },
  { token: "{reportId}", label: "Report ID", description: "The report's internal id." },
  {
    token: "{shortId}",
    label: "Short ID",
    description: "The short, human-friendly id for the report.",
  },
  { token: "{title}", label: "Title", description: "The report's title / summary line." },
  {
    token: "{category}",
    label: "Category",
    description: "The report category label (e.g. Pothole, Graffiti).",
  },
  { token: "{status}", label: "Status", description: "The report's current status." },
  { token: "{place}", label: "Place", description: "The human-readable place / neighborhood name." },
  { token: "{address}", label: "Address", description: "The street address of the report location." },
  {
    token: "{coordinates}",
    label: "Coordinates",
    description: "The latitude, longitude pair as text.",
  },
  { token: "{lat}", label: "Latitude", description: "The report location's latitude." },
  { token: "{lng}", label: "Longitude", description: "The report location's longitude." },
  {
    token: "{mapLink}",
    label: "Map link",
    description: "A URL that opens the report location on a map.",
  },
  {
    token: "{description}",
    label: "Description",
    description: "The reporter's full description of the issue.",
  },
  {
    token: "{reporterName}",
    label: "Reporter name",
    description: "The display name of the person who reported it.",
  },
  {
    token: "{confirmations}",
    label: "Confirmations",
    description: "How many neighbors confirmed the report.",
  },
  {
    token: "{submittedDate}",
    label: "Submitted date",
    description: "When the report was submitted.",
  },
  {
    token: "{jurisdictionName}",
    label: "Jurisdiction name",
    description: "The name of the routing jurisdiction.",
  },
  { token: "{dept}", label: "Department", description: "The receiving department name." },
  {
    token: "{operatorNote}",
    label: "Operator note",
    description: "The optional note the operator added when forwarding.",
  },
  {
    token: "{photoLinks}",
    label: "Photo links",
    description: "Newline-separated URLs to the report's photos.",
  },
  {
    token: "{photoCount}",
    label: "Photo count",
    description: "The number of photos attached to the report.",
  },
] as const

/** Escape a string so it can be embedded literally in a RegExp (the `{`/`}` in tokens are the point). */
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// One pre-built matcher for every KNOWN token. Each alternative includes the closing brace, so the
// `}` delimiter prevents `{report}` from partially matching inside `{reportId}` and vice versa.
const FORWARD_TEMPLATE_TOKEN_RE = new RegExp(
  FORWARD_TEMPLATE_VARIABLES.map((v) => escapeRegExp(v.token)).join("|"),
  "g",
)

/**
 * Render a forward-email template: replace every KNOWN `{token}` (exactly the ones in
 * FORWARD_TEMPLATE_VARIABLES) with `values[bareName] ?? ""`, where `bareName` is the token without its
 * braces (e.g. `{referenceCode}` -> `values.referenceCode`). Any UNKNOWN `{token}` is left verbatim so
 * an operator's typo surfaces in the live preview instead of silently vanishing. Pure + dependency-free.
 *
 * SECURITY: the output is raw, unescaped text. Callers that inject the result into an HTML email body
 * MUST HTML-escape it (or escape the individual `values` beforehand) — this helper does no escaping.
 */
export function interpolateForwardTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(FORWARD_TEMPLATE_TOKEN_RE, (match) => {
    const bareName = match.slice(1, -1)
    return values[bareName] ?? ""
  })
}
