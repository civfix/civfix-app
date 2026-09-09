import type { EligibilityVerdict } from "../schemas/common.js"

export const MNOS_GRACE_BUSINESS_DAYS = 5

export const DEFAULT_DEDUCTIBLE_BMF_CODES: readonly string[] = ["1"]

export const REVIEW_REQUIRED_BLOCKS_DONATIONS = false

const DAY_MS = 86400000
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export type EligibilityReason =
  | "irs_auto_revoked"
  | "ftb_revoked"
  | "ca_ag_mnos"
  | "ca_ag_mnos_grace"
  | "group_subordinate_unconfirmed"
  | "ofac_sdn_match"
  | "no_positive_listing"
  | "positive_sources_not_yet_checked"
  | "bmf_not_deductible"

export interface EligibilityEvidence {
  pub78Listed: boolean
  bmfListed: boolean
  deductibilityCode: string | null
  autoRevocationListed: boolean
  ftbRevoked: boolean
  mnosListed: boolean
  ofacMatch: boolean
  groupExemptionSubordinate: boolean
  centralOrgConfirmed: boolean
  mnosFirstSeenOn?: string | null
  asOf?: string | null
  pub78Checked?: boolean
  bmfChecked?: boolean
}

export interface DonationEligibilityOptions {
  reviewRequiredBlocks?: boolean
}

export interface EligibilityOptions {
  deductibleCodes?: readonly string[]
  graceBusinessDays?: number
}

export interface EligibilityResult {
  verdict: EligibilityVerdict
  reasons: EligibilityReason[]
  graceExpiresOn: string | null
  contributionsDeductible: boolean
}

function dayToUtcMs(day: string): number {
  if (!DAY_RE.test(day)) return Number.NaN
  const year = Number(day.slice(0, 4))
  const month = Number(day.slice(5, 7))
  const date = Number(day.slice(8, 10))
  const ms = Date.UTC(year, month - 1, date)
  return utcMsToDay(ms) === day ? ms : Number.NaN
}

function utcMsToDay(ms: number): string {
  const d = new Date(ms)
  return (
    `${String(d.getUTCFullYear()).padStart(4, "0")}-` +
    `${String(d.getUTCMonth() + 1).padStart(2, "0")}-` +
    `${String(d.getUTCDate()).padStart(2, "0")}`
  )
}

export function addBusinessDays(day: string, businessDays: number): string {
  const start = dayToUtcMs(day)
  if (!Number.isFinite(start)) throw new RangeError("addBusinessDays expects a YYYY-MM-DD calendar day")
  if (!Number.isInteger(businessDays) || businessDays < 0) {
    throw new RangeError("addBusinessDays expects a non-negative integer count")
  }
  let ms = start
  let remaining = businessDays
  while (remaining > 0) {
    ms += DAY_MS
    const weekday = new Date(ms).getUTCDay()
    if (weekday !== 0 && weekday !== 6) remaining -= 1
  }
  return utcMsToDay(ms)
}

function isDeductibleCode(code: string | null, allowed: readonly string[]): boolean {
  if (code === null) return false
  const normalized = code.trim().toUpperCase()
  if (normalized.length === 0) return false
  return allowed.some((entry) => entry.trim().toUpperCase() === normalized)
}

export function evaluateEligibility(
  evidence: EligibilityEvidence,
  options: EligibilityOptions = {},
): EligibilityResult {
  const deductibleCodes = options.deductibleCodes ?? DEFAULT_DEDUCTIBLE_BMF_CODES
  const graceDays =
    Number.isInteger(options.graceBusinessDays) && (options.graceBusinessDays as number) >= 0
      ? (options.graceBusinessDays as number)
      : MNOS_GRACE_BUSINESS_DAYS

  const asOfMs = evidence.asOf ? dayToUtcMs(evidence.asOf) : Number.NaN
  const mnosStartMs = evidence.mnosFirstSeenOn ? dayToUtcMs(evidence.mnosFirstSeenOn) : Number.NaN
  const graceExpiresOn =
    evidence.mnosListed && Number.isFinite(mnosStartMs)
      ? addBusinessDays(evidence.mnosFirstSeenOn as string, graceDays)
      : null
  const graceExpiresMs = graceExpiresOn === null ? Number.NaN : dayToUtcMs(graceExpiresOn)
  const withinGrace =
    evidence.mnosListed &&
    Number.isFinite(asOfMs) &&
    Number.isFinite(graceExpiresMs) &&
    asOfMs <= graceExpiresMs

  const disqualifying: EligibilityReason[] = []
  if (evidence.ftbRevoked) disqualifying.push("ftb_revoked")
  if (evidence.autoRevocationListed && !evidence.pub78Listed) disqualifying.push("irs_auto_revoked")
  if (evidence.groupExemptionSubordinate && !evidence.centralOrgConfirmed) {
    disqualifying.push("group_subordinate_unconfirmed")
  }
  if (evidence.mnosListed && !withinGrace) disqualifying.push("ca_ag_mnos")

  if (disqualifying.length > 0) {
    return { verdict: "ineligible", reasons: disqualifying, graceExpiresOn, contributionsDeductible: false }
  }

  const deductibleBmf = evidence.bmfListed && isDeductibleCode(evidence.deductibilityCode, deductibleCodes)
  if (!evidence.pub78Listed && !deductibleBmf) {
    const neverChecked = evidence.pub78Checked === false && evidence.bmfChecked === false
    const reasons: EligibilityReason[] = [
      neverChecked ? "positive_sources_not_yet_checked" : "no_positive_listing",
    ]
    if (evidence.bmfListed) reasons.push("bmf_not_deductible")
    if (evidence.ofacMatch) reasons.push("ofac_sdn_match")
    return { verdict: "unknown", reasons, graceExpiresOn, contributionsDeductible: false }
  }

  if (evidence.ofacMatch) {
    return {
      verdict: "review_required",
      reasons: ["ofac_sdn_match"],
      graceExpiresOn,
      contributionsDeductible: true,
    }
  }

  if (withinGrace) {
    return { verdict: "grace", reasons: ["ca_ag_mnos_grace"], graceExpiresOn, contributionsDeductible: true }
  }

  return { verdict: "eligible", reasons: [], graceExpiresOn, contributionsDeductible: true }
}

export function verdictPermitsDonations(
  verdict: EligibilityVerdict,
  options: DonationEligibilityOptions = {},
): boolean {
  if (verdict === "eligible" || verdict === "grace") return true
  if (verdict === "review_required") {
    return !(options.reviewRequiredBlocks ?? REVIEW_REQUIRED_BLOCKS_DONATIONS)
  }
  return false
}

export function isDonationEligible(
  result: EligibilityResult,
  options: DonationEligibilityOptions = {},
): boolean {
  return verdictPermitsDonations(result.verdict, options)
}
