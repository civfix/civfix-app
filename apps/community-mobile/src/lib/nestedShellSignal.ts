import { create } from "zustand"
import type { DetailEntry } from "@civfix/ui"

export const ROOT_ROUTE_NAME = "index"

export interface NestedShellState {
  hosts: readonly string[]
  rootEntry: DetailEntry | null
}

export const NO_NESTED_SHELL: NestedShellState = { hosts: [], rootEntry: null }

export function rootIsTopRoute(route: { name?: string } | null | undefined): boolean {
  return route?.name === ROOT_ROUTE_NAME
}

export function withNestedShellHost(
  state: NestedShellState,
  id: string,
  rootEntry: DetailEntry | null,
): NestedShellState {
  if (state.hosts.includes(id)) return state
  return state.hosts.length === 0
    ? { hosts: [id], rootEntry }
    : { hosts: [...state.hosts, id], rootEntry: state.rootEntry }
}

export function withoutNestedShellHost(state: NestedShellState, id: string): NestedShellState {
  if (!state.hosts.includes(id)) return state
  const hosts = state.hosts.filter((host) => host !== id)
  return hosts.length === 0 ? NO_NESTED_SHELL : { hosts, rootEntry: state.rootEntry }
}

export function withoutNestedShellHosts(state: NestedShellState): NestedShellState {
  return state.hosts.length === 0 ? state : NO_NESTED_SHELL
}

export const useNestedShellStore = create<NestedShellState>(() => NO_NESTED_SHELL)

export function enterNestedShell(id: string, rootEntry: DetailEntry | null): void {
  useNestedShellStore.setState((state) => withNestedShellHost(state, id, rootEntry))
}

export function exitNestedShell(id: string): void {
  useNestedShellStore.setState((state) => withoutNestedShellHost(state, id))
}

export function clearNestedShellHosts(): void {
  useNestedShellStore.setState(withoutNestedShellHosts)
}

export function nestedShellBodyEntry(
  state: NestedShellState,
  entry: DetailEntry | null,
): { render: false } | { render: true; entry: DetailEntry | null } {
  if (state.hosts.length === 0 || entry === null) return { render: true, entry }
  return state.rootEntry === null ? { render: false } : { render: true, entry: state.rootEntry }
}
