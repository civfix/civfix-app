import type { AppPlatform } from "@/lib/forceUpdate"

export function mobileDefaultHeaders(
  platform: AppPlatform,
  version: string | undefined,
): Record<string, string> {
  return {
    "X-Client": "mobile",
    ...(version ? { "X-Civfix-App-Version": `${platform}/${version}` } : {}),
  }
}
