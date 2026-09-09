export const BPS_DENOMINATOR = 10000
export const DEFAULT_PROCESSOR_FEE_BPS = 290
export const DEFAULT_PROCESSOR_FEE_FIXED_MINOR = 30
export const MAX_FEE_BPS = 2000

function requireMinor(label: string, value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer amount in minor units`)
  }
  return value
}

function requireBps(label: string, value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > BPS_DENOMINATOR) {
    throw new RangeError(`${label} must be an integer between 0 and ${BPS_DENOMINATOR}`)
  }
  return value
}

export function platformFeeMinor(grossMinor: number, bps: number): number {
  const gross = requireMinor("grossMinor", grossMinor)
  const rate = requireBps("bps", bps)
  if (rate === 0 || gross === 0) return 0
  return Math.min(Math.round((gross * rate) / BPS_DENOMINATOR), gross)
}

export interface ProcessorFeeOptions {
  bps?: number
  fixedMinor?: number
}

export function estimateProcessorFeeMinor(
  grossMinor: number,
  options: ProcessorFeeOptions = {},
): number {
  const gross = requireMinor("grossMinor", grossMinor)
  const rate = requireBps("processingFeeBps", options.bps ?? DEFAULT_PROCESSOR_FEE_BPS)
  const fixed = requireMinor(
    "processingFeeFixedMinor",
    options.fixedMinor ?? DEFAULT_PROCESSOR_FEE_FIXED_MINOR,
  )
  if (gross === 0) return 0
  return Math.min(Math.round((gross * rate) / BPS_DENOMINATOR) + fixed, gross)
}

export interface DonationFeePreviewInput {
  amountMinor: number
  platformFeeBps: number
  processingFeeBps?: number
  processingFeeFixedMinor?: number
}

export interface DonationFeePreview {
  grossMinor: number
  platformFeeMinor: number
  estimatedProcessingFeeMinor: number
  estimatedNetMinor: number
  platformFeeBps: number
}

export function previewDonationFees(input: DonationFeePreviewInput): DonationFeePreview {
  const gross = requireMinor("amountMinor", input.amountMinor)
  const bps = requireBps("platformFeeBps", input.platformFeeBps)
  const platformFee = platformFeeMinor(gross, bps)
  const processorFee = estimateProcessorFeeMinor(gross, {
    bps: input.processingFeeBps,
    fixedMinor: input.processingFeeFixedMinor,
  })
  return {
    grossMinor: gross,
    platformFeeMinor: platformFee,
    estimatedProcessingFeeMinor: processorFee,
    estimatedNetMinor: Math.max(0, gross - platformFee - processorFee),
    platformFeeBps: bps,
  }
}

export function effectiveFeeBps(envBps: number, agreedBps: number): number {
  return Math.min(requireBps("envBps", envBps), requireBps("agreedBps", agreedBps))
}
