import { useTranslation } from "react-i18next"

export function useT(ns?: string) {
  return useTranslation(ns)
}
