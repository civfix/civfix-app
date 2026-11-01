import { EMAIL_OTP_CODE_LENGTH, REVIEWER_OTP_CODE_MIN_LENGTH } from "@civfix/contract"

export type OtpEntryMode = "digits" | "reviewer" | "test_code"

// The reviewer and test codes are pasted long codes, so stray spaces around them don't count.
export function isOtpCodeIncomplete(code: string, mode: OtpEntryMode): boolean {
  return mode === "digits"
    ? code.length !== EMAIL_OTP_CODE_LENGTH
    : code.trim().length < REVIEWER_OTP_CODE_MIN_LENGTH
}
