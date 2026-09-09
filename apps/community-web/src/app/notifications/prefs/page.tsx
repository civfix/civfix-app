import { HomeShell } from "@/components/home/home-shell"

/**
 * /notifications/prefs - the Settings panel (home of the blocked-accounts list + delete-account that
 * now live in the shared ProfileBody / NotificationPrefsBody). Renders the HomeShell, which mounts the
 * unified @civfix/ui AppShell and seeds its nav store from the URL via the web nav adapter
 * (use-web-nav-adapter.ts; /notifications/prefs -> the Settings panel). This dedicated route makes the
 * Settings deep link / refresh safe under static export (mirrors notifications/page.tsx).
 */
export default function NotificationPrefsPage() {
  return <HomeShell />
}
