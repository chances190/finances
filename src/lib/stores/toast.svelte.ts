export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

let nextId = 0
let toasts = $state.raw<Toast[]>([])

export const toastState = {
  get list() {
    return toasts
  },
}

export function toast(message: string, type: Toast['type'] = 'info') {
  const id = nextId++
  toasts = [...toasts, { id, message, type }]
  setTimeout(
    () => {
      toasts = toasts.filter((candidate) => candidate.id !== id)
    },
    type === 'error' ? 6000 : 3000,
  )
}

export function dismissToast(id: number) {
  toasts = toasts.filter((candidate) => candidate.id !== id)
}
