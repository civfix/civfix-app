import { Platform } from "react-native"
import { File, Paths } from "expo-file-system"

export const STORE_KIT_DIR = "StoreKit"
export const APP_STORE_RECEIPT = "receipt"
export const SANDBOX_RECEIPT = "sandboxReceipt"

function storeKitReceiptPresent(name: string): boolean {
  try {
    return new File(Paths.document.parentDirectory, STORE_KIT_DIR, name).exists
  } catch {
    return false
  }
}

export function isBetaInstall(): boolean {
  if (Platform.OS !== "ios") return false
  if (storeKitReceiptPresent(APP_STORE_RECEIPT)) return false
  return storeKitReceiptPresent(SANDBOX_RECEIPT)
}
