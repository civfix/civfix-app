"use client"

import * as React from "react"

import { ConsoleButton } from "@/components/console/button"

interface ConsoleErrorBoundaryProps {
  title: string
  body: string
  retryLabel: string
  children: React.ReactNode
}

interface ConsoleErrorBoundaryState {
  failed: boolean
}

export class ConsoleErrorBoundary extends React.Component<
  ConsoleErrorBoundaryProps,
  ConsoleErrorBoundaryState
> {
  override state: ConsoleErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ConsoleErrorBoundaryState {
    return { failed: true }
  }

  private reset = () => {
    this.setState({ failed: false })
  }

  override render() {
    if (!this.state.failed) return this.props.children
    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-token-3 bg-console-canvas px-token-5 text-center"
      >
        <p className="font-display text-token-18 font-bold text-console-ink">
          {this.props.title}
        </p>
        <p className="max-w-md text-token-13 text-console-ink-2">{this.props.body}</p>
        <ConsoleButton onClick={this.reset}>{this.props.retryLabel}</ConsoleButton>
      </div>
    )
  }
}
