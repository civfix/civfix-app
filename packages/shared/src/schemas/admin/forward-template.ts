import { z } from "zod"

/**
 * Forward-email template palette, defaults, validation and interpolation. Operators author templates
 * with single-brace `{token}` placeholders drawn from FORWARD_TEMPLATE_VARIABLES; forwardTemplateIssues
 * is the boundary check (linear scan, no regex backtracking) behind ForwardTemplateSubjectSchema /
 * ForwardTemplateBodySchema, and FORWARD_TEMPLATE_SAMPLE_VALUES is the static sample every preview
 * renders with. Resolution at send time is jurisdiction template -> stored default -> DEFAULT_FORWARD_*.
 *
 * SECURITY: interpolateForwardTemplate returns raw, unescaped text. Any caller that injects the result
 * into an HTML email body MUST HTML-escape it (the backend's email block builders do).
 */


export interface ForwardTemplateVariable {
  token: string
  label: string
  description: string
}

export const FORWARD_TEMPLATE_VARIABLES: readonly ForwardTemplateVariable[] = [
  {
    token: "{referenceCode}",
    label: "Reference code",
    description: "The report's public reference code (e.g. DU-42-000123).",
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
    description: "The report category label (e.g. Trash, Graffiti, Hazard).",
  },
  { token: "{status}", label: "Status", description: "The report's current status label." },
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

export const FORWARD_TEMPLATE_VARIABLE_NAMES: readonly string[] = FORWARD_TEMPLATE_VARIABLES.map((v) =>
  v.token.slice(1, -1),
)

export type ForwardTemplateValues = Record<string, string>

export const FORWARD_TEMPLATE_SAMPLE_VALUES: Readonly<ForwardTemplateValues> = {
  referenceCode: "DU-42-000123",
  reportId: "9f3a2c1e-7b4d-4c8a-9e21-5d6f7a8b9c0d",
  shortId: "9f3a2c1e",
  title: "Overflowing bin at 5th & Main",
  category: "Trash",
  status: "Published",
  place: "Los Angeles, CA",
  address: "500 S Main St, Los Angeles, CA 90013",
  coordinates: "34.0466, -118.2503",
  lat: "34.0466",
  lng: "-118.2503",
  mapLink: "https://www.openstreetmap.org/?mlat=34.0466&mlon=-118.2503#map=18/34.0466/-118.2503",
  description:
    "The public bin on the corner has been overflowing for three days. Bags are piling up on the sidewalk and blocking the curb ramp.",
  confirmations: "4",
  submittedDate: "June 6, 2026",
  jurisdictionName: "Los Angeles, CA",
  operatorNote: "Second report at this corner this month.",
  photoLinks: "https://civfix.org/sample/photo-1.jpg\nhttps://civfix.org/sample/photo-2.jpg",
  photoCount: "2",
}

export const DEFAULT_FORWARD_SUBJECT_TEMPLATE = "[civfix] {title} - {place} - {referenceCode}"

export const DEFAULT_FORWARD_BODY_TEMPLATE = [
  "A resident reported a {category} issue in {place} through civfix on {submittedDate}. Replies to this email go to the civfix operators, not to the resident.",
  "Reference: {referenceCode}\nCategory: {category}\nLocation: {address}\nCoordinates: {coordinates}\nConfirmed by: {confirmations} neighbors\nSubmitted: {submittedDate}",
  "View the exact location on a map: {mapLink}",
  "What was reported:\n{description}",
  "civfix reference {referenceCode} - replies to this email reach the civfix operators.",
].join("\n\n")

export const FORWARD_TEMPLATE_SUBJECT_MAX = 300
export const FORWARD_TEMPLATE_BODY_MAX = 8000

export interface ForwardTemplateIssue {
  kind: "unknown_token" | "double_braces" | "stray_brace"
  token: string
  index: number
}

const KNOWN_TOKENS: ReadonlySet<string> = new Set(FORWARD_TEMPLATE_VARIABLES.map((v) => v.token))

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const FORWARD_TEMPLATE_TOKEN_RE = new RegExp(
  FORWARD_TEMPLATE_VARIABLES.map((v) => escapeRegExp(v.token)).join("|"),
  "g",
)

const MAX_TOKEN_NAME = 64

function isNameChar(ch: string): boolean {
  return ch !== "{" && ch !== "}" && !/\s/.test(ch)
}

export const FORWARD_TEMPLATE_MAX_ISSUES = 8

export function forwardTemplateIssues(template: string): ForwardTemplateIssue[] {
  const issues: ForwardTemplateIssue[] = []
  if (template.length > FORWARD_TEMPLATE_BODY_MAX) return issues
  let i = 0
  const n = template.length
  while (i < n && issues.length < FORWARD_TEMPLATE_MAX_ISSUES) {
    if (template[i] !== "{") {
      i += 1
      continue
    }
    let open = i
    while (open < n && template[open] === "{") open += 1
    const braces = open - i
    if (braces >= 2) {
      let close = open
      while (close < n && close - open < MAX_TOKEN_NAME && template[close] !== "}" && template[close] !== "{") {
        close += 1
      }
      while (close < n && template[close] === "}") close += 1
      issues.push({ kind: "double_braces", token: template.slice(i, close), index: i })
      i = close
      continue
    }
    let end = open
    while (end < n && end - open < MAX_TOKEN_NAME && isNameChar(template[end] as string)) end += 1
    if (end === open || end >= n || template[end] !== "}") {
      i = open
      continue
    }
    const token = template.slice(i, end + 1)
    if (!KNOWN_TOKENS.has(token)) {
      issues.push({ kind: "unknown_token", token, index: i })
      i = end + 1
      continue
    }
    if (template[end + 1] === "}") {
      let extra = end + 1
      while (extra < n && template[extra] === "}") extra += 1
      issues.push({ kind: "stray_brace", token: template.slice(i, extra), index: i })
      i = extra
      continue
    }
    i = end + 1
  }
  return issues
}

const MAX_ISSUE_TOKEN_CHARS = 40

function shortToken(token: string): string {
  return token.length > MAX_ISSUE_TOKEN_CHARS ? `${token.slice(0, MAX_ISSUE_TOKEN_CHARS)}…` : token
}

export function describeForwardTemplateIssue(issue: ForwardTemplateIssue): string {
  const token = shortToken(issue.token)
  if (issue.kind === "double_braces") {
    return `${token} uses double braces; forward templates use single braces like {title}.`
  }
  if (issue.kind === "stray_brace") {
    return `${token} has an extra closing brace.`
  }
  return `${token} is not a known placeholder.`
}

function refineTemplate(value: string, ctx: z.RefinementCtx): void {
  if (value.length > FORWARD_TEMPLATE_BODY_MAX) return
  const issues = forwardTemplateIssues(value)
  if (issues.length === 0) return
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: issues.map(describeForwardTemplateIssue).join(" "),
  })
}

export const ForwardTemplateSubjectSchema = z
  .string()
  .max(FORWARD_TEMPLATE_SUBJECT_MAX)
  .superRefine(refineTemplate)

export const ForwardTemplateBodySchema = z
  .string()
  .max(FORWARD_TEMPLATE_BODY_MAX)
  .superRefine(refineTemplate)

export function interpolateForwardTemplate(
  template: string,
  values: ForwardTemplateValues,
): string {
  return template.replace(FORWARD_TEMPLATE_TOKEN_RE, (match) => {
    const bareName = match.slice(1, -1)
    return values[bareName] ?? ""
  })
}

export function templateUsesToken(template: string, bareName: string): boolean {
  return template.includes(`{${bareName}}`)
}

export const ForwardTemplateSettingsDTOSchema = z
  .object({
    subjectTemplate: z.string().nullable(),
    bodyTemplate: z.string().nullable(),
    updatedAt: z.string().nullable(),
  })
  .strict()
export type ForwardTemplateSettingsDTO = z.infer<typeof ForwardTemplateSettingsDTOSchema>

export const GetForwardTemplateDefaultResponseSchema = ForwardTemplateSettingsDTOSchema
export type GetForwardTemplateDefaultResponse = z.infer<
  typeof GetForwardTemplateDefaultResponseSchema
>

export const SetForwardTemplateDefaultRequestSchema = z
  .object({
    subjectTemplate: ForwardTemplateSubjectSchema.nullable(),
    bodyTemplate: ForwardTemplateBodySchema.nullable(),
  })
  .strict()
export type SetForwardTemplateDefaultRequest = z.infer<typeof SetForwardTemplateDefaultRequestSchema>

export const PreviewForwardTemplateRequestSchema = z
  .object({
    subjectTemplate: ForwardTemplateSubjectSchema.nullable().optional(),
    bodyTemplate: ForwardTemplateBodySchema.nullable().optional(),
  })
  .strict()
export type PreviewForwardTemplateRequest = z.infer<typeof PreviewForwardTemplateRequestSchema>

export const ForwardTemplateSourceSchema = z.enum(["custom", "default", "builtin"])
export type ForwardTemplateSource = z.infer<typeof ForwardTemplateSourceSchema>

export const PreviewForwardTemplateResponseSchema = z
  .object({
    subject: z.string(),
    text: z.string(),
    html: z.string(),
    subjectSource: ForwardTemplateSourceSchema,
    bodySource: ForwardTemplateSourceSchema,
  })
  .strict()
export type PreviewForwardTemplateResponse = z.infer<typeof PreviewForwardTemplateResponseSchema>
