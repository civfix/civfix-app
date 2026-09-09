import type { MoneyDTO } from "@civfix/shared"

export function formatMoney(money: MoneyDTO, locale?: string): string {
  const amount = money.amountMinor / 100
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: money.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${money.currency} ${amount.toFixed(2)}`
  }
}

export function formatMinor(amountMinor: number, currency: "USD" = "USD", locale?: string): string {
  return formatMoney({ amountMinor, currency }, locale)
}
