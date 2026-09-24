import type { InboundMail, ParsedMail } from "../interfaces/inbound-mail.js"

const decoder = new TextDecoder()

/**
 * Thread-token shape, mirroring the real CfInboundMail adapter. Deliberately PERMISSIVE so it accepts
 * both the 12-char base32 and the older 24-hex tokens: the token's entropy + the unique DB lookup are
 * the real protection, and this gate only rejects obviously malformed candidates. The fake MUST validate
 * the same way production does, or a token the real adapter rejects would still "work" in tests.
 */
const THREAD_TOKEN_RE = /^[a-z0-9]{8,40}$/

const DEFAULT_REPLY_DOMAIN = "civfix.org"

/**
 * Anchored reply-address matcher (mirrors the real CfInboundMail adapter): a typed prefix
 * (`reply`/`report`/`event`), a `-` or older `+` separator, the token, then `@domain`. Anchoring + the
 * domain check stop a mid-string or foreign-domain false positive.
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
   * Extract a thread token from an X-Thread-Token header or a typed reply address on OUR reply domain.
   * The address is anchored + domain-checked and the token shape-validated exactly like the real
   * CfInboundMail adapter, so a city's own `report-*@city.gov` alias, a foreign CC, or a junk value
   * cannot create stray threads.
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
