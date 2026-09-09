import { HomeShell } from "@/components/home/home-shell"

/**
 * /settings/blocked - the blocked-accounts list. `pathForEntry` has always emitted this path; without
 * this route dir a cold load / refresh 404'd under static export.
 */
export default function SettingsBlockedPage() {
  return <HomeShell />
}
