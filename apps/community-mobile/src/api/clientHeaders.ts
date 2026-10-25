import type { AppPlatform } from "@/lib/forceUpdate"

export function mobileDefaultHeaders(_platform: AppPlatform, _version: string | undefined): Record<string, string> {
  throw new Error("not implemented")
}
