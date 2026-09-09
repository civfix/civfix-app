export const ANDROID_CODE_SCANNER_IN_NATIVE_BUILD = false

export function codeScannerSupported(os: string): boolean {
  if (os === "ios") return true
  if (os === "android") return ANDROID_CODE_SCANNER_IN_NATIVE_BUILD
  return false
}
