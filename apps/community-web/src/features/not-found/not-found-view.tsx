"use client"

import Link from "next/link"

import { Wordmark } from "@/components/brand"

import { NotFoundStage } from "./not-found-stage"
import { NOT_FOUND_COPY } from "./not-found-copy"

export function NotFoundView() {
  return (
    <main className="nf-page">
      <header className="nf-top">
        <Link href="/" aria-label="civfix home">
          <Wordmark />
        </Link>
      </header>
      <div className="nf-body">
        <NotFoundStage />
        <div className="nf-copy">
          <p className="nf-eyebrow">{NOT_FOUND_COPY.eyebrow}</p>
          <h1>{NOT_FOUND_COPY.headline}</h1>
          <p className="nf-sub">{NOT_FOUND_COPY.supporting}</p>
          <Link className="btn primary lg nf-cta" href="/map/">
            {NOT_FOUND_COPY.cta}
          </Link>
        </div>
      </div>
    </main>
  )
}
