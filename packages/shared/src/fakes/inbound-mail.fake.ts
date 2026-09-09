import type { InboundMail, ParsedMail } from "../interfaces/inbound-mail.js"

const decoder = new TextDecoder()

/**
 * Shape of a thread token, mirroring the real CfInboundMail adapter. Deliberately PERMISSIVE
 * (lowercase alphanumeric, 8-40 chars) so it accepts both the current 12-char base32 token and the
 * legacy 24-hex token without needing another change when the mint format is tuned - the token's
 * entropy + the unique DB lookup are the real protection; this gate just rejects obviously-malformed
 * candidates (spaces, `@`, junk). The fake MUST validate the same way production does, otherwise a
 * token format the real adapter rejects would still "work" in tests, hiding the bug.
 */
const THREAD_TOKEN_RE = /^[a-z0-9]{8,40}$/

const DEFAULT_REPLY_DOMAIN = "civfix.org"

/**
 * Anchored reply-address matcher (mirrors the real CfInboundMail adapter): the local-part MUST START with
 * a typed prefix (`reply`/`report`/`event`) + a `-` (current) or `+` (legacy) separator, then the token,
 * then `@domain`. Anchoring + the domain check stop a mid-string or foreign-domain false positive.
 */
const REPLY_ADDRESS_RE = /^(?:reply|report|event)[-+]([^@\s]+)@([^@\s]+)$/

/**
 * In-memory InboundMail. Parses a tiny subset of RFC822: leading "Header: value" lines until a
 * blank line, then the remainder is the text body. Deterministic and dependency-free.
 */
export class FakeInboundMail implements InboundMail {
  /** Reply domain a thread token must live on (mirrors MAIL_REPLY_DOMAIN); defaults to civfix.org. */
  private readonly replyDomain: string

  constructor(replyDomain: string = DEFAULT_REPLY_DOMAIN) {
    this.replyDomain = replyDomain.toLowerCase()
  }

  parse(raw: Uint8Array): Promise<ParsedMail> {
    const text = decoder.decode(raw)
    const normalized = text.replace(/\r\n/g, "\n")
    const splitIdx = normalized.indexOf("\n\n")
    const headerBlock = splitIdx >= 0 ? normalized.slice(0, splitIdx) : normalized
    const body = splitIdx >= 0 ? normalized.slice(splitIdx + 2) : ""

    const headers: Record<string, string> = {}
    for (const line of headerBlock.split("\n")) {
      const idx = line.indexOf(":")
      if (idx > 0) {
        const key = line.slice(0, idx).trim().toLowerCase()
        headers[key] = line.slice(idx + 1).trim()
      }
    }

    const parseAddr = (v: string | undefined) => {
      if (!v) return null
      const m = v.match(/^(.*)<([^>]+)>$/)
      if (m && m[2]) {
        const name = (m[1] ?? "").trim()
        return name ? { name, address: m[2].trim() } : { address: m[2].trim() }
      }
      return { address: v.trim() }
    }

    const to = headers["to"]
    const toAddr = parseAddr(to)

    return Promise.resolve({
      from: parseAddr(headers["from"]),
      to: toAddr ? [toAddr] : [],
      subject: headers["subject"] ?? null,
      text: body.length > 0 ? body : null,
      html: null,
      messageId: headers["message-id"] ?? null,
      inReplyTo: headers["in-reply-to"] ?? null,
      headers,
    })
  }

  /**
   * Extract a thread token from a typed reply address on OUR reply domain - `reply-<token>@{domain}`,
   * `report-<token>@{domain}`, or `event-<token>@{domain}` (the current `-` separator), or the legacy `+`
   * form, or an X-Thread-Token header. The address is anchored + domain-checked and the token is
   * SHAPE-VALIDATED against THREAD_TOKEN_RE - exactly like the real CfInboundMail adapter - so a city's
   * own `report-*@city.gov` alias, a foreign CC, or a junk value cannot create stray threads, and a unit
   * test sees the same accept/reject behavior production does. Returns null when none matches.
   */
  extractThreadToken(mail: ParsedMail): string | null {
    const headerToken = mail.headers["x-thread-token"]
    if (headerToken && THREAD_TOKEN_RE.test(headerToken)) return headerToken
    for (const addr of mail.to) {
      const m = addr.address.match(REPLY_ADDRESS_RE)
      if (m && m[1] && m[2] && m[2].toLowerCase() === this.replyDomain) {
        if (THREAD_TOKEN_RE.test(m[1])) return m[1]
      }
    }
    return null
  }
}
