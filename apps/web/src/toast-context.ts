import { createContext, useContext } from 'react'

export type ToastTone = 'error' | 'info' | 'success'

export interface ToastMessage {
  id: string
  message: string
  tone: ToastTone
}

export interface ToastInput {
  message: string
  tone?: ToastTone
}

export interface ToastContextValue {
  dismissToast: (id: string) => void
  pushToast: (toast: ToastInput) => string
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function appendToast(
  current: readonly ToastMessage[],
  next: ToastMessage,
) {
  return [...current, next].slice(-3)
}

export function useToast() {
  const value = useContext(ToastContext)
  if (value === null) throw new Error('useToast must be used within ToastProvider')
  return value
}
