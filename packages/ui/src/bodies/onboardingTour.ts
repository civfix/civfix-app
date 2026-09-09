import { create } from "zustand"

export type OnboardingTourPresenter = () => void

interface OnboardingTourState {
  presenter: OnboardingTourPresenter | null
}

const useOnboardingTourStore = create<OnboardingTourState>(() => ({ presenter: null }))

export function setOnboardingTourPresenter(present: OnboardingTourPresenter | null): void {
  useOnboardingTourStore.setState({ presenter: present })
}

export function getOnboardingTourPresenter(): OnboardingTourPresenter | null {
  return useOnboardingTourStore.getState().presenter
}

export function useOnboardingTourPresenter(): OnboardingTourPresenter | null {
  return useOnboardingTourStore((state) => state.presenter)
}
