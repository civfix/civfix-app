import Constants from "expo-constants"
import { resolveApiUrl } from "./lib/apiUrl"
import { isBetaInstall } from "./lib/betaInstall"
import { resolveDonateBrowserMode, type DonateBrowserMode } from "./lib/donateBrowser"
import { resolveWebOrigin } from "./lib/webOrigin"

type Extra = {
  apiUrl?: unknown
  google?: {
    webClientId?: string
    iosClientId?: string
  }
  cartoApiKey?: string
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra

export { DEV_API_URL, STAGING_API_URL, PROD_API_URL, resolveApiUrl } from "./lib/apiUrl"

export const API_URL: string = resolveApiUrl(extra.apiUrl, __DEV__, isBetaInstall())

export const WEB_ORIGIN: string = resolveWebOrigin(API_URL)

export const CARTO_API_KEY: string = extra.cartoApiKey ?? ""

export const DONATE_BROWSER_MODE: DonateBrowserMode = resolveDonateBrowserMode(
  process.env.EXPO_PUBLIC_DONATE_BROWSER_MODE,
)

export { DONATE_BROWSER_MODES, resolveDonateBrowserMode } from "./lib/donateBrowser"
export type { DonateBrowserMode } from "./lib/donateBrowser"

export const GOOGLE_WEB_CLIENT_ID: string = extra.google?.webClientId ?? ""
export const GOOGLE_IOS_CLIENT_ID: string = extra.google?.iosClientId ?? ""
