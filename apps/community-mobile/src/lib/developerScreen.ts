import { REVIEWER_OTP_EMAIL } from "@civfix/contract"
import { STAGING_API_URL } from "@/lib/apiUrl"

// An exact match: a production build pointed anywhere else, even a look-alike host, never offers the screen.
export function developerScreenEnabled(apiUrl: string, isDev: boolean): boolean {
  return isDev || apiUrl === STAGING_API_URL
}

// Only civfix.org addresses can be test accounts (the server keeps no others), and the reviewer keeps
// its own field. The phone never learns which addresses are listed, so every other one is offered the link.
export function testCodeOffered(email: string, apiUrl: string, isDev: boolean): boolean {
  const address = email.trim().toLowerCase()
  return (
    developerScreenEnabled(apiUrl, isDev) &&
    address.endsWith("@civfix.org") &&
    address !== REVIEWER_OTP_EMAIL
  )
}
