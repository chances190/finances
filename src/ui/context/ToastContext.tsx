import { XIcon } from '@phosphor-icons/react'
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastContextValue {
  toast: (message: string, type?: Toast['type']) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(
      () => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      },
      type === 'error' ? 6000 : 3000,
    )
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className="flex items-center gap-2 border border-border bg-popover px-3 py-2 text-xs text-foreground shadow-lg"
          >
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Dismiss notification"
              className="-my-2 -mr-2 flex size-10 shrink-0 items-center justify-center opacity-70 hover:opacity-100 sm:-my-1 sm:-mr-1 sm:size-6"
            >
              <XIcon className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
