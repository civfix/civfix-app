import type { ReactElement, ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ApiClient } from "@civfix/shared/client"
import { ApiProvider } from "@civfix/ui/data"
import type { DataContextValue } from "@civfix/ui/data"
import { I18nProvider } from "@civfix/ui/i18n"
import { render } from "@testing-library/react"
import type { RenderResult } from "@testing-library/react"

import { ConsoleToastProvider } from "../overlay/toast"

export interface HarnessOptions {
  api?: Partial<ApiClient>
  authenticated?: boolean
  withToasts?: boolean
}

export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

function makeDataContext(options: HarnessOptions): DataContextValue {
  const api = (options.api ?? {}) as ApiClient
  return {
    api,
    useAuthState: () => ({
      isAuthenticated: options.authenticated ?? true,
      isPending: false,
      user: null,
    }),
    requireAuth: (action: () => void) => action(),
    logout: () => {},
  } as DataContextValue
}

export function ConsoleTestHarness({
  children,
  options = {},
  client,
}: {
  children: ReactNode
  options?: HarnessOptions
  client?: QueryClient
}) {
  const queryClient = client ?? makeTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={makeDataContext(options)}>
        <I18nProvider locale="en">
          {options.withToasts === false ? children : (
            <ConsoleToastProvider>{children}</ConsoleToastProvider>
          )}
        </I18nProvider>
      </ApiProvider>
    </QueryClientProvider>
  )
}

export function renderConsole(ui: ReactElement, options: HarnessOptions = {}): RenderResult {
  return render(<ConsoleTestHarness options={options}>{ui}</ConsoleTestHarness>)
}
