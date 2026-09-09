export const SAFE_HTTPS_URL_MAX_CHARS = 2048
export const MARKDOWN_MAX_HREF_CHARS = SAFE_HTTPS_URL_MAX_CHARS

export type UnsafeHostReason = "ip_literal" | "punycode" | "non_ascii_host"

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u
const ASCII_HOST = /^[a-z0-9.-]+$/
const IPV4_LITERAL = /^\d{1,3}(?:\.\d{1,3}){3}$/

export interface SafeHttpsUrlOptions {
  maxChars?: number
}

export function httpsUrlAuthority(url: string): string {
  const separator = url.indexOf("//")
  if (separator === -1) return ""
  const afterScheme = url.slice(separator + 2)
  const end = afterScheme.search(/[/?#]/u)
  return end === -1 ? afterScheme : afterScheme.slice(0, end)
}

export function hostOfAuthority(authority: string): string {
  const withoutUserinfo = authority.slice(authority.lastIndexOf("@") + 1)
  if (withoutUserinfo.startsWith("[")) {
    const close = withoutUserinfo.indexOf("]")
    return close === -1 ? withoutUserinfo.toLowerCase() : withoutUserinfo.slice(0, close + 1).toLowerCase()
  }
  const colon = withoutUserinfo.indexOf(":")
  return (colon === -1 ? withoutUserinfo : withoutUserinfo.slice(0, colon)).toLowerCase()
}

export function unsafeHostReason(host: string): UnsafeHostReason | null {
  if (host.length === 0) return "ip_literal"
  if (IPV4_LITERAL.test(host) || host.startsWith("[")) return "ip_literal"
  if (host.includes("xn--")) return "punycode"
  if (!ASCII_HOST.test(host)) return "non_ascii_host"
  if (host.startsWith(".") || host.endsWith(".") || host.includes("..")) return "non_ascii_host"
  return null
}

export function isSafeHttpsUrl(value: string, options: SafeHttpsUrlOptions = {}): boolean {
  const maxChars = options.maxChars ?? SAFE_HTTPS_URL_MAX_CHARS
  const url = value.trim()
  if (url.length === 0 || url.length > maxChars) return false
  if (/\s/u.test(url) || CONTROL_CHAR.test(url)) return false
  if (!/^https:\/\//iu.test(url)) return false
  const authority = httpsUrlAuthority(url)
  if (authority.length === 0 || authority.includes("@")) return false
  return unsafeHostReason(hostOfAuthority(authority)) === null
}

export function isSafeMarkdownHref(href: string): boolean {
  return isSafeHttpsUrl(href, { maxChars: MARKDOWN_MAX_HREF_CHARS })
}
