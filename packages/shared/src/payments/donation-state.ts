import type { DonationStatus } from "../schemas/common.js"

export const DONATION_STATUS_RANK: Readonly<Record<DonationStatus, number>> = {
  pending: 0,
  failed: 1,
  succeeded: 2,
  partially_refunded: 3,
  refunded: 4,
}

export function donationStatusRank(status: DonationStatus): number {
  return DONATION_STATUS_RANK[status]
}

export function advanceStatus(current: DonationStatus, next: DonationStatus): DonationStatus {
  return donationStatusRank(next) > donationStatusRank(current) ? next : current
}

export function isTerminalDonationStatus(status: DonationStatus): boolean {
  return status === "refunded"
}

export function isSettledDonationStatus(status: DonationStatus): boolean {
  return donationStatusRank(status) >= DONATION_STATUS_RANK.succeeded
}

export function refundedDonationStatus(input: {
  current: DonationStatus
  amountMinor: number
  refundedTotalMinor: number
}): DonationStatus {
  if (!isSettledDonationStatus(input.current)) return input.current
  if (input.refundedTotalMinor <= 0) return "succeeded"
  return input.refundedTotalMinor >= input.amountMinor ? "refunded" : "partially_refunded"
}

export function isRefundStatusCorrection(current: DonationStatus, next: DonationStatus): boolean {
  return isSettledDonationStatus(current) && donationStatusRank(next) < donationStatusRank(current)
}
