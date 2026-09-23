import React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/query/client"
import { installCachePersistence } from "@/query/mmkv-persister"

// Installed at module load, before the first render, so a warm relaunch hydrates synchronously instead of
// flashing skeletons.
installCachePersistence(queryClient)

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
