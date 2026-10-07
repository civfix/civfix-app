"use client"

import * as React from "react"
import type { EventAnswerValue, EventQuestionDTO } from "@civfix/shared"

interface QuestionFieldProps {
  question: EventQuestionDTO
  value: EventAnswerValue | undefined
  invalid: boolean
  /** The widget's error message, linked to an invalid field so it is read with the field. */
  errorId: string | undefined
  disabled: boolean
  onChange: (next: EventAnswerValue) => void
}

function describedBy(...ids: Array<string | undefined | false>): string | undefined {
  const joined = ids.filter(Boolean).join(" ")
  return joined.length > 0 ? joined : undefined
}

function RequiredMark({ required }: { required: boolean }) {
  return required ? <span aria-hidden="true"> *</span> : null
}

export function QuestionField({ question, value, invalid, errorId, disabled, onChange }: QuestionFieldProps) {
  const id = `signup-question-${question.id}`
  const help = question.helpText ? `${id}-help` : undefined
  const describedByIds = describedBy(help, invalid && errorId)
  const helpText = question.helpText ? (
    <p className="signup-hint" id={help}>
      {question.helpText}
    </p>
  ) : null

  if (question.kind === "checkbox" || question.kind === "consent") {
    return (
      <>
        <div className="signup-check">
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            aria-required={question.required ? true : undefined}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={describedByIds}
            onChange={(event) => onChange(event.target.checked)}
          />
          <label htmlFor={id}>
            {question.consentText ?? question.prompt}
            <RequiredMark required={question.required} />
          </label>
        </div>
        {helpText}
      </>
    )
  }

  if (question.kind === "single_select") {
    return (
      <fieldset
        className="signup-field"
        role="radiogroup"
        aria-required={question.required ? true : undefined}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedByIds}
      >
        <legend>
          {question.prompt}
          <RequiredMark required={question.required} />
        </legend>
        {helpText}
        {question.options.map((option) => (
          <label key={option.value} className="signup-check">
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    )
  }

  if (question.kind === "multi_select") {
    const selected = Array.isArray(value) ? value : []
    return (
      <fieldset className="signup-field" aria-describedby={describedByIds}>
        <legend>
          {question.prompt}
          <RequiredMark required={question.required} />
        </legend>
        {helpText}
        {question.options.map((option) => (
          <label key={option.value} className="signup-check">
            <input
              type="checkbox"
              value={option.value}
              checked={selected.includes(option.value)}
              disabled={disabled}
              aria-invalid={invalid ? true : undefined}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, option.value]
                    : selected.filter((entry) => entry !== option.value),
                )
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    )
  }

  return (
    <div className="signup-field">
      <label htmlFor={id}>
        {question.prompt}
        <RequiredMark required={question.required} />
      </label>
      {helpText}
      {question.kind === "long_text" ? (
        <textarea
          id={id}
          rows={4}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          aria-required={question.required ? true : undefined}
          aria-describedby={describedByIds}
          aria-invalid={invalid ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          aria-required={question.required ? true : undefined}
          aria-describedby={describedByIds}
          aria-invalid={invalid ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  )
}
