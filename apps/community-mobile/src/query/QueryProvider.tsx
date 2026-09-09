/**
 * React Query provider.
 *
 * Cache persistence (src/query/mmkv-persister.ts) is installed at module load, BEFORE the first render,
 * so a warm relaunch hydrates the last session's lists synchronously and the app repaints instantly
 * instead of flashing skeletons. installCachePersistence both restores the cache and subscribes a
 * debounced writer for the rest of the process lifetime, so there is no teardown to manage here.
 */
import React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/query/client"
import { installCachePersistence } from "@/query/mmkv-persister"

installCachePersistence(queryClient)

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
