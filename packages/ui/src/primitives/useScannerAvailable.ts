import { useSyncExternalStore } from "react"
import { scannerAvailable, subscribeScannerAvailability } from "./scannerPresenter"

export function useScannerAvailable(): boolean {
  return useSyncExternalStore(subscribeScannerAvailability, scannerAvailable, scannerAvailable)
}
