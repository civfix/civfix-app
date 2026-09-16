import type { DonateTarget } from "./donateTarget.types"

export function openDonate(target: DonateTarget): void {
  if (typeof window !== "undefined" && typeof window.open === "function") {
    window.open(target.url, "_blank", "noopener,noreferrer")
    return
  }
  void target.openExternal?.open(target.url)
}
