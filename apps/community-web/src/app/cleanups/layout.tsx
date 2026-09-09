import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Cleanups · civfix",
}

export default function L({ children }: { children: React.ReactNode }) {
  return children
}
