export type DeveloperScreenPresenter = () => void

export function setDeveloperScreenPresenter(_present: DeveloperScreenPresenter | null): void {}

export function useDeveloperScreenPresenter(): DeveloperScreenPresenter | null {
  return null
}
