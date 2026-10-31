export type OtpEntryMode = "digits" | "reviewer" | "test_code"

export function isOtpCodeIncomplete(_code: string, _mode: OtpEntryMode): boolean {
  throw new Error("not implemented")
}
