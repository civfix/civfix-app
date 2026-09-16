export const STORE_KIT_DIR = "StoreKit"
export const APP_STORE_RECEIPT = "receipt"
export const SANDBOX_RECEIPT = "sandboxReceipt"

export type ReceiptStat = { present: boolean; modifiedAt: number | null }

export const RECEIPT_ABSENT: ReceiptStat = { present: false, modifiedAt: null }

export function betaInstallFromReceipts(store: ReceiptStat, sandbox: ReceiptStat): boolean {
  if (!sandbox.present) return false
  if (!store.present) return true
  if (store.modifiedAt === null || sandbox.modifiedAt === null) return false
  return sandbox.modifiedAt > store.modifiedAt
}
