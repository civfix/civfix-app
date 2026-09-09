import React from "react"
import { AuthGate } from "@/components/AuthGate"

export default function AuthScreen() {
  return <AuthGate mode="welcome" showBack />
}
