"use client"

import * as React from "react"

import { amountInputValue, formatMinorCompact, parseAmountToMinor } from "./donate-amount"

interface AmountFieldProps {
  suggestedAmountsMinor: readonly number[]
  minAmountMinor: number
  maxAmountMinor: number
  value: string
  onChange: (next: string) => void
  disabled: boolean
  errorId?: string
  error?: string | null
}

export function AmountField({
  suggestedAmountsMinor,
  minAmountMinor,
  maxAmountMinor,
  value,
  onChange,
  disabled,
  errorId,
  error,
}: AmountFieldProps) {
  const parsed = parseAmountToMinor(value)
  const selectedMinor = parsed.ok ? parsed.amountMinor : null
  const otherSelected = selectedMinor === null || !suggestedAmountsMinor.includes(selectedMinor)
  const otherRef = React.useRef<HTMLInputElement | null>(null)

  return (
    <section className="donate-amount" aria-labelledby="donate-amount-heading">
      <h2 id="donate-amount-heading">Choose an amount</h2>

      <fieldset className="donate-amount-presets" disabled={disabled}>
        <legend className="donate-visually-hidden">Suggested amounts</legend>
        {suggestedAmountsMinor.map((minor) => {
          const id = `donate-amount-preset-${minor}`
          return (
            <div className="donate-amount-preset" data-checked={String(selectedMinor === minor)} key={minor}>
              <input
                id={id}
                type="radio"
                name="donate-amount-preset"
                checked={selectedMinor === minor}
                onChange={() => onChange(amountInputValue(minor))}
              />
              <label htmlFor={id}>{formatMinorCompact(minor)}</label>
            </div>
          )
        })}
        <div className="donate-amount-preset" data-checked={String(otherSelected)}>
          <input
            id="donate-amount-preset-other"
            type="radio"
            name="donate-amount-preset"
            checked={otherSelected}
            onChange={() => {
              onChange("")
              otherRef.current?.focus()
            }}
          />
          <label htmlFor="donate-amount-preset-other">Other</label>
        </div>
      </fieldset>

      <div className="donate-amount-custom">
        <label htmlFor="donate-amount-input">Amount in US dollars</label>
        <div className="donate-amount-input-wrap">
          <span aria-hidden="true">$</span>
          <input
            id="donate-amount-input"
            ref={otherRef}
            inputMode="decimal"
            autoComplete="off"
            type="text"
            value={value}
            disabled={disabled}
            aria-describedby={error ? errorId : "donate-amount-limits"}
            aria-invalid={error ? true : undefined}
            onChange={(cause) => onChange(cause.target.value)}
          />
        </div>
        <p className="donate-field-hint" id="donate-amount-limits">
          {formatMinorCompact(minAmountMinor)} minimum, {formatMinorCompact(maxAmountMinor)} maximum.
        </p>
        {error ? (
          <p className="donate-field-error" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}
