export type AmountParse =
  | { readonly ok: true; readonly amountMinor: number }
  | { readonly ok: false; readonly reason: "empty" | "not_a_number" | "too_precise" }

const MAX_MINOR = 100_000_000

const GROUPED_WHOLE = /^\d{1,3}(?:,\d{3})*$/

export function parseAmountToMinor(input: string): AmountParse {
  const raw = input.trim()
  if (raw.length === 0) return { ok: false, reason: "empty" }

  const stripped = raw.replace(/[\s$ ]/g, "")
  if (stripped.length === 0) return { ok: false, reason: "empty" }
  if (!/^[0-9.,]+$/.test(stripped)) return { ok: false, reason: "not_a_number" }

  const lastComma = stripped.lastIndexOf(",")
  const lastDot = stripped.lastIndexOf(".")
  const index = Math.max(lastComma, lastDot)

  let whole = stripped
  let fraction = ""

  if (index !== -1) {
    const separator = index === lastComma ? "," : "."
    const tail = stripped.slice(index + 1)
    const head = stripped.slice(0, index)

    if (/^\d{1,2}$/.test(tail)) {
      whole = head
      fraction = tail
    } else if (separator === "," && /^\d{3}$/.test(tail) && GROUPED_WHOLE.test(head)) {
      whole = stripped
    } else {
      return { ok: false, reason: "too_precise" }
    }
  }

  const digits = whole.replace(/,/g, "")
  if (!/^\d*$/.test(digits)) return { ok: false, reason: "not_a_number" }
  if (digits.length === 0 && fraction.length === 0) return { ok: false, reason: "empty" }

  const dollars = digits.length === 0 ? 0 : Number.parseInt(digits, 10)
  const cents = fraction.length === 0 ? 0 : Number.parseInt(fraction.padEnd(2, "0"), 10)
  const amountMinor = dollars * 100 + cents

  if (!Number.isSafeInteger(amountMinor) || amountMinor > MAX_MINOR) {
    return { ok: false, reason: "not_a_number" }
  }
  return { ok: true, amountMinor }
}

export type AmountVerdict = "ok" | "empty" | "invalid" | "below_min" | "above_max"

export function amountVerdict(input: string, minMinor: number, maxMinor: number): AmountVerdict {
  const parsed = parseAmountToMinor(input)
  if (!parsed.ok) return parsed.reason === "empty" ? "empty" : "invalid"
  if (parsed.amountMinor < minMinor) return "below_min"
  if (parsed.amountMinor > maxMinor) return "above_max"
  return "ok"
}

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const USD_WHOLE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatMinor(amountMinor: number): string {
  return USD.format(amountMinor / 100)
}

export function formatMinorCompact(amountMinor: number): string {
  return amountMinor % 100 === 0 ? USD_WHOLE.format(amountMinor / 100) : formatMinor(amountMinor)
}

export function amountInputValue(amountMinor: number): string {
  return amountMinor % 100 === 0 ? String(amountMinor / 100) : (amountMinor / 100).toFixed(2)
}
