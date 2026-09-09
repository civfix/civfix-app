"use client"

import dynamic from "next/dynamic"

import { ConsoleBootSkeleton } from "./console-boot"

const ConsoleApp = dynamic(() => import("./console-app").then((m) => m.ConsoleApp), {
  ssr: false,
  loading: () => <ConsoleBootSkeleton />,
})

export function ConsoleRoute() {
  return <ConsoleApp />
}
