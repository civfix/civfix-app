import { STAGING_API_URL } from "@/lib/apiUrl"

// An exact match: a production build pointed anywhere else, even a look-alike host, never offers the screen.
export function developerScreenEnabled(apiUrl: string, isDev: boolean): boolean {
  return isDev || apiUrl === STAGING_API_URL
}
