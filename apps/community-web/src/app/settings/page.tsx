import { HomeShell } from "@/components/home/home-shell"

/**
 * /settings - the Settings hub. HomeShell mounts the unified @civfix/ui AppShell and the web nav
 * adapter seeds its nav store from the URL (use-web-nav-adapter.ts -> entryFromPath). The dedicated
 * route dir is what makes the deep link / a refresh safe under static export.
 */
export default function SettingsPage() {
  return <HomeShell />
}
