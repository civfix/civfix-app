import type * as ExpoFileSystem from "expo-file-system"
import { Platform } from "react-native"
import {
  APP_STORE_RECEIPT,
  RECEIPT_ABSENT,
  SANDBOX_RECEIPT,
  STORE_KIT_DIR,
  betaInstallFromReceipts,
  type ReceiptStat,
} from "@/lib/storeKitReceipt"

type StoreKitProbe = { dir: string | null; store: ReceiptStat; sandbox: ReceiptStat }

const PROBE_UNAVAILABLE: StoreKitProbe = {
  dir: null,
  store: RECEIPT_ABSENT,
  sandbox: RECEIPT_ABSENT,
}

function statReceipt(file: { exists: boolean; modificationTime: number | null }): ReceiptStat {
  if (!file.exists) return RECEIPT_ABSENT
  const modificationTime = file.modificationTime
  return { present: true, modifiedAt: typeof modificationTime === "number" ? modificationTime : null }
}

function probeStoreKit(): StoreKitProbe {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded inside the guard so a resolution failure cannot break boot
    const { File, Paths } = require("expo-file-system") as typeof ExpoFileSystem
    const container = Paths.document.parentDirectory
    return {
      dir: container.uri,
      store: statReceipt(new File(container, STORE_KIT_DIR, APP_STORE_RECEIPT)),
      sandbox: statReceipt(new File(container, STORE_KIT_DIR, SANDBOX_RECEIPT)),
    }
  } catch {
    return PROBE_UNAVAILABLE
  }
}

export function isBetaInstall(): boolean {
  if (Platform.OS !== "ios") return false
  const probe = probeStoreKit()
  const beta = betaInstallFromReceipts(probe.store, probe.sandbox)
  if (__DEV__) {
    console.log(
      `[install-source] StoreKit container ${probe.dir ?? "<unreadable>"}; ` +
        `${APP_STORE_RECEIPT}=${JSON.stringify(probe.store)}, ` +
        `${SANDBOX_RECEIPT}=${JSON.stringify(probe.sandbox)} -> beta=${beta}`,
    )
  }
  return beta
}
