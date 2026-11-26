export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
  action?: ToastAction
}

let nextId = 0
let toasts = $state.raw<Toast[]>([])

export const toastState = {
  get list() {
    return toasts
  },
}

export function toast(message: string, type: Toast['type'] = 'info', action?: ToastAction) {
  const id = nextId++
  toasts = [...toasts, { id, message, type, action }]
  setTimeout(
    () => {
      toasts = toasts.filter((candidate) => candidate.id !== id)
    },
    action || type === 'error' ? 6000 : 3000,
  )
}

export function dismissToast(id: number) {
  toasts = toasts.filter((candidate) => candidate.id !== id)
}
