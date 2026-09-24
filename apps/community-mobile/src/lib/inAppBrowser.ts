import * as Linking from "expo-linking"
import * as WebBrowser from "expo-web-browser"
import { DONATE_BROWSER_MODE } from "@/config"
import { isExternalUrl } from "@/lib/links"
import { currentTheme } from "@/theme/appearanceTheme"

let inAppBrowserOpen = false

export async function openInAppBrowser(url: string): Promise<void> {
  if (!isExternalUrl(url)) {
    console.warn("[links] refused an in-app browser target that is not an https URL")
    return
  }
  if (DONATE_BROWSER_MODE === "system") {
    await Linking.openURL(url)
    return
  }
  if (inAppBrowserOpen) return
  const t = currentTheme()
  inAppBrowserOpen = true
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      dismissButtonStyle: "close",
      toolbarColor: t.colors.bg,
      controlsColor: t.colors.accentText,
      secondaryToolbarColor: t.colors.bgAlt,
      enableBarCollapsing: false,
      showTitle: true,
    })
  } catch (err) {
    console.warn("[links] the in-app browser was unavailable; opening the system browser", err)
    await Linking.openURL(url)
  } finally {
    inAppBrowserOpen = false
  }
}
