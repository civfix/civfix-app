import Constants from "expo-constants"
import { resolveApiUrl } from "./lib/apiUrl"
import { isBetaInstall } from "./lib/nativeBetaInstall"
import { resolveDonateBrowserMode, type DonateBrowserMode } from "./lib/donateBrowser"
import { resolveWebOrigin } from "./lib/webOrigin"

type Extra = {
  apiUrl?: unknown
  google?: {
    webClientId?: string
    iosClientId?: string
  }
  cartoApiKey?: string
  sourceCommit?: string
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra

export const API_URL: string = resolveApiUrl(extra.apiUrl, __DEV__, isBetaInstall())

export const WEB_ORIGIN: string = resolveWebOrigin(API_URL)

export const CARTO_API_KEY: string = extra.cartoApiKey ?? ""

export const SOURCE_COMMIT: string = extra.sourceCommit ?? ""

export const DONATE_BROWSER_MODE: DonateBrowserMode = resolveDonateBrowserMode(
  process.env.EXPO_PUBLIC_DONATE_BROWSER_MODE,
)

export const GOOGLE_WEB_CLIENT_ID: string = extra.google?.webClientId ?? ""
export const GOOGLE_IOS_CLIENT_ID: string = extra.google?.iosClientId ?? ""
