import { create } from "zustand"

export type DeveloperScreenPresenter = () => void

interface DeveloperScreenState {
  presenter: DeveloperScreenPresenter | null
}

const useDeveloperScreenStore = create<DeveloperScreenState>(() => ({ presenter: null }))

export function setDeveloperScreenPresenter(present: DeveloperScreenPresenter | null): void {
  useDeveloperScreenStore.setState({ presenter: present })
}

export function useDeveloperScreenPresenter(): DeveloperScreenPresenter | null {
  return useDeveloperScreenStore((state) => state.presenter)
}
