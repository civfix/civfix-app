import { create } from "zustand"
import type { DetailEntry } from "@civfix/ui"

export const ROOT_ROUTE_NAME = "index"

export type ShellId = string | null

export const ROOT_SHELL_ID: ShellId = null

export interface NestedShellHost {
  id: string
  snapshot: readonly DetailEntry[]
}

export interface NestedShellState {
  hosts: readonly NestedShellHost[]
}

export const NO_NESTED_SHELL: NestedShellState = { hosts: [] }

export function rootIsTopRoute(route: { name?: string } | null | undefined): boolean {
  return route?.name === ROOT_ROUTE_NAME
}

export function withNestedShellHost(
  state: NestedShellState,
  id: string,
  snapshot: readonly DetailEntry[],
): NestedShellState {
  if (state.hosts.some((host) => host.id === id)) return state
  return { hosts: [...state.hosts, { id, snapshot }] }
}

export function withoutNestedShellHost(state: NestedShellState, id: string): NestedShellState {
  if (!state.hosts.some((host) => host.id === id)) return state
  const hosts = state.hosts.filter((host) => host.id !== id)
  return hosts.length === 0 ? NO_NESTED_SHELL : { hosts }
}

export function withoutNestedShellHosts(state: NestedShellState): NestedShellState {
  return state.hosts.length === 0 ? state : NO_NESTED_SHELL
}

export function shellStackBelow(
  state: NestedShellState,
  id: ShellId,
): readonly DetailEntry[] | null {
  if (id === ROOT_SHELL_ID) return state.hosts[0]?.snapshot ?? null
  const index = state.hosts.findIndex((host) => host.id === id)
  if (index === -1) return null
  return state.hosts[index + 1]?.snapshot ?? null
}

export const useNestedShellStore = create<NestedShellState>(() => NO_NESTED_SHELL)

export function enterNestedShell(id: string, snapshot: readonly DetailEntry[]): void {
  useNestedShellStore.setState((state) => withNestedShellHost(state, id, snapshot))
}

export function exitNestedShell(id: string): void {
  useNestedShellStore.setState((state) => withoutNestedShellHost(state, id))
}

export function clearNestedShellHosts(): void {
  useNestedShellStore.setState(withoutNestedShellHosts)
}
