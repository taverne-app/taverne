import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type ToastKind = 'error' | 'success' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

interface Toast {
  id: number
  kind: ToastKind
  message: string
  action?: ToastAction
}

interface ToastApi {
  /** Une erreur reste plus longtemps : c'est le message qu'il ne faut pas rater. */
  error: (message: string, action?: ToastAction) => void
  success: (message: string, action?: ToastAction) => void
  info: (message: string, action?: ToastAction) => void
}

const ToastContext = createContext<ToastApi>({} as ToastApi)

export const useToast = () => useContext(ToastContext)

const DURATION: Record<ToastKind, number> = {
  error: 8000,
  success: 3500,
  info: 5000,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback((kind: ToastKind, message: string, action?: ToastAction) => {
    const id = ++nextId.current
    setToasts(prev => [...prev, { id, kind, message, action }])
    setTimeout(() => dismiss(id), DURATION[kind])
  }, [dismiss])

  const api: ToastApi = {
    error: useCallback((m, a) => push('error', m, a), [push]),
    success: useCallback((m, a) => push('success', m, a), [push]),
    info: useCallback((m, a) => push('info', m, a), [push]),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-xl backdrop-blur text-sm ${
              t.kind === 'error'
                ? 'bg-red-950/90 border-red-700/60 text-red-200'
                : t.kind === 'success'
                  ? 'bg-emerald-950/90 border-emerald-700/60 text-emerald-200'
                  : 'bg-stone-900/95 border-stone-700 text-stone-200'
            }`}
          >
            <span className="shrink-0">{t.kind === 'error' ? '⚠' : t.kind === 'success' ? '✓' : 'ℹ'}</span>
            <p className="flex-1 leading-snug">{t.message}</p>
            {t.action && (
              <button
                onClick={() => { t.action?.onClick(); dismiss(t.id) }}
                className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Fermer"
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
