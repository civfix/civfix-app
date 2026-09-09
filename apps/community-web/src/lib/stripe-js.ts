"use client"

import { loadStripe } from "@stripe/stripe-js/pure"
import type { Stripe } from "@stripe/stripe-js"


const LOAD_TIMEOUT_MS = 15000

export const STRIPE_PUBLISHABLE_KEY: string | undefined =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

export function isLiveKey(key: string | undefined): boolean {
  return typeof key === "string" && key.startsWith("pk_live_")
}

let parametersApplied = false

function applyLoadParameters(): void {
  if (parametersApplied) return
  parametersApplied = true
  loadStripe.setLoadParameters({ advancedFraudSignals: false })
}

const cache = new Map<string, Promise<Stripe | null>>()

function memoKey(publishableKey: string, stripeAccount: string): string {
  return `${publishableKey}|${stripeAccount}`
}

function withTimeout(promise: Promise<Stripe | null>): Promise<Stripe | null> {
  return new Promise<Stripe | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Stripe.js did not load in time"))
    }, LOAD_TIMEOUT_MS)
    promise.then(
      (stripe) => {
        clearTimeout(timer)
        resolve(stripe)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error("Stripe.js failed to load"))
      },
    )
  })
}

export function loadStripeForAccount(stripeAccount: string): Promise<Stripe | null> {
  if (typeof window === "undefined") return Promise.resolve(null)
  const publishableKey = STRIPE_PUBLISHABLE_KEY
  if (!publishableKey || stripeAccount.length === 0) return Promise.resolve(null)

  const key = memoKey(publishableKey, stripeAccount)
  const cached = cache.get(key)
  if (cached) return cached

  applyLoadParameters()

  const pending = withTimeout(loadStripe(publishableKey, { stripeAccount })).catch(() => null)
  void pending.then((stripe) => {
    if (stripe === null && cache.get(key) === pending) cache.delete(key)
  })
  cache.set(key, pending)
  return pending
}

export function resetStripeLoaderForTests(): void {
  cache.clear()
  parametersApplied = false
}
